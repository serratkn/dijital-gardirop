// Uzantı BİLEREK yazılı ('./seasons.js'): bu modül React'sız, saf JavaScript
// ve test-scripts/test-outfit-builder.mjs onu DOĞRUDAN node ile çalıştırıyor.
// Node'un ESM çözümleyicisi uzantısız yolu bulamaz; Vite ikisini de kabul eder.
import { matchesSeason } from './seasons.js'

// Kombin kurma mantığının TAMAMI burada. Sayfadan (OutfitSuggestion.jsx)
// ayrılmasının sebebi Aşama 4'te iki ayrı yolun ortaya çıkması: vektör tabanlı
// eşleştirme ve ona düşülemediğinde devreye giren rastgele seçim. İkisi de saf
// fonksiyon olduğu için React'sız, deterministik biçimde test edilebilir.
//
// ÖNEMLİ: Kombin üretimi hâlâ İSTEMCİ TARAFINDADIR. Backend yalnızca
// "vektör uzayında bunlar yakın" der (GET /clothing-items/:id/companions);
// hangi slotun neyle dolacağı, temiz/kirli ve hava durumu kuralları burada.

export const OUTFIT_CATEGORIES = ['Üst', 'Alt', 'Ayakkabı', 'Çanta']

// Makyaj kombinin PARÇASI DEĞİL, üstüne konan isteğe bağlı bir öneridir:
// dört kartlık ızgaraya hiç girmez, kendi açılır bölümünde durur ve yalnızca
// kullanıcı açıkça istediğinde kaydedilen kombine dahil edilir.
export const MAKEUP_CATEGORY = 'Makyaj'

// Backend'den aday istenen kategorilerin tamamı. OUTFIT_CATEGORIES'ten AYRI
// tutuluyor çünkü ikisi farklı soruları yanıtlıyor: bu liste "neyi sorgula",
// öteki "kombinin hangi slotları var" demek.
export const CANDIDATE_CATEGORIES = [...OUTFIT_CATEGORIES, MAKEUP_CATEGORY]

export const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]

// Hava durumu ÖNCELİKLENDİRİR, ELEMEZ: o kategoride uygun sezonda parça yoksa
// tüm havuza düşülür. Sert filtre olsaydı hava durumu yüzünden slotlar boş
// kalırdı. (Aşama "hava durumu" kaydındaki kural aynen korunuyor.)
function preferSeason(pool, seasons) {
  const preferred = pool.filter((item) => matchesSeason(item, seasons))
  return preferred.length > 0 ? preferred : pool
}

// --- Serbest metin (mood) bağlamı ---
//
// moodContext yalnızca interpretOutfitRequest BAŞARILI olduğunda dolu gelir
// (bkz. OutfitSuggestion.jsx > createMoodContext). null/undefined ise TÜM
// aşağıdaki fonksiyonlar ESKİ (bu özellikten önceki) davranışlarıyla BİREBİR
// AYNI çalışır — hiçbir filtre/öncelik uygulanmaz. Bu, "stil tercihi olmadan
// pill akışı hâlâ aynı" regresyon gereksinimini yapısal olarak garanti eder:
// her aşağıdaki fonksiyon `moodContext` yokken erken çıkar ve havuzu OLDUĞU
// GİBİ döndürür.

const KACINILAN_KELIME_DURAKLARI = new Set([
  'çok', 'aşırı', 've', 'ile', 'bir', 'biraz', 'olmayan', 'olmasın', 'gibi',
])

