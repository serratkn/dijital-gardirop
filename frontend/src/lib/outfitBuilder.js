// Uzantı BİLEREK yazılı ('./seasons.js'): bu modül React'sız, saf JavaScript
// ve test-scripts/test-outfit-builder.mjs onu DOĞRUDAN node ile çalıştırıyor.
// Node'un ESM çözümleyicisi uzantısız yolu bulamaz; Vite ikisini de kabul eder.
import { COLD_WEATHER_STATUS, matchesSeason } from './seasons.js'

// Kombin kurma mantığının TAMAMI burada. Sayfadan (OutfitSuggestion.jsx)
// ayrılmasının sebebi Aşama 4'te iki ayrı yolun ortaya çıkması: vektör tabanlı
// eşleştirme ve ona düşülemediğinde devreye giren rastgele seçim. İkisi de saf
// fonksiyon olduğu için React'sız, deterministik biçimde test edilebilir.
//
// ÖNEMLİ: Kombin üretimi hâlâ İSTEMCİ TARAFINDADIR. Backend yalnızca
// "vektör uzayında bunlar yakın" der (GET /clothing-items/:id/companions);
// hangi slotun neyle dolacağı, temiz/kirli ve hava durumu kuralları burada.

export const OUTFIT_CATEGORIES = ['Üst', 'Alt', 'Ayakkabı', 'Çanta']

// Elbise, Üst+Alt ikilisinin YERİNE geçen bir ALTERNATİFTİR, EK bir kategori
// DEĞİL — bu yüzden OUTFIT_CATEGORIES'e basitçe eklenemez (o zaman kombin
// "elbise + tişört + pantolon" gibi anlamsız 5 parçaya çıkardı). Hangi
// rotanın kullanılacağına `resolveActiveCategories` karar verir.
export const DRESS_CATEGORY = 'Elbise'

// Makyaj kombinin PARÇASI DEĞİL, üstüne konan isteğe bağlı bir öneridir:
// dört kartlık ızgaraya hiç girmez, kendi açılır bölümünde durur ve yalnızca
// kullanıcı açıkça istediğinde kaydedilen kombine dahil edilir.
export const MAKEUP_CATEGORY = 'Makyaj'

// Dış giyim (mont, kaban, hırka vb.) — mevcut dört ZORUNLU kategorinin
// DIŞINDA, KOŞULLU bir beşinci slottur: yalnızca hava GERÇEKTEN soğukken
// (bkz. pickOuterwearItem) ana kombine eklenir. OUTFIT_CATEGORIES'e BİLEREK
// EKLENMEDİ — "kombinin zorunlu 4 slotu ne" sorusuyla "hava soğukken üstüne
// eklenen katman ne" sorusu FARKLI kavramlar; Makyaj'ın OUTFIT_CATEGORIES
// dışında tutulmasıyla AYNI gerekçe.
export const OUTERWEAR_CATEGORY = 'Dış Giyim'

// Backend'den aday istenen kategorilerin tamamı. OUTFIT_CATEGORIES'ten AYRI
// tutuluyor çünkü ikisi farklı soruları yanıtlıyor: bu liste "neyi sorgula",
// öteki "kombinin hangi slotları var" demek. Elbise HER ZAMAN sorgulanır
// (dress route seçilmese bile) — backend'in kategori bazlı sorgusu zaten
// jenerik olduğu için bunun bir maliyeti yok, ve dress route'un devreye
// girip girmeyeceğine karar verirken (bkz. resolveActiveCategories) gerçek
// vektör adaylarına ihtiyaç var.
export const CANDIDATE_CATEGORIES = [
  ...OUTFIT_CATEGORIES,
  MAKEUP_CATEGORY,
  OUTERWEAR_CATEGORY,
  DRESS_CATEGORY,
]

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

