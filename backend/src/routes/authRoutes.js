const { Router } = require('express')
const AuthController = require('../controllers/AuthController')
const { authLimiter } = require('../middleware/rateLimiters')

// Diğer route dosyalarından farklı olarak bu bir fabrikadır: authService ve
// authenticate middleware'i tüm uygulamada TEK örnek olmalı, o yüzden
// server.js'te kurulup buraya geçilir.
function createAuthRoutes(authService, authenticate) {
  const authController = new AuthController(authService)
  const router = Router()

  // Korumasız — oturum açmak için gereken uçlar. authLimiter: brute-force /
  // otomatik kayıt denemelerine karşı (15 dakikada 5 deneme, IP bazlı).
  router.post('/auth/register', authLimiter, (req, res) => authController.register(req, res))
  router.post('/auth/login', authLimiter, (req, res) => authController.login(req, res))
  // /auth/refresh de KORUMASIZDIR (bilerek): tam olarak bu uca gelindiğinde
  // access token ZATEN SÜRESİ DOLMUŞ olur — authenticate'in arkasına
  // konsaydı kullanıcı hiç buraya ulaşamazdı. authLimiter'ı diğer kimlik
  // bilgisi değişim uçlarıyla (register/login) AYNI gerekçeyle paylaşır;
  // normal kullanımda (tek sekme, sessiz yenileme) bu limite hiç yaklaşılmaz.
  router.post('/auth/refresh', authLimiter, (req, res) => authController.refresh(req, res))
  // "Şifremi Unuttum" akışı — İKİSİ DE korumasız (kullanıcı henüz giriş
  // yapamıyor) ve authLimiter'ın ARKASINDA: aksi hâlde bir saldırgan aynı
  // e-postaya saniyede onlarca sıfırlama e-postası tetikleyebilir (spam) ya
  // da farklı e-postaları deneyip yanıt farkına bakarak (timing/hata) hangi
  // e-postaların kayıtlı olduğunu anlamaya çalışabilirdi.
  router.post('/auth/forgot-password', authLimiter, (req, res) =>
    authController.forgotPassword(req, res),
  )
  router.post('/auth/reset-password', authLimiter, (req, res) =>
    authController.resetPassword(req, res),
  )

  // Korumalı
  router.get('/auth/me', authenticate, (req, res) => authController.me(req, res))
  router.post('/auth/change-password', authenticate, (req, res) =>
    authController.changePassword(req, res),
  )
  // Gerçek çıkış: refresh token'ı DB'den siler. authenticate ARKASINDA —
  // kimliği req.userId'den okur, body'de ayrıca bir refresh token istemez.
  router.post('/auth/logout', authenticate, (req, res) => authController.logout(req, res))

  return router
}

module.exports = createAuthRoutes
