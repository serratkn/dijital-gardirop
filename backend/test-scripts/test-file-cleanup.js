// Öksüz dosya temizliği testleri.
//
// İki AYRI kaynağı doğrular:
//   1) Kullanıcı SİLİNİNCE (DELETE /users/:id) kıyafet fotoğrafları ve
//      selfie diskten de kalkıyor mu (UserService.deleteUser).
//   2) cleanup.js'in orphan-dosya taraması, hiçbir satırdan referans
//      edilmeyen dosyaları (test artıkları, doğrudan SQL silmeler vb.)
//      temizliyor mu.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-file-cleanup.js
//
// Sunucunun çalışıyor olması gerekir (`npm run dev`). Gemini/Chroma GEREKMEZ.

const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { UPLOAD_DIR, SELFIE_UPLOAD_DIR } = require('../src/config/upload')
const pool = require('../src/config/database')

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`

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
  return { status: response.status, data: text ? JSON.parse(text) : null }
}

function gercekGorselKopyala() {
  const kaynak = fs.readdirSync(UPLOAD_DIR).find((f) => f.endsWith('.png'))
  const yeniAd = `${crypto.randomUUID()}.png`
  fs.copyFileSync(path.join(UPLOAD_DIR, kaynak), path.join(UPLOAD_DIR, yeniAd))
  return yeniAd
}

// Selfie ARTIK SELFIE_UPLOAD_DIR'e yazılır (kıyafet fotoğraflarıyla aynı
// kaynak dosyadan kopyalanır, ama hedef klasör farklıdır).
function gercekSelfieKopyala() {
  const kaynak = fs.readdirSync(UPLOAD_DIR).find((f) => f.endsWith('.png'))
  const yeniAd = `${crypto.randomUUID()}.png`
  fs.copyFileSync(path.join(UPLOAD_DIR, kaynak), path.join(SELFIE_UPLOAD_DIR, yeniAd))
  return yeniAd
}

// ============================================================
// BÖLÜM 1 — kullanıcı silinince fotoğraflar da gidiyor mu
// ============================================================

async function kullaniciSilmeTesti() {
  console.log('1) Kullanıcı silinince kıyafet fotoğrafı VE selfie diskten kalkıyor')

  const email = `oksuz-dosya-${Date.now()}@example.com`
  const { data: auth } = await call('POST', '/auth/register', {
    body: { name: 'Öksüz Dosya Test', email, password: 'test1234', age: 26 },
  })
  if (!auth?.token) {
    check('Test kullanıcısı oluşturuldu', false)
    return
  }

  const { data: categories } = await call('GET', '/categories', { token: auth.token })
  const ustId = categories.find((c) => c.name === 'Üst').id

  const { data: item } = await call('POST', '/clothing-items', {
    token: auth.token,
    body: { categoryId: ustId, name: '[test] Öksüz dosya kontrolü', color: 'Yeşil' },
  })

  // Gerçek fotoğraf yükleme ucu (multipart) kullanılıyor: bu, UserService
  // değil ClothingItemController.uploadImage yolu — kıyafet fotoğrafının
  // GERÇEK ürün akışıyla diske yazıldığından emin oluyoruz.
  const form = new FormData()
  const kaynakAdi = fs.readdirSync(UPLOAD_DIR).find((f) => f.endsWith('.png'))
  form.append('image', new Blob([fs.readFileSync(path.join(UPLOAD_DIR, kaynakAdi))], { type: 'image/png' }), 'x.png')
  const uploadResponse = await fetch(`${BASE_URL}/clothing-items/${item.id}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}` },
    body: form,
  })
  const withPhoto = await uploadResponse.json()
  const kiyafetDosyaAdi = withPhoto.image_url?.replace('/uploads/', '')
  check('Kıyafet fotoğrafı yüklendi', fs.existsSync(path.join(UPLOAD_DIR, kiyafetDosyaAdi || '')))

  // Selfie GERÇEK Gemini çağrısı olmadan simüle ediliyor: bu testin konusu
  // "dosya siliniyor mu", "Gemini doğru ten tonu buluyor mu" değil —
  // test-skin-tone.js zaten o kısmı kapsıyor. Doğrudan SQL ile users
  // satırına yazmak yeterli ve kotayı boşa harcamıyor.
  const selfieAdi = gercekSelfieKopyala()
  await pool.query('UPDATE users SET skin_tone_photo_url = $1 WHERE id = $2', [
    `/uploads/selfies/${selfieAdi}`,
    auth.user.id,
  ])
  check('Selfie dosyası diskte (selfies/ altında)', fs.existsSync(path.join(SELFIE_UPLOAD_DIR, selfieAdi)))

  const { status: deleteStatus } = await call('DELETE', `/users/${auth.user.id}`, { token: auth.token })
  check('Kullanıcı silindi (204)', deleteStatus === 204)

  // removeUploadedFile/removeSelfieFile fs işlemleri senkron değil
  // (fs.promises); küçük bir pay bırakıyoruz.
  await new Promise((resolve) => setTimeout(resolve, 300))

  check(
    'Kıyafet fotoğrafı DİSKTEN kalktı',
    kiyafetDosyaAdi ? !fs.existsSync(path.join(UPLOAD_DIR, kiyafetDosyaAdi)) : false,
  )
  check('Selfie DİSKTEN kalktı (selfies/ altından)', !fs.existsSync(path.join(SELFIE_UPLOAD_DIR, selfieAdi)))

  const { rows } = await pool.query('SELECT count(*)::int c FROM users WHERE id = $1', [auth.user.id])
  check('Kullanıcı veritabanından da gitti', rows[0].c === 0)
}

// ============================================================
// BÖLÜM 2 — cleanup.js öksüz dosyaları süpürüyor mu
// ============================================================

async function cleanupScriptTesti() {
  console.log('\n2) cleanup.js — referanssız dosyaları süpürüyor, referanslıları KORUYOR')

  // Gerçek gardıroptan bir referanslı dosya seçilir: sweep'in onu YANLIŞLIKLA
  // silmediğini kanıtlamak asıl güvence (öksüz olanı silmek kolay kısım).
  const { rows: canliSatirlar } = await pool.query(
    "SELECT image_url FROM clothing_items WHERE image_url IS NOT NULL AND is_deleted = false LIMIT 1",
  )
  const referansliDosya = canliSatirlar[0]?.image_url?.replace('/uploads/', '')

  const oksuzAdi = gercekGorselKopyala()
  check('Öksüz test dosyası oluşturuldu', fs.existsSync(path.join(UPLOAD_DIR, oksuzAdi)))

  // Selfie tarafı İÇİN AYRI bir öksüz dosya — artık farklı bir klasörde
  // (SELFIE_UPLOAD_DIR) yaşadığı için sweep'in oraya da baktığını doğruluyoruz.
  const oksuzSelfieAdi = gercekSelfieKopyala()
  check(
    'Öksüz selfie test dosyası oluşturuldu (selfies/ altında)',
    fs.existsSync(path.join(SELFIE_UPLOAD_DIR, oksuzSelfieAdi)),
  )

  execFileSync(process.execPath, [path.join(__dirname, 'cleanup.js')], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
  })

  check('Öksüz dosya SÜPÜRÜLDÜ', !fs.existsSync(path.join(UPLOAD_DIR, oksuzAdi)))
  check(
    'Öksüz SELFIE de SÜPÜRÜLDÜ (ayrı klasör, ayrı tarama)',
    !fs.existsSync(path.join(SELFIE_UPLOAD_DIR, oksuzSelfieAdi)),
  )
  check(
    'Referanslı (canlı) dosyaya DOKUNULMADI',
    referansliDosya ? fs.existsSync(path.join(UPLOAD_DIR, referansliDosya)) : true,
    referansliDosya ?? '(gardırop boş, kontrol atlandı)',
  )
  check(
    "'selfies' alt klasörü YANLIŞLIKLA silinmeye çalışılmadı (kıyafet taramasından hariç tutulur)",
    fs.existsSync(SELFIE_UPLOAD_DIR),
  )
}

async function main() {
  console.log('\n=== ÖKSÜZ DOSYA TEMİZLİĞİ ===\n')

  try {
    const { status } = await call('GET', '/health')
    if (status !== 200 && status !== 503) throw new Error('sunucu yok')
  } catch {
    console.log('⚠ Sunucu çalışmıyor. backend/ klasöründe `npm run dev` çalıştırın.\n')
    process.exit(1)
  }

  await kullaniciSilmeTesti()
  await cleanupScriptTesti()

  console.log(`\n${'='.repeat(46)}`)
  console.log(`SONUÇ: ${passed} başarılı, ${failed} başarısız`)
  console.log('='.repeat(46))

  await pool.end()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (error) => {
  console.error('\nBeklenmeyen hata:', error)
  await pool.end().catch(() => {})
  process.exit(1)
})
