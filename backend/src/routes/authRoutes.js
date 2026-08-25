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

  // Korumalı
  router.get('/auth/me', authenticate, (req, res) => authController.me(req, res))
  router.post('/auth/change-password', authenticate, (req, res) =>
    authController.changePassword(req, res),
  )

  return router
}

module.exports = createAuthRoutes
