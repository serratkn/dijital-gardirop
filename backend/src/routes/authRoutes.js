const { Router } = require('express')
const AuthController = require('../controllers/AuthController')

// Diğer route dosyalarından farklı olarak bu bir fabrikadır: authService ve
// authenticate middleware'i tüm uygulamada TEK örnek olmalı, o yüzden
// server.js'te kurulup buraya geçilir.
function createAuthRoutes(authService, authenticate) {
  const authController = new AuthController(authService)
  const router = Router()

  // Korumasız — oturum açmak için gereken uçlar
  router.post('/auth/register', (req, res) => authController.register(req, res))
  router.post('/auth/login', (req, res) => authController.login(req, res))

  // Korumalı
  router.get('/auth/me', authenticate, (req, res) => authController.me(req, res))
  router.post('/auth/change-password', authenticate, (req, res) =>
    authController.changePassword(req, res),
  )

  return router
}

module.exports = createAuthRoutes
