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

// Her kategoriden rastgele bir parça seçer; o kategoride seçilebilir parça
// yoksa slot atlanır (kombin eksik parçayla da oluşabilir).
// Kendisine YALNIZCA temiz parçalar verilir — filtreleme çağıranda yapılır ki
// sayfa "hiç parça yok" ile "temiz parça yok" durumlarını ayırt edebilsin.
export function buildRandomOutfit(items, seasons) {
  return OUTFIT_CATEGORIES.map((category) => {
    const pool = items.filter((item) => item.category === category)
    if (pool.length === 0) return null
    return pickRandom(preferSeason(pool, seasons))
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
export function pickSeedItem(cleanItems, seasons, { excludeId = null } = {}) {
  const uygun = cleanItems.filter((item) => OUTFIT_CATEGORIES.includes(item.category))
  if (uygun.length === 0) return null

  const excluded = uygun.filter((item) => item.id !== excludeId)
  const havuz = excluded.length > 0 ? excluded : uygun

  const analizli = havuz.filter((item) => item.aiAnalysis)
  return pickRandom(preferSeason(analizli.length > 0 ? analizli : havuz, seasons))
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
export function buildOutfitFromCandidates({
  seedItem,
  candidatesByCategory,
  cleanItems,
  seasons,
  variant = 0,
}) {
  let vectorCount = 0
  let fallbackCount = 0

  const items = OUTFIT_CATEGORIES.map((category) => {
    if (seedItem?.category === category) return seedItem

    const adaylar = (candidatesByCategory?.get(category) ?? []).filter(
      (item) => item.isClean !== false,
    )

    if (adaylar.length > 0) {
      const havuz = preferSeason(adaylar, seasons)
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
    return pickRandom(preferSeason(havuz, seasons))
  }).filter(Boolean)

  return { items, vectorCount, fallbackCount }
}

export function isSameOutfit(a, b) {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id)
}
