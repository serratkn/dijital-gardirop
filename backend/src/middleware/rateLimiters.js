const rateLimit = require('express-rate-limit')

// LOOPBACK'ten (127.0.0.1/::1) gelen istekler authLimiter'dan MUAF tutulur.
// Bu bir güvenlik açığı DEĞİLDİR: bir saldırgan TCP/IP'nin doğası gereği
// bağlantısının kaynak adresini UZAKTAN 127.0.0.1 olarak sahtele(ye)mez —
// yalnızca sunucunun KENDİSİNDEN atılan istekler bu adresi taşır. Muafiyet
// olmadan bu depodaki test scriptleri (aynı makineden onlarca hesap
// oluşturuyor, ör. test-all-endpoints.js tek başına 6 kayıt atıyor) birkaç
// dakika içinde birbirinin kotasını tüketip regresyon paketini kırardı.
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
function isLoopback(req) {
  return LOOPBACK_ADDRESSES.has(req.ip)
}

// Kimlik doğrulama denemeleri — IP bazlı (henüz kimliği doğrulanmış bir
// kullanıcı yok, req.userId mevcut değil). Sıkı tutuluyor: bu uçlar tam olarak
// brute-force/kimlik bilgisi denemesi hedefidir. 15 dakikada 5 deneme.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoopback,
  message: { error: 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.' },
})

// Gemini çağıran uçlar (yeniden analiz, ten tonu analizi) — GERÇEK PARA
// harcıyor. Mevcut in-flight muhafızları yalnızca AYNI ANDA gelen ikinci
// isteği engeller (409); bu limiter ardışık/sıralı istekleri de sınırlar.
// req.userId'ye göre anahtarlanır (bu uçlar zaten authenticate'in ARKASINDA
// mount edilir, yani req.userId her zaman dolu) — IP bazlı olsaydı aynı ağın
// arkasındaki farklı kullanıcılar birbirinin kotasını paylaşırdı.
//
// authLimiter'ın AKSİNE loopback MUAFİYETİ YOK: buradaki amaç uzak bir
// saldırgandan korunmak değil, gerçek parayla sınırlı günlük Gemini kotasını
// korumaktır — bu tehdit sunucunun KENDİSİNDEN (yerel bir script/otomasyon)
// gelse de aynen geçerlidir. Kullanıcı bazlı anahtarlama zaten test
// scriptlerinin (her biri kendi taze kullanıcısını oluşturur) bu limite
// takılmasını önlüyor; ayrıca bir muafiyete gerek kalmadı.
const geminiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  message: { error: 'Çok fazla analiz isteği yapıldı. Lütfen bir süre sonra tekrar deneyin.' },
})

module.exports = { authLimiter, geminiLimiter }
