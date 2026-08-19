// Fotoğraf yükleme uçlarını uçtan uca doğrular: tip/boyut kontrolü, sahiplik (403),
// eski dosyanın silinmesi, kıyafet silinince fotoğrafın da silinmesi.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-image-upload.js

const path = require('node:path')
const fs = require('node:fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { UPLOAD_DIR } = require('../src/config/upload')

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`
const ORIGIN = `http://localhost:${process.env.PORT || 3001}`

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

async function upload(itemId, token, { bytes, fileName, contentType }) {
  const form = new FormData()
  form.append('image', new Blob([bytes], { type: contentType }), fileName)

  const response = await fetch(`${BASE_URL}/clothing-items/${itemId}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
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

// Geçerli, çok küçük bir PNG (1x1 saydam piksel)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const email = (tag) => `img-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
const fileExists = (fileName) => fs.existsSync(path.join(UPLOAD_DIR, path.basename(fileName)))

async function main() {
  console.log(`Hedef: ${BASE_URL}\n`)

  // Hesap ve kıyafet hazırla
  const owner = await call('POST', '/auth/register', {
    body: { name: 'Foto Sahibi', email: email('owner'), password: 'GucluSifre123' },
  })
  const ownerToken = owner.data.token
  const item = await call('POST', '/clothing-items', {
    token: ownerToken,
    body: { categoryId: 1, name: 'Fotoğraflı Parça' },
  })
  const itemId = item.data.id
  check('hazırlık: kıyafet oluşturuldu', item.status === 201)
  check('başlangıçta fotoğraf yok', item.data.image_url === null)

  // ---------------- 1. Geçerli yükleme ----------------
  console.log('\n1) Geçerli PNG yükleme')
  const uploaded = await upload(itemId, ownerToken, {
    bytes: TINY_PNG,
    fileName: 'foto.png',
    contentType: 'image/png',
  })
  check('yükleme 200', uploaded.status === 200, JSON.stringify(uploaded.data?.error ?? ''))
  const firstUrl = uploaded.data?.image_url
  check('image_url göreli yol', firstUrl?.startsWith('/uploads/'), firstUrl)
  check('tam URL yazılmamış', !firstUrl?.includes('http'), firstUrl)
  check('dosya adı UUID (orijinal ad değil)', !firstUrl?.includes('foto'), firstUrl)
  check('dosya diskte var', fileExists(firstUrl))

  const served = await fetch(ORIGIN + firstUrl)
  check('statik servis çalışıyor (200)', served.status === 200)
  check('içerik tipi image', served.headers.get('content-type')?.startsWith('image/'),
    served.headers.get('content-type'))

  // ---------------- 2. Doğrulama hataları ----------------
  console.log('\n2) Tip ve boyut doğrulaması')
  const txt = await upload(itemId, ownerToken, {
    bytes: Buffer.from('bu bir metin dosyasi'),
    fileName: 'notlar.txt',
    contentType: 'text/plain',
  })
  check('.txt reddedildi (400, 500 değil)', txt.status === 400, `${txt.status}`)
  check('anlamlı mesaj', String(txt.data?.error).includes('jpg'), txt.data?.error)

  const big = await upload(itemId, ownerToken, {
    bytes: Buffer.alloc(6 * 1024 * 1024, 1),
    fileName: 'buyuk.png',
    contentType: 'image/png',
  })
  check('6 MB reddedildi (400)', big.status === 400, `${big.status}`)
  check('boyut mesajı anlamlı', String(big.data?.error).includes('MB'), big.data?.error)

  const uploadDirBefore = fs.readdirSync(UPLOAD_DIR).length
  check('reddedilen dosyalar diskte kalmadı', uploadDirBefore === 2, `${uploadDirBefore} dosya (.gitkeep + 1 foto)`)

  // ---------------- 3. Değiştirme: eski dosya silinmeli ----------------
  console.log('\n3) Fotoğraf değiştirme')
  const replaced = await upload(itemId, ownerToken, {
    bytes: TINY_PNG,
    fileName: 'yeni.png',
    contentType: 'image/png',
  })
  const secondUrl = replaced.data?.image_url
  check('yeni yükleme 200', replaced.status === 200)
  check('image_url değişti', secondUrl !== firstUrl, secondUrl)
  check('yeni dosya diskte', fileExists(secondUrl))
  check('ESKİ dosya diskten silindi', !fileExists(firstUrl), firstUrl)

  // ---------------- 4. Sahiplik: 403 ----------------
  console.log('\n4) Başkasının kıyafetine yükleme')
  const intruder = await call('POST', '/auth/register', {
    body: { name: 'Davetsiz', email: email('other'), password: 'GucluSifre123' },
  })
  const intruderToken = intruder.data.token

  const forbidden = await upload(itemId, intruderToken, {
    bytes: TINY_PNG,
    fileName: 'ele-gecir.png',
    contentType: 'image/png',
  })
  check('403 döndü', forbidden.status === 403, `${forbidden.status}`)
  check('sahibin fotoğrafı değişmedi', (await call('GET', `/clothing-items/${itemId}`, { token: ownerToken })).data?.image_url === secondUrl)
  const afterForbidden = fs.readdirSync(UPLOAD_DIR).length
  check('reddedilen yüklemenin dosyası silindi', afterForbidden === 2, `${afterForbidden} dosya`)

  check(
    'token\'sız yükleme 401',
    (await fetch(`${BASE_URL}/clothing-items/${itemId}/image`, { method: 'POST' })).status === 401,
  )

  // ---------------- 5. Fotoğrafı kaldırma ----------------
  console.log('\n5) Fotoğrafı kaldırma')
  const removed = await call('DELETE', `/clothing-items/${itemId}/image`, { token: ownerToken })
  check('kaldırma 200', removed.status === 200)
  check('image_url null oldu', removed.data?.image_url === null)
  check('dosya diskten silindi', !fileExists(secondUrl))

  // ---------------- 6. Kıyafet silinince fotoğraf da silinsin ----------------
  console.log('\n6) Kıyafet silinince fotoğraf temizleniyor')
  const withPhoto = await upload(itemId, ownerToken, {
    bytes: TINY_PNG,
    fileName: 'son.png',
    contentType: 'image/png',
  })
  const finalUrl = withPhoto.data?.image_url
  check('tekrar fotoğraf yüklendi', fileExists(finalUrl))

  check(
    'kıyafet silindi (204)',
    (await call('DELETE', `/clothing-items/${itemId}`, { token: ownerToken })).status === 204,
  )
  check('fotoğraf diskten silindi', !fileExists(finalUrl), finalUrl)

  // ---------------- Temizlik ----------------
  await call('DELETE', `/users/${owner.data.user.id}`, { token: ownerToken })
  await call('DELETE', `/users/${intruder.data.user.id}`, { token: intruderToken })

  const leftover = fs.readdirSync(UPLOAD_DIR).filter((f) => f !== '.gitkeep')
  check('uploads klasöründe artık dosya yok', leftover.length === 0, leftover.join(', ') || 'boş')

  console.log(`\n${'='.repeat(46)}`)
  console.log(`BAŞARILI: ${passed}   BAŞARISIZ: ${failed}`)
  console.log('='.repeat(46))

  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  if (error.cause?.code === 'ECONNREFUSED') {
    console.error(`\nHATA: ${BASE_URL} adresine bağlanılamadı. Sunucu çalışıyor mu?`)
  } else {
    console.error('\nHATA:', error)
  }
  process.exitCode = 1
})