// JS regex `\b`, `\w`'yi YALNIZCA ASCII harfleriyle tanımlar — Türkçe'ye özgü
// harfler (ş, ğ, ı, ö, ü, ç) birer "kelime karakteri" SAYILMAZ. Bu yüzden
// `\bşık\b` gibi bir desen "sade ve şık" cümlesinde HİÇ EŞLEŞMEZ: boşlukla
// 'ş' arasında JS'e göre ikisi de "kelime dışı" olduğundan sınır bulunamaz
// (yazılırken test edilip gerçekten YAKALANAN bir hata). "şık" kelimesi
// için elle, Unicode-farkında bir sınır kuruluyor; listedeki diğer kelimeler
// (klasik, zarif, elegan, resmi, ofis, sofistik…) ASCII bir harfle
// başladığı/bittiği için normal `\b` sorunsuz çalışıyor.
const TR_KELIME_DISI = '[^a-zçğıöşüA-ZÇĞİÖŞÜ0-9_]'
const SIK_KELIME_DESENI = `(?:^|${TR_KELIME_DISI})şık(?:$|${TR_KELIME_DISI})`

// "stilTercihi ALANI DOLU MU" ile "stilTercihi GERÇEKTEN ŞIKLIK/RESMİYET Mİ
// İSTİYOR" AYNI ŞEY DEĞİL — bu ayrım önceden YOKTU ve gerçek bir hataya yol
// açıyordu: "Akşam yemeğine gidiyorum ama RAHAT giyinmek istiyorum" dendiğinde
// occasion "Akşam Yemeği" (resmi) olduğu için ve stilTercihi dolu ("Rahat")
// olduğu için sistem yine de resmi ayakkabı/kıyafet öncelikliyordu — tam
// TERSİ gerekiyordu. Artık yalnızca stilTercihi'nin İÇERİĞİ gerçekten
// resmiyet/şıklık işaret ediyorsa formal önceliklendirme devreye giriyor.
const RESMI_STIL_TERCIHI_DESENI = new RegExp(
  `\\bklasik\\b|${SIK_KELIME_DESENI}|\\bzarif\\b|\\belegan\\b|\\bresmi\\b|\\bofis\\b|\\bsofistik`,
  'i',
)

function stilTercihiResmiMi(stilTercihi) {
  return Boolean(stilTercihi) && RESMI_STIL_TERCIHI_DESENI.test(String(stilTercihi).toLocaleLowerCase('tr-TR'))
}

// SİMETRİK YÖN (2026-09-01 eklendi) — "resmi durumda günlük ayakkabıdan
// kaçın" kuralı VARDI ama tersi ("günlük/plaj bağlamında resmi ayakkabıdan
// kaçın") HİÇ YOKTU. Gerçek vakada görüldü: "deniz kenarı" gibi altı standart
// occasion'a UYMAYAN (occasion "Diğer"e düşen) bir istek, saf embedding
// benzerliğine bırakılınca topuklu bir ayakkabıyı rahatça seçebiliyordu —
// occasion bazlı FORMAL_OCCASIONS kontrolü bu durumda hiç devreye girmiyordu.
// Occasion'a göre DEĞİL, doğrudan stilTercihi'nin İÇERİĞİNE göre tetiklenir
// (occasion'dan bağımsız): "Akşam yemeğine gidiyorum ama rahat olsun" gibi
// bir istekte de doğru yön budur, occasion formal olsa bile.
const GUNLUK_STIL_TERCIHI_DESENI =
  /\bgünlük\b|\bgündelik\b|\brahat\b|\bspor\b|\bcasual\b|\bplaj\b|\btatil\b|\byazlık\b|\byazlik\b/i

function stilTercihiGunlukMu(stilTercihi) {
  return Boolean(stilTercihi) && GUNLUK_STIL_TERCIHI_DESENI.test(String(stilTercihi).toLocaleLowerCase('tr-TR'))
}

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