// "Çok rahat/spor" gibi bir ifadeyi tekil, anlamlı kelimelere ayırır. TAM
// CÜMLE eşleşmesi ARANMAZ — bir parçanın ai_analysis'inde kullanıcının
// kaçındığı ifade birebir geçmeyecektir. Kelime düzeyinde örtüşme aranır:
// "rahat", "spor" gibi kelimelerin hem kullanıcının kaçındığı ifadede hem de
// parçanın kendi analizinde geçmesi (örn. stil: "Spor") yeterli bir sinyaldir.
function kacinilanKelimeleriCikar(kacinilmasiGerekenler) {
  const kelimeler = new Set()
  for (const ifade of kacinilmasiGerekenler ?? []) {
    for (const kelime of String(ifade).toLocaleLowerCase('tr-TR').split(/[^a-zçğıöşü]+/)) {
      if (kelime.length >= 3 && !KACINILAN_KELIME_DURAKLARI.has(kelime)) kelimeler.add(kelime)
    }
  }
  return kelimeler
}

// interpretOutfitRequest'in ham yanıtından, kombin kurma fonksiyonlarının
// anlayacağı küçük ve TEKRAR HESAPLANMASI GEREKMEYEN bir bağlam nesnesi
// üretir (kelime ayrıştırması bir kez yapılır, her seçimde değil).
export function createMoodContext(interpretation) {
  if (!interpretation) return null
  return {
    occasion: interpretation.occasion ?? null,
    stilTercihi: interpretation.stil_tercihi ?? null,
    kacinilanKelimeler: kacinilanKelimeleriCikar(interpretation.kacinilmasi_gerekenler),
  }
}

