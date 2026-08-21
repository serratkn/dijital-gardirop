// Gemini entegrasyonu — AŞAMA 1 testleri.
// POST /api/gemini/test-analyze ucunu ve GeminiService'i doğrular.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-gemini.js
//   node test-scripts/test-gemini.js --image ../yol/kiyafet.jpg
//
// Görsel verilmezse uploads/ içindeki EN BÜYÜK dosya kullanılır (gerçek kıyafet
// fotoğrafları oradadır). Klasör boşsa script bunu söyleyip HTTP bölümünü atlar.
//
// Bölüm 1 (servis) GEÇERLİ ANAHTAR OLMADAN da çalışır: eksik/geçersiz anahtar
// yollarını sürer. Bölüm 2 gerçek bir anahtar ve çalışan sunucu ister.

const path = require('node:path')
const fs = require('node:fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`
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

async function call(method, endpoint, { body, token } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(BASE_URL + endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  return { status: response.status, data }
}

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

async function uploadForAnalysis(token, imagePath) {
  const buffer = fs.readFileSync(imagePath)
  const mime = MIME_BY_EXT[path.extname(imagePath).toLowerCase()] || 'image/png'

  const form = new FormData()
  form.append('image', new Blob([buffer], { type: mime }), path.basename(imagePath))

  const response = await fetch(`${BASE_URL}/gemini/test-analyze`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: response.status, data }
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

async function main() {
  console.log(`Hedef: ${BASE_URL}\n`)

  // ============ BÖLÜM 1 — Servis (sunucu ve geçerli anahtar gerekmez) ============
  console.log('1) GeminiService — anahtar yolları')

  const GeminiService = require('../src/services/GeminiService')
  const service = new GeminiService()
  const realKey = process.env.GEMINI_API_KEY

  // a) Görsel gönderilmediyse 400
  try {
    await service.analyzeClothingImage(null)
    check('görselsiz istek reddedildi', false, 'hata fırlatmadı')
  } catch (error) {
    check('görselsiz istek 400 ValidationError', error.statusCode === 400, `${error.statusCode} — ${error.message}`)
  }

  const fakeFile = { buffer: Buffer.from('sahte'), mimetype: 'image/png' }

  // b) Anahtar YOKSA: 503 ve açıklayıcı mesaj (500 DEĞİL)
  delete process.env.GEMINI_API_KEY
  try {
    await service.analyzeClothingImage(fakeFile)
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
    await service.analyzeClothingImage(fakeFile)
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

  // ============ BÖLÜM 2 — HTTP ucu ============
  console.log('\n2) POST /gemini/test-analyze — yetkilendirme')

  const email = `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const registered = await call('POST', '/auth/register', {
    body: { name: 'Gemini Test', email, password: 'GucluSifre123' },
  })
  if (registered.status !== 201) {
    throw new Error(`Test kullanıcısı oluşturulamadı: ${JSON.stringify(registered.data)}`)
  }
  const { token, user } = registered.data

  const imagePath = resolveImagePath()

  // Token'sız istek reddedilmeli (uç korumalı)
  if (imagePath) {
    const anonymous = await uploadForAnalysis(null, imagePath)
    check('token olmadan 401', anonymous.status === 401, `gelen: ${anonymous.status}`)
  }

  // Dosyasız istek → 400
  const noFile = await fetch(`${BASE_URL}/gemini/test-analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: new FormData(),
  })
  check('dosyasız istek 400', noFile.status === 400, `gelen: ${noFile.status}`)

  // Görsel olmayan dosya → 400 (fileFilter)
  const badForm = new FormData()
  badForm.append('image', new Blob([Buffer.from('bu bir metin')], { type: 'text/plain' }), 'a.txt')
  const badType = await fetch(`${BASE_URL}/gemini/test-analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: badForm,
  })
  check('geçersiz dosya tipi 400', badType.status === 400, `gelen: ${badType.status}`)

  // --- Gerçek analiz ---
  console.log('\n3) Gerçek kıyafet fotoğrafıyla analiz')

  if (!imagePath) {
    console.log('   ! uploads/ içinde görsel yok — analiz bölümü atlandı.')
    console.log('     Belirli bir dosyayla denemek için: --image <yol>')
  } else if (!process.env.GEMINI_API_KEY) {
    console.log('   ! GEMINI_API_KEY tanımlı değil — analiz bölümü atlandı.')
    console.log('     Anahtarsız davranış birinci bölümde zaten doğrulandı.')
  } else {
    console.log(`   görsel: ${path.basename(imagePath)}`)
    const started = Date.now()
    const result = await uploadForAnalysis(token, imagePath)
    const elapsed = Date.now() - started

    check('HTTP 200', result.status === 200, `gelen: ${result.status} ${JSON.stringify(result.data).slice(0, 120)}`)

    if (result.status === 200) {
      const { model, analysis, raw } = result.data
      check('yanıtta model adı var', isNonEmptyString(model), model)
      check('yanıtta ham metin var', isNonEmptyString(raw))
      check('analysis bir nesne', analysis && typeof analysis === 'object' && !Array.isArray(analysis))

      // İstenen üç alan: kategori, renk, stil
      check('kategori alanı dolu', isNonEmptyString(analysis?.kategori), String(analysis?.kategori))
      check('renk alanı dolu', isNonEmptyString(analysis?.renk), String(analysis?.renk))
      check('stil alanı dolu', isNonEmptyString(analysis?.stil), String(analysis?.stil))

      // "Mantıklı cevap": alanlar kısa etiketler olmalı, paragraf değil;
      // ayrıca modelin hata metni döndürmediğini doğrular.
      const sane = (v) => isNonEmptyString(v) && v.trim().length <= 60
      check(
        'değerler makul uzunlukta etiketler',
        sane(analysis?.kategori) && sane(analysis?.renk) && sane(analysis?.stil),
        `kategori=${analysis?.kategori} | renk=${analysis?.renk} | stil=${analysis?.stil}`,
      )

      // Ham yanıt gerçekten JSON olmalı (markdown çiti kalmamalı)
      check('ham yanıt markdown çiti içermiyor', !String(raw).trim().startsWith('```'))

      check('yanıt süresi makul (<30sn)', elapsed < 30000, `${(elapsed / 1000).toFixed(1)} sn`)

      console.log(`\n   → Gemini yanıtı: ${JSON.stringify(analysis)}`)
    }
  }

  // --- Temizlik ---
  console.log('\n4) Temizlik')
  const deleted = await call('DELETE', `/users/${user.id}`, { token })
  check('test hesabı silindi', deleted.status === 204, `${deleted.status}`)

  // Analiz görselleri BELLEKTE işlenir; uploads/ altına yazılmamalı.
  const uploadCountAfter = fs.existsSync(UPLOAD_DIR)
    ? fs.readdirSync(UPLOAD_DIR).filter((n) => MIME_BY_EXT[path.extname(n).toLowerCase()]).length
    : 0
  console.log(`   uploads/ içindeki görsel sayısı: ${uploadCountAfter} (analiz dosya YAZMAZ)`)

  console.log('\n' + '='.repeat(46))
  console.log(`BAŞARILI: ${passed}   BAŞARISIZ: ${failed}`)
  console.log('='.repeat(46))

  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  if (error.cause?.code === 'ECONNREFUSED') {
    console.error(`\nHATA: ${BASE_URL} adresine bağlanılamadı.`)
    console.error('Sunucu çalışmıyor olabilir — backend/ klasöründe "npm run dev" ile başlatın.')
  } else {
    console.error('\nHATA:', error.message)
  }
  process.exitCode = 1
})
