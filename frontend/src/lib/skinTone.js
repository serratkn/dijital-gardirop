// Kullanıcının ten tonu ile bir kıyafetin analizindeki ten tonu uyumluluğunu
// karşılaştırır.
//
// YALNIZCA BİLGİLENDİRİCİDİR. Kombin kurma mantığına HİÇ karışmaz: hiçbir
// parçayı elemez, sıralamayı değiştirmez, öneriyi etkilemez. Tek işi,
// kullanıcının kendi ten tonuyla eşleşen parçaların yanına küçük bir işaret
// koyup koymayacağımıza karar vermek.
//
// İki taraf da SERBEST METİN üretiyor ve biçimleri farklı:
//   kullanıcı → "Sıcak" | "Soğuk" | "Nötr"   (şemayla sınırlı)
//   kıyafet   → ["Sıcak ten", "Tüm Ten Tonları", "Buğday", "Açık Ten"]
// Bu yüzden tam eşitlik değil, İÇEREN karşılaştırma yapılır.

// Türkçe küçük harf: "SICAK" → "sıcak" (varsayılan toLowerCase 'ı' üretmez).
const kucult = (value) => String(value ?? '').trim().toLocaleLowerCase('tr-TR')

// "Tüm ten tonları", "Her ten tonu", "Hepsi" gibi ifadeler HER tona uyar.
const HEPSI_IFADELERI = ['tüm', 'her ten', 'hepsi', 'tümü', 'fark etmez']

export function matchesSkinTone(item, userTone) {
  const ton = kucult(userTone)
  if (!ton) return false

  const liste = item?.aiAnalysis?.veri?.uyumluluk?.ten_tonu
  if (!Array.isArray(liste) || liste.length === 0) return false

  return liste.some((deger) => {
    const metin = kucult(deger)
    if (!metin) return false

    // Genel ifadeler her tona uyar.
    if (HEPSI_IFADELERI.some((ifade) => metin.includes(ifade))) return true

    return metin.includes(ton)
  })
}
