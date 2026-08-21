const { Router } = require('express')
const multer = require('multer')
const { uploadImageToMemory, MAX_FILE_SIZE } = require('../config/upload')
const GeminiService = require('../services/GeminiService')
const GeminiController = require('../controllers/GeminiController')

// GEÇİCİ — AŞAMA 1 (proof of concept).
// Bu uç yalnızca Gemini bağlantısının çalıştığını kanıtlamak içindir; kalıcı bir
// ürün özelliği DEĞİLDİR. Otomatik kıyafet analizi gerçek akışlara bağlanınca
// (sonraki aşamalar) bu rota kaldırılmalı ya da yerini asıl uca bırakmalıdır.

const geminiService = new GeminiService()
const geminiController = new GeminiController(geminiService)

const router = Router()

// Multer hataları varsayılan olarak 500'e düşer; anlamlı 400'lere çeviriyoruz.
// (clothingItemRoutes'taki handleUpload ile aynı kalıp — tek fark, burada
// dosya diske yazılmaz, bellekte tutulur.)
function handleUpload(req, res, next) {
  uploadImageToMemory.single('image')(req, res, (error) => {
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

router.post('/gemini/test-analyze', handleUpload, (req, res) =>
  geminiController.testAnalyze(req, res),
)

module.exports = router
