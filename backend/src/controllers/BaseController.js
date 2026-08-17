const { AppError } = require('../utils/errors')

// Tüm controller'ların paylaştığı hata çevirme mantığı.
// Tipli hatalar (AppError türevleri) kendi statusCode'unu taşır;
// beklenmeyen her şey (veritabanı hataları dahil) 500'e düşer.
class BaseController {
  handleError(error, res) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message })
      return
    }

    console.error(`${this.constructor.name} hatası:`, error)
    res.status(500).json({ error: 'Sunucu hatası' })
  }
}

module.exports = BaseController