// Yalnızca Ayakkabı kategorisine, yalnızca resmi bir durum + GERÇEKTEN
// resmiyet/şıklık isteyen bir stil tercihi varken uygulanır — "iş için rahat
// bir şeyler" gibi durumlarda gereksiz yere sneaker'ları arkaya atmamalı.
function preferFormalShoes(pool, category, moodContext) {
  if (category !== 'Ayakkabı') return pool

  if (stilTercihiResmiMi(moodContext?.stilTercihi) && FORMAL_OCCASIONS.includes(moodContext?.occasion)) {
    const resmiler = pool.filter((item) => ayakkabiFormalligi(item) === true)
    if (resmiler.length > 0) return resmiler

    // Açıkça "resmi" etiketli bir şey yoksa, en azından KESİNLİKLE günlük
    // olarak işaretlenmiş olanları (bilinen en kötü seçenekler) arkaya at.
    const gunlukOlmayanlar = pool.filter((item) => ayakkabiFormalligi(item) !== false)
    return gunlukOlmayanlar.length > 0 ? gunlukOlmayanlar : pool
  }

  // Simetrik yön — bkz. stilTercihiGunlukMu tanımındaki not.
  if (stilTercihiGunlukMu(moodContext?.stilTercihi)) {
    const gunlukler = pool.filter((item) => ayakkabiFormalligi(item) === false)
    if (gunlukler.length > 0) return gunlukler

    const resmiOlmayanlar = pool.filter((item) => ayakkabiFormalligi(item) !== true)
    return resmiOlmayanlar.length > 0 ? resmiOlmayanlar : pool
  }

  return pool
}

// preferFormalShoes'un GENELLEŞTİRİLMİŞ hâli — Üst, Alt, Elbise ve Çanta
// kategorilerine uygulanır. ÖNCEDEN bu kategoriler yalnızca (zayıf, seyrek)
// `preferAvoidingKeywords` negatif filtresinden geçiyordu; "şık" isteyen bir
// sorguda ai_analysis'i "Günlük"/"Rahat" etiketli bir tişört+pantolon, Gemini
// açıkça bu kelimeleri "kaçınılması gereken" listesine koymadığı sürece hiç
// geri plana atılmıyordu — gerçek hatanın kök nedeni buydu. Ayakkabı KENDİ
// özel kelime dağarcığıyla (stiletto/sneaker) preferFormalShoes'ta kalır;
// genel giyim sözlüğü (klasik/şık/rahat/günlük) farklı ve ayrı tutuldu.
const GENEL_FORMAL_KATEGORILER = new Set(['Üst', 'Alt', DRESS_CATEGORY, 'Çanta'])
const GUNLUK_STIL_DESENI = /\bgünlük\b|\bgündelik\b|\brahat\b|\bspor\b|\bcasual\b/i
// "şık" için TEKRAR Unicode-farkında sınır (bkz. yukarıdaki SIK_KELIME_DESENI
// notu — JS `\b` bu kelimede çalışmıyor).
const RESMI_STIL_DESENI = new RegExp(
  `\\bklasik\\b|${SIK_KELIME_DESENI}|\\bzarif\\b|\\belegan\\b|\\bresmi\\b|\\bofis\\b|\\bkokteyl\\b|\\bgece\\b`,
  'i',
)

// true = resmi/şık görünüyor, false = günlük görünüyor, null = bilinmiyor.
function genelFormallik(item) {
  const veri = item?.aiAnalysis?.veri
  if (!veri) return null

  const metin = [veri.stil, veri.genel_aciklama, veri.alt_kategori, veri.kesim_tipi, veri.canta_turu, veri.bitis_efekti]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr-TR')

  if (RESMI_STIL_DESENI.test(metin)) return true
  if (GUNLUK_STIL_DESENI.test(metin)) return false
  return null
}

// AYNI koşul ve AYNI "önceliklendir, eleme" deseni: yalnızca resmi bir
// occasion + GERÇEKTEN resmiyet isteyen bir stil tercihi varken devreye girer.
function preferFormalStyle(pool, category, moodContext) {
  if (!GENEL_FORMAL_KATEGORILER.has(category)) return pool

  if (stilTercihiResmiMi(moodContext?.stilTercihi) && FORMAL_OCCASIONS.includes(moodContext?.occasion)) {
    const resmiler = pool.filter((item) => genelFormallik(item) === true)
    if (resmiler.length > 0) return resmiler

    const gunlukOlmayanlar = pool.filter((item) => genelFormallik(item) !== false)
    return gunlukOlmayanlar.length > 0 ? gunlukOlmayanlar : pool
  }

  // Simetrik yön — bkz. stilTercihiGunlukMu tanımındaki not.
  if (stilTercihiGunlukMu(moodContext?.stilTercihi)) {
    const gunlukler = pool.filter((item) => genelFormallik(item) === false)
    if (gunlukler.length > 0) return gunlukler

    const resmiOlmayanlar = pool.filter((item) => genelFormallik(item) !== true)
    return resmiOlmayanlar.length > 0 ? resmiOlmayanlar : pool
  }

  return pool
}

