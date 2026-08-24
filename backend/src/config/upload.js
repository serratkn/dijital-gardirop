const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const multer = require('multer')

// Yüklenen dosyalar repo dışında tutulur (.gitignore), klasör .gitkeep ile korunur.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads')

// Selfie'ler AYRI bir alt klasörde tutulur — kıyafet fotoğraflarının aksine
// bu dosyalar `/uploads` static middleware'inden BİLEREK dışlanır (server.js)
// ve yalnızca token'lı GET /users/skin-tone-analysis/photo ile okunabilir.
// Fiziksel ayrım tek başına yeterli bir koruma değildir (server.js'teki
// engelleme asıl güvence), ama iki dosya türünü karıştırmamak ve ayrı bir
// dizini tek satırda tamamen "hariç tut"abilmek için ayrı tutuluyor.
const SELFIE_UPLOAD_DIR = path.join(UPLOAD_DIR, 'selfies')

// Sunucu açılışında klasörlerin var olduğundan emin ol; yoksa ilk yüklemede patlar.
fs.mkdirSync(UPLOAD_DIR, { recursive: true })
fs.mkdirSync(SELFIE_UPLOAD_DIR, { recursive: true })

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, UPLOAD_DIR),
  filename: (req, file, callback) => {
    // Orijinal ad KULLANILMAZ: path traversal ve isim çakışması riskini
    // tamamen ortadan kaldırmak için rastgele UUID + izin verilen uzantı.
    const extension = ALLOWED_MIME_TYPES[file.mimetype] || ''
    callback(null, `${crypto.randomUUID()}${extension}`)
  },
})

function fileFilter(req, file, callback) {
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    // Hata multer'a iletilir; route katmanı bunu 400'e çevirir.
    const error = new Error('Yalnızca jpg, png ve webp dosyaları yüklenebilir')
    error.code = 'INVALID_FILE_TYPE'
    return callback(error)
  }
  callback(null, true)
}

const uploadImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
})

// Selfie'ler için AYRI diskStorage — tek fark hedef klasör (SELFIE_UPLOAD_DIR).
// Aynı fileFilter, aynı boyut sınırı, aynı rastgele UUID adlandırması.
const selfieStorage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, SELFIE_UPLOAD_DIR),
  filename: (req, file, callback) => {
    const extension = ALLOWED_MIME_TYPES[file.mimetype] || ''
    callback(null, `${crypto.randomUUID()}${extension}`)
  },
})

const uploadSelfieImage = multer({
  storage: selfieStorage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
})

// BELLEKTE tutan varyant: dosyayı diske YAZMAZ, `req.file.buffer` verir.
// Gemini analizi gibi "oku, kullan, at" akışları içindir — diskStorage
// kullanılsaydı analiz edilen her görsel uploads/ altında hiçbir kaydın
// referans vermediği öksüz bir dosya olarak kalırdı.
// Aynı fileFilter ve boyut sınırını paylaşır.
const uploadImageToMemory = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
})

// Diskteki dosyayı sessizce siler. Dosya yoksa hata fırlatmaz —
// silme işlemleri idempotent olmalı. YALNIZCA UPLOAD_DIR KÖKÜ içindir
// (kıyafet fotoğrafları); selfie'ler için removeSelfieFile kullanılır.
async function removeUploadedFile(fileName) {
  if (!fileName) return

  try {
    await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(fileName)))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Dosya silinemedi:', fileName, error.message)
    }
  }
}

// removeUploadedFile'ın selfie karşılığı — SELFIE_UPLOAD_DIR'den siler.
// AYRI bir fonksiyon olarak tutuldu (tek bir "dizin parametresi" eklemek
// yerine): çağıran yer hangi dosya türünü sildiğini isim düzeyinde görsün,
// bir kıyafet silme çağrısının yanlışlıkla selfie dizinine (ya da tersi)
// bakması ihtimalini tamamen ortadan kaldırsın.
async function removeSelfieFile(fileName) {
  if (!fileName) return

  try {
    await fs.promises.unlink(path.join(SELFIE_UPLOAD_DIR, path.basename(fileName)))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Selfie dosyası silinemedi:', fileName, error.message)
    }
  }
}

// Bir selfie dosya adının SELFIE_UPLOAD_DIR içindeki MUTLAK yolu.
// path.basename ile path traversal engellenir (yalnızca dosya adı kullanılır,
// içindeki '/' veya '..' segmentleri atılır).
function resolveSelfiePath(fileName) {
  return path.join(SELFIE_UPLOAD_DIR, path.basename(fileName))
}

// Uzantıdan MIME tipi. Diskteki bir dosyayı yeniden okuyup Gemini'ye
// göndermek için gerekir (arka plan analizi): orada multer'ın verdiği
// file.mimetype elimizde olmaz, yalnızca dosya adı vardır.
const EXT_TO_MIME = Object.fromEntries(
  Object.entries(ALLOWED_MIME_TYPES).map(([mime, ext]) => [ext, mime]),
)

function mimeTypeFromFileName(fileName) {
  if (!fileName) return null
  return EXT_TO_MIME[path.extname(fileName).toLowerCase()] || null
}

// image_url "/uploads/abc.jpg" biçiminde saklanır; diskteki adı çıkarır.
function fileNameFromImageUrl(imageUrl) {
  if (!imageUrl) return null
  return path.basename(imageUrl)
}

module.exports = {
  UPLOAD_DIR,
  SELFIE_UPLOAD_DIR,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  uploadImage,
  uploadImageToMemory,
  uploadSelfieImage,
  removeUploadedFile,
  removeSelfieFile,
  resolveSelfiePath,
  fileNameFromImageUrl,
  mimeTypeFromFileName,
}