// Bir parçanın ai_analysis metninde (stil, açıklama, tür alanları) kaçınılan
// kelimelerden biri geçiyor mu?
function parcaKacinilanlarlaOrtusuyorMu(item, kacinilanKelimeler) {
  if (!kacinilanKelimeler || kacinilanKelimeler.size === 0) return false
  const veri = item?.aiAnalysis?.veri
  if (!veri) return false

  const metin = [
    veri.stil,
    veri.genel_aciklama,
    veri.alt_kategori,
    veri.kesim_tipi,
    veri.urun_turu,
    veri.ayakkabi_turu,
    veri.canta_turu,
    veri.bitis_efekti,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr-TR')

  for (const kelime of kacinilanKelimeler) {
    if (metin.includes(kelime)) return true
  }
  return false
}

// ÖNCELİKLENDİRİR, ELEMEZ — preferSeason ile AYNI ilke: kullanıcının kaçınmak
// istediği bir stille örtüşen parçalar varsayılan olarak arkaya atılır, ama
// havuzda BAŞKA seçenek yoksa (gardırop küçükse) yine de seçilebilir kalır.
// Aksi hâlde küçük bir gardıropta kombin hiç kurulamayabilirdi.
function preferAvoidingKeywords(pool, kacinilanKelimeler) {
  if (!kacinilanKelimeler || kacinilanKelimeler.size === 0) return pool
  const guvenli = pool.filter((item) => !parcaKacinilanlarlaOrtusuyorMu(item, kacinilanKelimeler))
  return guvenli.length > 0 ? guvenli : pool
}

// "Parmak arası terlik" sorununa karşı ÖZEL ve DAHA SIKI bir önlem —
// preferAvoidingKeywords'ün genel kelime örtüşmesinden AYRI bir mekanizma.
// Gerçek bir vaka bunu gerekli kıldı: "sade bir şıklık istiyorum" (Akşam
// Yemeği) sorgusu, saf embedding benzerliğine bırakılırsa parmak arası
// terliği EN YAKIN ayakkabılardan biri olarak döndürebiliyordu (arama_metni
// "kombin" gibi genel kelimeler üzerinden benzerlik kurabiliyor, "formal mi
// günlük mü" ayrımını GÜVENİLİR biçimde yapamıyor). Bu yüzden resmi bir
// durumda Ayakkabı slotu için ai_analysis'ten OKUNAN somut bir formallik
// sinyaline bakılır.
//
// NOT: "babet" bilerek RESMİ listede — bir babet, terlik/sneaker'dan farklı
// olarak iş/günlük şıklık için genellikle uygun kabul edilir (bu depodaki
// gerçek test verisinde de "Klasik" etiketiyle geliyor).
const FORMAL_OCCASIONS = ['Akşam Yemeği', 'İş', 'Özel Davet']
const GUNLUK_AYAKKABI_DESENI = /\bterlik\b|\bsandalet\b|\bsneaker\b|spor ayakkab|\bcrocs\b|flip.?flop/i
const RESMI_AYAKKABI_DESENI = /\btopuk\b|\bstiletto\b|\boxford\b|\bklasik\b|\brugan\b|deri bot|\bbabet\b|\bmakosen\b/i

// true = resmi görünüyor, false = günlük/spor görünüyor, null = bilinmiyor
// (ai_analysis yok ya da hiçbir desene uymuyor).
function ayakkabiFormalligi(item) {
  const veri = item?.aiAnalysis?.veri
  if (!veri) return null

  const metin = [veri.ayakkabi_turu, veri.stil, veri.topuk_yuksekligi]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr-TR')

  if (RESMI_AYAKKABI_DESENI.test(metin)) return true
  if (GUNLUK_AYAKKABI_DESENI.test(metin)) return false
  return null
}

// Yalnızca Ayakkabı kategorisine, yalnızca resmi bir durum + belirtilmiş bir
// stil tercihi varken uygulanır — "iş için rahat bir şeyler" gibi durumlarda
// gereksiz yere sneaker'ları arkaya atmamalı.
function preferFormalShoes(pool, category, moodContext) {
  if (category !== 'Ayakkabı') return pool
  if (!moodContext?.stilTercihi) return pool
  if (!FORMAL_OCCASIONS.includes(moodContext.occasion)) return pool

  const resmiler = pool.filter((item) => ayakkabiFormalligi(item) === true)
  if (resmiler.length > 0) return resmiler

  // Açıkça "resmi" etiketli bir şey yoksa, en azından KESİNLİKLE günlük
  // olarak işaretlenmiş olanları (bilinen en kötü seçenekler) arkaya at.
  const gunlukOlmayanlar = pool.filter((item) => ayakkabiFormalligi(item) !== false)
  return gunlukOlmayanlar.length > 0 ? gunlukOlmayanlar : pool
}

// Bir kategori havuzuna TÜM mood-bazlı önceliklendirmeyi uygular. preferSeason
// ile AYNI aileden: sırasıyla kaçınılan kelimeler, sonra (yalnızca Ayakkabı
// için) resmi ayakkabı kuralı. moodContext yoksa pool DEĞİŞMEDEN döner.
function applyMoodPreferences(pool, category, moodContext) {
  if (!moodContext) return pool
  const kelimeSuzulmus = preferAvoidingKeywords(pool, moodContext.kacinilanKelimeler)
  return preferFormalShoes(kelimeSuzulmus, category, moodContext)
}

// Her kategoriden rastgele bir parça seçer; o kategoride seçilebilir parça
// yoksa slot atlanır (kombin eksik parçayla da oluşabilir).
// Kendisine YALNIZCA temiz parçalar verilir — filtreleme çağıranda yapılır ki
// sayfa "hiç parça yok" ile "temiz parça yok" durumlarını ayırt edebilsin.
//
// moodContext OPSİYONELDİR (varsayılan null): Gemini erişilemediğinde ya da
// yorumlama hiç denenmediğinde (yalnızca pill seçildiğinde) bu fonksiyon
// ESKİ davranışıyla BİREBİR AYNI çalışır. Doluysa (Chroma/vektör kapalı olsa
// bile) kaçınılan kelimeler ve resmi ayakkabı kuralı yine de uygulanır —
// bu ikisi Chroma'ya değil yalnızca ai_analysis'e bakar.
export function buildRandomOutfit(items, seasons, moodContext = null) {
  return OUTFIT_CATEGORIES.map((category) => {
    const pool = items.filter((item) => item.category === category)
    if (pool.length === 0) return null
    const havuz = applyMoodPreferences(preferSeason(pool, seasons), category, moodContext)
    return pickRandom(havuz)
  }).filter(Boolean)
}

// Vektör aramasının BAŞLANGIÇ PARÇASI. Sıralama bilinçli:
//
//   1. Yalnızca kombin kategorilerinden ve yalnızca TEMİZ parçalardan seçilir.
//   2. ANALİZİ OLAN parçalar tercih edilir: embedding'in kaynağı ai_analysis
//      kolonudur, analizi olmayan parçanın Chroma'da vektörü de yoktur ve
//      onu başlangıç yapmak aramayı baştan boşa çıkarırdı.
//   3. Kalan havuzda hava durumuna uygun sezon önceliklidir (ama zorunlu değil).
//
// `excludeId`: "Başka Öneri Göster" yeni bir başlangıç parçası isterken aynı
// parçanın tekrar seçilmemesi için — alternatifi yoksa yok sayılır.
//
// `textRanking`: serbest metin yorumlamasının arama_metni'nden türeyen
// Map(itemId → benzerlik) (bkz. OutfitSuggestion.jsx). Doluysa başlangıç
// parçası RASTGELE değil, havuzdaki EN YAKIN eşleşen parça olarak seçilir —
// "sade bir şıklık istiyorum" dendiğinde seed'in gerçekten o isteğe yakın
// bir parça olması için. Havuzdaki HİÇBİR parça ranking'te yoksa (ör. Chroma
// o an erişilemedi) sessizce eski rastgele davranışa düşülür.
//
// `moodContext`: kaçınılan kelimelerle örtüşen parçalar (preferAvoidingKeywords)
// havuzdan ÖNCELİKLE elenir (elenmez, yalnızca arkaya atılır) — hem rastgele
// hem de textRanking tabanlı seçim bu daraltılmış havuz üzerinden çalışır.
export function pickSeedItem(
  cleanItems,
  seasons,
  { excludeId = null, textRanking = null, moodContext = null } = {},
) {
  const uygun = cleanItems.filter((item) => OUTFIT_CATEGORIES.includes(item.category))
  if (uygun.length === 0) return null

  const excluded = uygun.filter((item) => item.id !== excludeId)
  const havuz = excluded.length > 0 ? excluded : uygun

  const analizli = havuz.filter((item) => item.aiAnalysis)
  const oncelikli = analizli.length > 0 ? analizli : havuz

  const kelimeSuzulmus = preferAvoidingKeywords(oncelikli, moodContext?.kacinilanKelimeler)
  const mevsimeUygun = preferSeason(kelimeSuzulmus, seasons)

  if (textRanking && textRanking.size > 0) {
    const siraliEslesenler = mevsimeUygun
      .filter((item) => textRanking.has(item.id))
      .sort((a, b) => textRanking.get(b.id) - textRanking.get(a.id))
    if (siraliEslesenler.length > 0) return siraliEslesenler[0]
  }

  return pickRandom(mevsimeUygun)
}

// Aynı başlangıç parçası için kaç FARKLI varyant üretilebilir. "Başka Öneri
// Göster" bu derinlik tükenince yeni bir başlangıç parçasına geçer; yoksa
// aynı iki kombin arasında gidip gelirdi.
// MAKYAJ HAVUZU DERİNLİĞE SAYILMAZ: sayılsaydı, çok makyaj ürünü olup tek
// tişörtü olan bir gardıropta "Başka Öneri Göster" dört kartı hiç
// değiştirmeden yalnızca ruju döndürür ve düğme bozuk görünürdü.
export function variantDepth(candidatesByCategory) {
  let depth = 0
  for (const category of OUTFIT_CATEGORIES) {
    const pool = candidatesByCategory?.get(category) ?? []
    const secilebilir = pool.filter((item) => item.isClean !== false)
    depth = Math.max(depth, secilebilir.length)
  }
  return depth
}

// Kombine eşlik edecek makyaj önerisi. Başlangıç parçasına en yakın TEMİZ
// makyaj ürününü döndürür, yoksa null.
//
// BU KATEGORİDE GERİ DÜŞÜŞ YOKTUR ve bu bilinçlidir. Diğer slotlarda rastgele
// bir parça göstermek "kombinin eksik kalmaması" için değerliydi; makyaj ise
// isteğe bağlı bir ek. Vektör bir şey söyleyemiyorsa (embedding yok, Chroma
// kapalı, hepsi kirli) doğru davranış rastgele bir ruj önermek değil, bölümü
// HİÇ GÖSTERMEMEKTİR — çağıran null'ı tam olarak böyle yorumlar.
//
// Sezon önceliği de UYGULANMAZ: "kışlık ruj" diye bir şey yok, mevsim kuralı
// kıyafetin sıcaklığıyla ilgili bir kavram.
export function pickMakeupItem(candidatesByCategory, variant = 0) {
  const temiz = (candidatesByCategory?.get(MAKEUP_CATEGORY) ?? []).filter(
    (item) => item.isClean !== false,
  )
  if (temiz.length === 0) return null

  // Havuzda ilerleme kuralı diğer slotlarla aynı: 0 en yakın, 1 ikinci en yakın.
  return temiz[variant % temiz.length]
}

// Vektör adaylarından kombin kurar.
//
// `candidatesByCategory`: kategori ADI → benzerlik sırasına göre dizilmiş
// parça listesi (backend'den gelen id'ler yerel gardırop kayıtlarıyla
// eşleştirilmiş hâlde; böylece temiz/kirli iyimser güncellemesi taze kalır).
//
// KRİTİK: vektör benzerliği temiz/kirli ve hava durumu filtrelerini ATLAMAZ.
// Adaylar önce temiz olanlara indirgenir, sonra sezon önceliği uygulanır.
// Bir kategoride aday kalmazsa YALNIZCA O SLOT rastgele seçime düşer —
// tüm kombin değil.
//
// Dönen `vectorCount` arayüzdeki "akıllı seçim" rozetini sürer: sıfırsa
// ortada vektörün getirdiği hiçbir parça yok demektir ve rozet gösterilmez.
//
// moodContext OPSİYONELDİR: hem vektör adayları hem de rastgele geri düşüş
// havuzu, seçilmeden ÖNCE applyMoodPreferences'tan geçirilir (kaçınılan
// kelimeler + Ayakkabı için resmi ayakkabı kuralı). moodContext yoksa
// (pill-only akış) davranış ESKİSİYLE BİREBİR AYNI kalır.
export function buildOutfitFromCandidates({
  seedItem,
  candidatesByCategory,
  cleanItems,
  seasons,
  variant = 0,
  moodContext = null,
}) {
  let vectorCount = 0
  let fallbackCount = 0

  const items = OUTFIT_CATEGORIES.map((category) => {
    if (seedItem?.category === category) return seedItem

    const adaylar = (candidatesByCategory?.get(category) ?? []).filter(
      (item) => item.isClean !== false,
    )

    if (adaylar.length > 0) {
      const havuz = applyMoodPreferences(preferSeason(adaylar, seasons), category, moodContext)
      vectorCount += 1
      // Varyant, havuzda İLERLER: 0 en yakın, 1 ikinci en yakın… Havuz
      // tükenince başa sarar ("Başka Öneri Göster" o noktada zaten yeni bir
      // başlangıç parçası ister, bkz. variantDepth).
      return havuz[variant % havuz.length]
    }

    // Bu kategoride vektör adayı yok (embedding'i olmayan parçalar, ya da
    // hepsi kirli): sessizce mevcut rastgele mantığa düşülür.
    const havuz = cleanItems.filter((item) => item.category === category)
    if (havuz.length === 0) return null

    fallbackCount += 1
    return pickRandom(applyMoodPreferences(preferSeason(havuz, seasons), category, moodContext))
  }).filter(Boolean)

  return { items, vectorCount, fallbackCount }
}

export function isSameOutfit(a, b) {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id)
}