// Bir kategori havuzuna TÜM mood-bazlı önceliklendirmeyi uygular: sırasıyla
// kaçınılan kelimeler, sonra resmi ayakkabı kuralı (yalnızca Ayakkabı'da
// gerçek etkisi olur), sonra genel resmiyet kuralı (Üst/Alt/Elbise/Çanta'da
// gerçek etkisi olur — ikisi birbirini dışlar, aynı kategori için ikisi de
// no-op olabilir ama asla ikisi de gerçek filtre uygulamaz). moodContext
// yoksa pool DEĞİŞMEDEN döner.
function applyMoodPreferences(pool, category, moodContext) {
  if (!moodContext) return pool
  const kelimeSuzulmus = preferAvoidingKeywords(pool, moodContext.kacinilanKelimeler)
  const ayakkabiSuzulmus = preferFormalShoes(kelimeSuzulmus, category, moodContext)
  return preferFormalStyle(ayakkabiSuzulmus, category, moodContext)
}

// --- Elbise: Üst+Alt ikilisine ALTERNATİF bir "gövde" seçimi ---
//
// ÖNCEDEN Elbise kategorisi kombin kurma mantığının HİÇBİR yerinde
// (OUTFIT_CATEGORIES, backend'e sorgulanan kategoriler, seed parça adayları)
// yer almıyordu — gardıropta kaç elbise olursa olsun asla önerilmiyordu. Bu,
// "şık bir akşam yemeği" gibi elbisenin doğal cevap olacağı isteklerde bile
// sistemi yalnızca tişört+pantolon kombinasyonlarına hapsediyordu.
const DRESS_ROUTE_CATEGORIES = [DRESS_CATEGORY, 'Ayakkabı', 'Çanta']

// Verilen havuzda (textRanking varsa) bir kategorinin ULAŞABİLECEĞİ en
// yüksek benzerlik skoru; hiçbir öğe ranking'te yoksa -Infinity.
function enIyiSkor(items, textRanking) {
  let best = -Infinity
  for (const item of items) {
    const skor = textRanking?.get(item.id)
    if (typeof skor === 'number' && skor > best) best = skor
  }
  return best
}

