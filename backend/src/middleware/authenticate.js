const { AppError } = require('../utils/errors')

// Authorization: Bearer <token> başlığını doğrulayıp req.userId'yi doldurur.
// Bundan sonraki katmanlar kullanıcı kimliğini İSTEKTEN (query/body) değil,
// yalnızca buradan alır — aksi hâlde bir kullanıcı başkasının userId'sini
// göndererek onun verisine erişebilirdi.
function createAuthenticate(authService) {
  return function authenticate(req, res, next) {
    try {
      const header = req.headers.authorization || ''
      const [scheme, token] = header.split(' ')

      if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ error: 'Oturum açmanız gerekiyor' })
      }

      const payload = authService.verifyToken(token)
      req.userId = payload.sub
      req.userEmail = payload.email
      next()
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message })
      }

      console.error('authenticate hatası:', error)
      res.status(500).json({ error: 'Sunucu hatası' })
    }
  }
}

module.exports = createAuthenticate
