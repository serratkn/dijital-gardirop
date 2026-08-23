const { Router } = require('express')
const multer = require('multer')
const pool = require('../config/database')
const { uploadImage, MAX_FILE_SIZE } = require('../config/upload')
const UserRepository = require('../repositories/UserRepository')
const GeminiService = require('../services/GeminiService')
const SkinToneService = require('../services/SkinToneService')
const SkinToneController = require('../controllers/SkinToneController')

const skinToneService = new SkinToneService(new UserRepository(pool), new GeminiService())
const skinToneController = new SkinToneController(skinToneService)

const router = Router()

// Multer hataları (boyut aşımı, geçersiz tip) varsayılan olarak 500'e düşer;
// anlamlı 400'lere çevriliyor (clothingItemRoutes ile aynı kalıp).
function handleUpload(req, res, next) {
  uploadImage.single('image')(req, res, (error) => {
    if (!error) return next()

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        const limitMb = Math.round(MAX_FILE_SIZE / (1024 * 1024))
        return res.status(400).json({ error: `Fotoğraf en fazla ${limitMb} MB olabilir` })
      }
      return res.status(400).json({ error: `Dosya yüklenemedi: ${error.message}` })
    }

    if (error.code === 'INVALID_FILE_TYPE') {
      return res.status(400).json({ error: error.message })
    }

    console.error('Beklenmeyen yükleme hatası:', error)
    res.status(500).json({ error: 'Sunucu hatası' })
  })
}

// DİKKAT — BU ROUTER, userRoutes'TAN ÖNCE MOUNT EDİLMELİDİR (bkz. server.js).
// userRoutes'ta `GET /users/:id` var; sonra mount edilseydi Express
// "skin-tone-analysis" metnini bir id sanıp o handler'a düşürürdü.
router.get('/users/skin-tone-analysis', (req, res) => skinToneController.get(req, res))
router.post('/users/skin-tone-analysis', handleUpload, (req, res) =>
  skinToneController.analyze(req, res),
)
router.delete('/users/skin-tone-analysis', (req, res) => skinToneController.remove(req, res))

module.exports = router