// Elbise mi yoksa Üst+Alt ikilisi mi tercih edilmeli? İKİ aşamalı karar:
//
//   1. textRanking VARSA (arama_metni'nin GERÇEK embedding benzerliği —
//      bkz. OutfitSuggestion.jsx > searchClothingItemsByText): en iyi Elbise
//      skoru, en iyi Üst skoruYLA en iyi Alt skorunun ORTALAMASINA karşı
//      kıyaslanır. Ortalama kullanılıyor çünkü bir elbise İKİ parçanın
//      (üst+alt) YERİNE geçer — tek bir elbise skorunu tek bir üst skoruyla
//      kıyaslamak adil olmazdı. Bu, kullanıcının GERÇEKTEN yazdığı cümleye
//      (yalnızca occasion'a değil) göre karar verildiğinin doğrudan kanıtıdır.
//   2. textRanking YOKSA (Chroma erişilemedi, arama başarısız oldu) ama
//      occasion RESMİ ve stil tercihi GERÇEKTEN resmiyet istiyorsa:
//      ai_analysis'ten okunan kaba formallik sinyaline (genelFormallik)
//      bakılır. Üst+Alt'ta ZATEN resmi bir seçenek varsa BELİRSİZLİKTE
//      MEVCUT DAVRANIŞ (Üst+Alt) korunur — yalnızca Üst+Alt'ta resmi
//      seçenek YOKKEN ama Elbise'de VARKEN Elbise'ye geçilir.
function elbiseTercihEdilsinMi(cleanItems, elbiseler, moodContext, textRanking) {
  if (textRanking && textRanking.size > 0) {
    const ustler = cleanItems.filter((item) => item.category === 'Üst')
    const altlar = cleanItems.filter((item) => item.category === 'Alt')
    const elbiseSkoru = enIyiSkor(elbiseler, textRanking)
    const ustSkoru = enIyiSkor(ustler, textRanking)
    const altSkoru = enIyiSkor(altlar, textRanking)

    if (elbiseSkoru === -Infinity) return false
    // Üst ya da Alt'ın ranking'te hiç karşılığı yoksa (indekslenmemiş)
    // karşılaştırma anlamsızdır; elbisenin skoru varsa doğal tercih odur.
    if (ustSkoru === -Infinity || altSkoru === -Infinity) return true

    return elbiseSkoru > (ustSkoru + altSkoru) / 2
  }

  if (!stilTercihiResmiMi(moodContext?.stilTercihi)) return false
  if (!FORMAL_OCCASIONS.includes(moodContext.occasion)) return false

  const resmiElbiseVar = elbiseler.some((item) => genelFormallik(item) === true)
  if (!resmiElbiseVar) return false

  const ustler = cleanItems.filter((item) => item.category === 'Üst')
  const altlar = cleanItems.filter((item) => item.category === 'Alt')
  const resmiUstAltVar =
    ustler.some((item) => genelFormallik(item) === true) &&
    altlar.some((item) => genelFormallik(item) === true)

  return !resmiUstAltVar
}

