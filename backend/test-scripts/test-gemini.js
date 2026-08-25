// Gemini entegrasyonu — AŞAMA 1 testleri: GeminiService'in anahtar/bağlantı
// yollarını doğrular.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-gemini.js
//   node test-scripts/test-gemini.js --image ../yol/kiyafet.jpg
//
// NOT (2026-08-24): `POST /gemini/test-analyze` ucu KALDIRILDI (kullanılmayan
// bir teşhis ucuydu, ürün akışı zaten otomatik analizdir). Bu script artık
// SUNUCUYA HİÇ HTTP İSTEĞİ ATMAZ — GeminiService'i DOĞRUDAN çağırır. Anahtar/
// hata-çevirisi yolları `analyzeClothingItem()` üzerinden sınanır (Aşama 2'nin
// gerçek, hâlâ kullanılan metodu); bu metod, kaldırılan ucun kullandığı
// `#generate()` özel yardımcısını AYNI ŞEKİLDE çağırır, yani doğrulanan
// davranış (anahtar yok → 503, geçersiz anahtar → 503, ham SDK hatası
// sızmıyor) birebir korunur.
//
// Görsel verilmezse uploads/ içindeki EN BÜYÜK dosya kullanılır (gerçek kıyafet
// fotoğrafları oradadır). Klasör boşsa gerçek analiz bölümü atlanır.
//
// Anahtar/hata yolları GEÇERLİ BİR ANAHTAR OLMADAN da çalışır. Gerçek analiz
// bölümü (Bölüm 2) çalışan bir GEMINI_API_KEY ister.

const path = require('node:path')
const fs = require('node:fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`   ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`   ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

const MIME_BY_EXT = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

// Argümanla verilen görsel; yoksa uploads/ içindeki en büyük görsel.
// En büyüğü seçiyoruz çünkü gerçek fotoğraflar, testlerin ürettiği küçük
// örneklerden belirgin biçimde büyüktür.
function resolveImagePath() {
  const flagIndex = process.argv.indexOf('--image')
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return path.resolve(process.argv[flagIndex + 1])
  }

  if (!fs.existsSync(UPLOAD_DIR)) return null
  const candidates = fs
    .readdirSync(UPLOAD_DIR)
    .filter((name) => MIME_BY_EXT[path.extname(name).toLowerCase()])
    .map((name) => ({ name, size: fs.statSync(path.join(UPLOAD_DIR, name)).size }))
    .sort((a, b) => b.size - a.size)

  return candidates.length ? path.join(UPLOAD_DIR, candidates[0].name) : null
}

function toFile(imagePath) {
  const buffer = fs.readFileSync(imagePath)
  const mimetype = MIME_BY_EXT[path.extname(imagePath).toLowerCase()] || 'image/png'
  return { buffer, mimetype }
}

