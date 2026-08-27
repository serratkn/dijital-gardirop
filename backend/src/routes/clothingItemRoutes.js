const { Router } = require('express')
const multer = require('multer')
const pool = require('../config/database')
const { uploadImage, MAX_FILE_SIZE } = require('../config/upload')
const { geminiLimiter } = require('../middleware/rateLimiters')
const ClothingItemRepository = require('../repositories/ClothingItemRepository')
const CategoryRepository = require('../repositories/CategoryRepository')
const UserRepository = require('../repositories/UserRepository')
const StorageRepository = require('../repositories/StorageRepository')
const ClothingItemService = require('../services/ClothingItemService')
const VectorRepository = require('../repositories/VectorRepository')
const ClothingAnalysisService = require('../services/ClothingAnalysisService')
const VectorService = require('../services/VectorService')
const GeminiService = require('../services/GeminiService')
const ClothingItemController = require('../controllers/ClothingItemController')

const clothingItemRepository = new ClothingItemRepository(pool)
// StorageRepository (Cloudflare R2) üçüncü bağımlılık: R2_* env değişkenleri
// tanımlı değilse `isConfigured` false döner ve fotoğraflar eskisi gibi
// yalnızca yerel diske yazılır — bkz. §8 "Fotoğraf depolama".
const storageRepository = new StorageRepository()
// UserRepository ikinci bağımlılık: ücretsiz plan sınırını kontrol etmek için
// (bkz. ClothingItemService > #assertUnderItemLimit, config/plans.js).
const clothingItemService = new ClothingItemService(
  clothingItemRepository,
  new UserRepository(pool),
  storageRepository,
)

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
  storageRepository,
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
// Yeniden analiz: mevcut ai_analysis'in üzerine yazar. Fotoğraf yüklemenin
// yan etkisi olan otomatik analizden farklı olarak SENKRONDUR — kullanıcı
// düğmeye basıp sonucu bekliyor (bkz. ClothingItemController.reanalyze).
// geminiLimiter: gerçek para harcayan bir çağrı; in-flight muhafızı yalnızca
// AYNI ANDA gelen ikinci isteği engeller, ardışık istekleri değil.
router.post('/clothing-items/:id/analyze', geminiLimiter, (req, res) =>
  clothingItemController.reanalyze(req, res),
)
// AŞAMA 3 doğrulama ucu — hiçbir ürün akışına bağlı değil (elle inceleme için).
router.get('/clothing-items/:id/similar', (req, res) =>
  clothingItemController.getSimilar(req, res),
)
// AŞAMA 4 — Kombin Öner sayfasının akıllı eşleştirme ucu. Bir başlangıç
// parçasına, istenen DİĞER kategorilerden en yakın adayları döndürür.
router.get('/clothing-items/:id/companions', (req, res) =>
  clothingItemController.getCompanions(req, res),
)
// AŞAMA 5 — serbest metin (mood) yorumlamasının ikinci retrieval ucu. Bir
// başlangıç PARÇASI değil, kullanıcının kendi cümlesini (arama_metni) alır;
// bu yüzden `/clothing-items/:id/...` desenine UYMAZ, kendi düz yoludur.
// geminiLimiter: HER ÇAĞRIDA gerçek bir Gemini embedding isteği atar
// (getSimilar/getCompanions atmaz, yalnızca Chroma okur).
router.post('/clothing-items/search-by-text', geminiLimiter, (req, res) =>
  clothingItemController.searchByText(req, res),
)

module.exports = router