// Bir suggestion için "gövde" kategorilerini belirler: `OUTFIT_CATEGORIES`in
// KENDİSİ (Üst+Alt+Ayakkabı+Çanta, referans eşitliği korunur — moodContext
// yokken yapılan `=== OUTFIT_CATEGORIES` / JSON karşılaştırmalı testler
// bundan etkilenmez) ya da `DRESS_ROUTE_CATEGORIES` (Elbise+Ayakkabı+Çanta).
//
// YALNIZCA moodContext VARKEN devreye girer — moodContext yoksa (pill-only
// akış) HER ZAMAN OUTFIT_CATEGORIES döner. Elbise'nin serbest metin/mood
// akışı DIŞINDA hâlâ hiç değerlendirilmemesi BİLİNÇLİ bir sınırdır: "stil
// tercihi olmadan yapılan eski akış hâlâ aynı şekilde çalışıyor" regresyon
// garantisi bunu gerektiriyor (bkz. CLAUDE.md).
export function resolveActiveCategories(cleanItems, moodContext, textRanking = null) {
  if (!moodContext) return OUTFIT_CATEGORIES

  const elbiseler = cleanItems.filter((item) => item.category === DRESS_CATEGORY)
  if (elbiseler.length === 0) return OUTFIT_CATEGORIES

  return elbiseTercihEdilsinMi(cleanItems, elbiseler, moodContext, textRanking)
    ? DRESS_ROUTE_CATEGORIES
    : OUTFIT_CATEGORIES
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
  const activeCategories = resolveActiveCategories(items, moodContext)
  return activeCategories.map((category) => {
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
// AYNI parametrelerle `resolveActiveCategories`e girilir (bkz. yukarısı):
// dress route seçildiyse (yalnızca moodContext varken mümkün) seed yalnızca
// Elbise/Ayakkabı/Çanta arasından gelir — Üst/Alt o suggestion için hiç aday
// olmaz. moodContext yoksa davranış ESKİSİYLE (yalnızca OUTFIT_CATEGORIES)
// BİREBİR AYNI kalır.
export function pickSeedItem(
  cleanItems,
  seasons,
  { excludeId = null, textRanking = null, moodContext = null } = {},
) {
  const activeCategories = resolveActiveCategories(cleanItems, moodContext, textRanking)
  const uygun = cleanItems.filter((item) => activeCategories.includes(item.category))
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
// MAKYAJ (VE DIŞ GİYİM) HAVUZU DERİNLİĞE SAYILMAZ: sayılsaydı, çok makyaj
// ürünü/montu olup tek tişörtü olan bir gardıropta "Başka Öneri Göster" dört
// kartı hiç değiştirmeden yalnızca o isteğe bağlı ürünü döndürür ve düğme
// bozuk görünürdü. İkisi de zaten OUTFIT_CATEGORIES'in DIŞINDA olduğu için
// aşağıdaki döngüye hiç girmiyor — ayrı bir hariç tutma kodu gerekmedi.
//
// `categories` OPSİYONELDİR (varsayılan OUTFIT_CATEGORIES): dress route
// aktifken (bkz. resolveActiveCategories) çağıran DRESS_ROUTE_CATEGORIES
// geçmelidir — aksi hâlde derinlik, o suggestion'da hiç KULLANILMAYAN Üst/
// Alt havuzlarının boyutuna göre yanlış hesaplanır ve "Başka Öneri Göster"
// gerçek varyant sayısı tükendiğinde yeni bir başlangıç parçasına geçmek
// yerine aynı kombini tekrar döndürebilirdi.
export function variantDepth(candidatesByCategory, categories = OUTFIT_CATEGORIES) {
  let depth = 0
  for (const category of categories) {
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

// Kombine eşlik edecek KOŞULLU 5. slot: dış giyim (mont, kaban, hırka).
// Makyaj'la AYNI ilkeyle çalışır — GERİ DÜŞÜŞ YOKTUR: vektör bir şey
// söyleyemiyorsa (embedding yok, Chroma kapalı, hepsi kirli) doğru davranış
// rastgele bir mont önermek değil, slotu HİÇ GÖSTERMEMEKTİR — çağıran null'ı
// tam olarak böyle yorumlar.
//
// Makyaj'dan TEK ek kuralı: hava durumu koşulu.
//   - `weatherStatus` TAM OLARAK COLD_WEATHER_STATUS ('soğuk') DEĞİLSE
//     (sıcak/ılık VEYA null/undefined — şehir tanımlı değil ya da hava
//     durumu servisine ulaşılamadı) fonksiyon HİÇ DENEMEDEN null döner.
//     null/undefined'ı da reddetmesi BİLİNÇLİ: "BELİRSİZLİKTE EKLEME"
//     ilkesi — hava durumu bilinmiyorsa yanlışlıkla sıcak bir günde mont
//     önermektense hiç önermemek daha güvenlidir.
//
// Sezon önceliği burada da UYGULANMAZ (Makyaj'daki gerekçenin aynısı): bu
// zaten yalnızca hava GERÇEKTEN soğukken çalışan bir slot, ayrıca bir sezon
// filtresi eklemek gereksiz bir katman olurdu.
export function pickOuterwearItem(candidatesByCategory, weatherStatus, variant = 0) {
  if (weatherStatus !== COLD_WEATHER_STATUS) return null

  const temiz = (candidatesByCategory?.get(OUTERWEAR_CATEGORY) ?? []).filter(
    (item) => item.isClean !== false,
  )
  if (temiz.length === 0) return null

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
// kelimeler + Ayakkabı için resmi ayakkabı kuralı + Üst/Alt/Elbise/Çanta için
// genel resmiyet kuralı). moodContext yoksa (pill-only akış) davranış
// ESKİSİYLE BİREBİR AYNI kalır.
//
// `textRanking` (opsiyonel): yalnızca `resolveActiveCategories`e (bkz.
// yukarısı) aktarılır — dress route kararının `pickSeedItem`'da kullanılanla
// AYNI sinyale göre verilmesi için. Bu iki fonksiyon AYNI girdilerle
// çağrıldığında deterministik olarak AYNI kategori kümesini üretir; seed'in
// hangi rotadan seçildiğiyle burada hangi rotanın kullanıldığı arasında
// tutarsızlık oluşmaz.
export function buildOutfitFromCandidates({
  seedItem,
  candidatesByCategory,
  cleanItems,
  seasons,
  variant = 0,
  moodContext = null,
  textRanking = null,
}) {
  let vectorCount = 0
  let fallbackCount = 0

  const activeCategories = resolveActiveCategories(cleanItems, moodContext, textRanking)

  const items = activeCategories.map((category) => {
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