async function main() {
  const GeminiService = require('../src/services/GeminiService')
  const service = new GeminiService()
  const realKey = process.env.GEMINI_API_KEY

  // ============ BÖLÜM 1 — anahtar/hata yolları (anahtar GEREKMEZ) ============
  console.log('1) GeminiService — anahtar yolları')

  // a) Görsel gönderilmediyse 400
  try {
    await service.analyzeClothingItem(null, 'Üst')
    check('görselsiz istek reddedildi', false, 'hata fırlatmadı')
  } catch (error) {
    check('görselsiz istek 400 ValidationError', error.statusCode === 400, `${error.statusCode} — ${error.message}`)
  }

  const fakeFile = { buffer: Buffer.from('sahte'), mimetype: 'image/png' }

  // b) Anahtar YOKSA: 503 ve açıklayıcı mesaj (500 DEĞİL)
  delete process.env.GEMINI_API_KEY
  try {
    await service.analyzeClothingItem(fakeFile, 'Üst')
    check('anahtarsız istek reddedildi', false, 'hata fırlatmadı')
  } catch (error) {
    check('anahtarsız → 503 (500 değil)', error.statusCode === 503, `${error.statusCode}`)
    check(
      'mesaj anahtarın eksik olduğunu söylüyor',
      /GEMINI_API_KEY/.test(error.message),
      error.message,
    )
  }

  // c) GEÇERSİZ anahtar: gerçekten Gemini'ye gidip reddedilmeli, yine 503
  process.env.GEMINI_API_KEY = 'gecersiz-anahtar-test-icin-123'
  try {
    await service.analyzeClothingItem(fakeFile, 'Üst')
    check('geçersiz anahtar reddedildi', false, 'hata fırlatmadı')
  } catch (error) {
    check('geçersiz anahtar → 503 (500 değil)', error.statusCode === 503, `${error.statusCode}`)
    check(
      'mesaj Türkçe ve açıklayıcı',
      isNonEmptyString(error.message) && /Gemini/.test(error.message),
      error.message,
    )
    check(
      'ham SDK hatası / yığın izi sızmıyor',
      !/at\s+\w+|node_modules|GoogleGenAI/.test(error.message),
      error.message.slice(0, 80),
    )
  }

  // Anahtarı geri koy
  if (realKey) process.env.GEMINI_API_KEY = realKey
  else delete process.env.GEMINI_API_KEY

  // ============ BÖLÜM 2 — gerçek kıyafet fotoğrafıyla analiz ============
  console.log('\n2) Gerçek kıyafet fotoğrafıyla analiz (GeminiService doğrudan)')

  const imagePath = resolveImagePath()

  if (!imagePath) {
    console.log('   ! uploads/ içinde görsel yok — analiz bölümü atlandı.')
    console.log('     Belirli bir dosyayla denemek için: --image <yol>')
  } else if (!process.env.GEMINI_API_KEY) {
    console.log('   ! GEMINI_API_KEY tanımlı değil — analiz bölümü atlandı.')
    console.log('     Anahtarsız davranış birinci bölümde zaten doğrulandı.')
  } else {
    console.log(`   görsel: ${path.basename(imagePath)}`)
    const started = Date.now()
    let result
    let error
    try {
      result = await service.analyzeClothingItem(toFile(imagePath), 'Üst')
    } catch (caught) {
      error = caught
    }
    const elapsed = Date.now() - started

    check('Analiz başarıyla döndü (hata fırlatmadı)', Boolean(result), error?.message)

    if (result) {
      check('yanıtta model adı var', isNonEmptyString(result.model), result.model)
      check('yanıtta şema anahtarı var', isNonEmptyString(result.sema), result.sema)
      check('veri bir nesne', result.veri && typeof result.veri === 'object')

      // Giyim şemasının temel alanları: kategori, renk, stil
      check('alt_kategori alanı dolu', isNonEmptyString(result.veri?.alt_kategori), String(result.veri?.alt_kategori))
      check('renk alanı dolu', isNonEmptyString(result.veri?.renk), String(result.veri?.renk))
      check('stil alanı dolu', isNonEmptyString(result.veri?.stil), String(result.veri?.stil))

      // "Mantıklı cevap": alanlar kısa etiketler olmalı, paragraf değil.
      const sane = (v) => isNonEmptyString(v) && v.trim().length <= 120
      check(
        'değerler makul uzunlukta etiketler',
        sane(result.veri?.alt_kategori) && sane(result.veri?.renk) && sane(result.veri?.stil),
        `alt_kategori=${result.veri?.alt_kategori} | renk=${result.veri?.renk} | stil=${result.veri?.stil}`,
      )

      check('yanıt süresi makul (<30sn)', elapsed < 30000, `${(elapsed / 1000).toFixed(1)} sn`)

      console.log(`\n   → Gemini yanıtı: ${JSON.stringify(result.veri)}`)
    }

    // Analiz görselleri BELLEKTE işlenir; uploads/ altına yeni dosya yazılmaz.
    const uploadCountAfter = fs.existsSync(UPLOAD_DIR)
      ? fs.readdirSync(UPLOAD_DIR).filter((n) => MIME_BY_EXT[path.extname(n).toLowerCase()]).length
      : 0
    console.log(`   uploads/ içindeki görsel sayısı: ${uploadCountAfter} (analiz dosya YAZMAZ)`)
  }

  console.log('\n' + '='.repeat(46))
  console.log(`BAŞARILI: ${passed}   BAŞARISIZ: ${failed}`)
  console.log('='.repeat(46))

  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('\nHATA:', error.message)
  process.exitCode = 1
})
