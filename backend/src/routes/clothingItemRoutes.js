const { Router } = require('express')
const multer = require('multer')
const pool = require('../config/database')
const { uploadImage, MAX_FILE_SIZE } = require('../config/upload')
const ClothingItemRepository = require('../repositories/ClothingItemRepository')
const ClothingItemService = require('../services/ClothingItemService')
const ClothingItemController = require('../controllers/ClothingItemController')

const clothingItemRepository = new ClothingItemRepository(pool)
const clothingItemService = new ClothingItemService(clothingItemRepository)
const clothingItemController = new ClothingItemController(clothingItemService)

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
router.post('/clothing-items/:id/image', handleUpload, (req, res) =>
  clothingItemController.uploadImage(req, res),
)
router.delete('/clothing-items/:id/image', (req, res) =>
  clothingItemController.deleteImage(req, res),
)

module.exports = router
