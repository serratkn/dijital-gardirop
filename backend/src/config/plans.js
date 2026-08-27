// Ücretsiz katmanın somut sınırları — TEK kaynak. `users.subscription_tier`
// kolonu (free/premium) migration 001'den beri vardı ama hiçbir uç bunu
// kontrol etmiyordu; bu dosya o boşluğu kapatır.
//
// Sınırlar BİLİNÇLİ olarak Gemini kotasından BAĞIMSIZ seçildi: uygulama
// genelinde paylaşılan tek bir Gemini API anahtarı var (günlük 20 istek),
// bu yüzden "premium = sınırsız AI analizi" gibi bir vaat şu an teknik
// olarak anlamsız kalırdı (bir premium kullanıcı tek başına tüm uygulamanın
// günlük kotasını tüketebilirdi). Bunun yerine veritabanı sorgusuyla ucuzca
// ve güvenilir biçimde uygulanabilen, Gemini'den TAMAMEN bağımsız iki sınır
// seçildi: gardıropta tutulabilecek parça sayısı ve kayıtlı kombin sayısı.
const FREE_LIMITS = {
  clothingItems: 30,
  outfits: 10,
}

function isPremium(user) {
  return user?.subscription_tier === 'premium'
}

module.exports = { FREE_LIMITS, isPremium }
