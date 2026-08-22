const { Router } = require('express')
const multer = require('multer')
const pool = require('../config/database')
const { uploadImage, MAX_FILE_SIZE } = require('../config/upload')
const ClothingItemRepository = require('../repositories/ClothingItemRepository')
const CategoryRepository = require('../repositories/CategoryRepository')
const ClothingItemService = require('../services/ClothingItemService')
const VectorRepository = require('../repositories/VectorRepository')
const ClothingAnalysisService = require('../services/ClothingAnalysisService')
const VectorService = require('../services/VectorService')
const GeminiService = require('../services/GeminiService')
const ClothingItemController = require('../controllers/ClothingItemController')

const clothingItemRepository = new ClothingItemRepository(pool)
const clothingItemService = new ClothingItemService(clothingItemRepository)

const geminiService = new GeminiService()

// Vektör veritabanı (Aşama 3). Yazma yolu asla fırlatmaz; bağlanması fotoğraf
// yükleme akışının davranışını değiştirmez.
const vectorService = new VectorService(
  new VectorRepository(),
  clothingItemRepository,
  geminiService,
)

// Otomatik Gemini analizi (Aşama 2). Kategori adı prompt'u belirlediği için
// CategoryRepository de bağlanır. Analiz servisi ASLA fırlatmaz; bağlanması
// fotoğraf yükleme akışının davranışını değiştirmez.
// vectorService dördüncü bağımlılık: analiz tamamlanınca embedding de üretilir.
const clothingAnalysisService = new ClothingAnalysisService(
  clothingItemRepository,
  new CategoryRepository(pool),
  geminiService,
  vectorService,
)

const clothingItemController = new ClothingItemController(
  clothingItemService,
  clothingAnalysisService,
  vectorService,
)

const router = Router()

// Multer hataları (boyut aşımı, geçersiz tip) varsayılan olarak 500'e düşer.
// Bunları anlamlı 400'lere çeviriyoruz.
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

router.get('/clothing-items', (req, res) => clothingItemController.getAll(req, res))
router.get('/clothing-items/:id', (req, res) => clothingItemController.getById(req, res))
router.post('/clothing-items', (req, res) => clothingItemController.create(req, res))
router.put('/clothing-items/:id', (req, res) => clothingItemController.update(req, res))
router.delete('/clothing-items/:id', (req, res) => clothingItemController.delete(req, res))
router.patch('/clothing-items/:id/favorite', (req, res) => clothingItemController.toggleFavorite(req, res))
router.patch('/clothing-items/:id/clean-status', (req, res) =>
  clothingItemController.toggleCleanStatus(req, res),
)
router.post('/clothing-items/:id/image', handleUpload, (req, res) =>
  clothingItemController.uploadImage(req, res),
)
router.delete('/clothing-items/:id/image', (req, res) =>
  clothingItemController.deleteImage(req, res),
)
// AŞAMA 3 doğrulama ucu — henüz hiçbir ürün akışına bağlı değil.
router.get('/clothing-items/:id/similar', (req, res) =>
  clothingItemController.getSimilar(req, res),
)

module.exports = router
