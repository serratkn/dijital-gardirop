// Kimlik doğrulama ve yetkilendirme testleri.
// En kritik bölüm: bir kullanıcı BAŞKASININ verisine erişememelidir.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-auth.js

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

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

const email = (tag) => `auth-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`

async function main() {
  console.log(`Hedef: ${BASE_URL}\n`)

  // ---------------- REGISTER ----------------
  console.log('1) POST /auth/register')
  const aliceEmail = email('alice')
  const alice = await call('POST', '/auth/register', { body: {name: 'Alice Test',
    email: aliceEmail,
    age: 28,
    password: 'GucluSifre123',
  } })
  check('kayıt 201', alice.status === 201)
  check('token döndü', typeof alice.data?.token === 'string' && alice.data.token.length > 20)
  check('kullanıcı döndü', alice.data?.user?.email === aliceEmail)
  check(
    'password_hash sızmıyor',
    alice.data?.user && !('password_hash' in alice.data.user),
  )

  check(
    'aynı e-posta ile ikinci kayıt 409',
    (await call('POST', '/auth/register', { body: {email: aliceEmail, password: 'GucluSifre123' } })).status === 409,
  )
  check(
    'kısa şifre 400',
    (await call('POST', '/auth/register', { body: {email: email('short'), password: '123' } })).status === 400,
  )
  check(
    'şifresiz kayıt 400',
    (await call('POST', '/auth/register', { body: {email: email('nopass') } })).status === 400,
  )
  check(
    'geçersiz e-posta 400',
    (await call('POST', '/auth/register', { body: {email: 'bozuk', password: 'GucluSifre123' } })).status === 400,
  )

  const aliceToken = alice.data.token
  const aliceId = alice.data.user.id

  // ---------------- LOGIN ----------------
  console.log('\n2) POST /auth/login')
  const login = await call('POST', '/auth/login', { body: {email: aliceEmail, password: 'GucluSifre123' } })
  check('doğru bilgilerle giriş 200', login.status === 200)
  check('giriş token döndürdü', typeof login.data?.token === 'string')

  const wrongPass = await call('POST', '/auth/login', { body: {email: aliceEmail, password: 'YanlisSifre123' } })
  check('yanlış şifre 401', wrongPass.status === 401)
  const unknownUser = await call('POST', '/auth/login', { body: {email: email('yok'), password: 'GucluSifre123' } })
  check('olmayan kullanıcı 401', unknownUser.status === 401)
  check(
    'hata mesajı kullanıcı varlığını ele vermiyor',
    wrongPass.data?.error === unknownUser.data?.error,
    wrongPass.data?.error,
  )

  // ---------------- ME ----------------
  console.log('\n3) GET /auth/me')
  const me = await call('GET', '/auth/me', { token: aliceToken })
  check('token ile 200', me.status === 200)
  check('doğru kullanıcı', me.data?.id === aliceId)
  check('token yok → 401', (await call('GET', '/auth/me')).status === 401)
  check(
    'bozuk token → 401',
    (await call('GET', '/auth/me', { token: 'bozuk.token.degeri' })).status === 401,
  )

  // ---------------- KORUMALI UÇLAR ----------------
  console.log('\n4) Korumalı uçlar token istiyor')
  for (const [method, endpoint] of [
    ['GET', '/clothing-items'],
    ['GET', '/outfits'],
    ['GET', '/style-preferences'],
    ['GET', '/categories'],
  ]) {
    check(`${method} ${endpoint} token'sız 401`, (await call(method, endpoint)).status === 401)
  }

  // ---------------- VERİ İZOLASYONU ----------------
  console.log('\n5) Veri izolasyonu — Bob, Alice\'in verisini görememeli')
  const bobEmail = email('bob')
  const bob = await call('POST', '/auth/register', { body: {name: 'Bob Test',
    email: bobEmail,
    password: 'GucluSifre123',
  } })
  const bobToken = bob.data.token

  // Alice bir parça ve kombin oluşturur
  const aliceItem = await call('POST', '/clothing-items', {
    token: aliceToken,
    body: { categoryId: 1, name: 'Alice Gömlek', color: 'Beyaz' },
  })
  check('Alice parça ekledi (userId gövdeden değil token\'dan)', aliceItem.status === 201)
  check('parça Alice\'e ait', aliceItem.data?.user_id === aliceId, aliceItem.data?.user_id)

  const aliceOutfit = await call('POST', '/outfits', {
    token: aliceToken,
    body: { occasion: 'Alice Kombin', clothingItemIds: [aliceItem.data.id] },
  })
  check('Alice kombin ekledi', aliceOutfit.status === 201)

  // Bob'un listeleri boş olmalı
  const bobItems = await call('GET', '/clothing-items', { token: bobToken })
  check('Bob\'un gardırobu boş', bobItems.data?.length === 0, `${bobItems.data?.length} parça`)
  const bobOutfits = await call('GET', '/outfits', { token: bobToken })
  check('Bob\'un kombinleri boş', bobOutfits.data?.length === 0)

  // Bob, Alice'in kaydına doğrudan erişmeye çalışır
  check(
    'Bob Alice\'in parçasını GET edemez (404)',
    (await call('GET', `/clothing-items/${aliceItem.data.id}`, { token: bobToken })).status === 404,
  )
  check(
    'Bob Alice\'in parçasını güncelleyemez (404)',
    (await call('PUT', `/clothing-items/${aliceItem.data.id}`, {
      token: bobToken,
      body: { categoryId: 1, name: 'Ele geçirildi' },
    })).status === 404,
  )
  check(
    'Bob Alice\'in parçasını silemez (404)',
    (await call('DELETE', `/clothing-items/${aliceItem.data.id}`, { token: bobToken })).status === 404,
  )
  check(
    'Bob Alice\'in parçasını favoriye alamaz (404)',
    (await call('PATCH', `/clothing-items/${aliceItem.data.id}/favorite`, { token: bobToken })).status === 404,
  )
  check(
    'Bob Alice\'in kombinini GET edemez (404)',
    (await call('GET', `/outfits/${aliceOutfit.data.id}`, { token: bobToken })).status === 404,
  )
  check(
    'Bob Alice\'in kombinini silemez (404)',
    (await call('DELETE', `/outfits/${aliceOutfit.data.id}`, { token: bobToken })).status === 404,
  )
  check(
    'Bob Alice\'in kombinini favoriye alamaz (404)',
    (await call('PATCH', `/outfits/${aliceOutfit.data.id}/favorite`, { token: bobToken })).status === 404,
  )
  check(
    'Bob Alice\'in kullanıcı kaydını göremez (404)',
    (await call('GET', `/users/${aliceId}`, { token: bobToken })).status === 404,
  )
  check(
    'Bob Alice\'in kullanıcı kaydını güncelleyemez (404)',
    (await call('PUT', `/users/${aliceId}`, {
      token: bobToken,
      body: { email: bobEmail },
    })).status === 404,
  )

  // Alice hâlâ kendi verisine erişebiliyor
  check(
    'Alice kendi parçasını görebiliyor',
    (await call('GET', `/clothing-items/${aliceItem.data.id}`, { token: aliceToken })).status === 200,
  )

  // Bob başkasının parçasını kendi kombinine ekleyemez
  check(
    'Bob Alice\'in parçasıyla kombin kuramaz (400)',
    (await call('POST', '/outfits', {
      token: bobToken,
      body: { clothingItemIds: [aliceItem.data.id] },
    })).status === 400,
  )

  // ---------------- TARZ TERCİHLERİ ----------------
  console.log('\n6) Tarz tercihleri token sahibine bağlanıyor')
  const prefs = await call('PUT', '/style-preferences', {
    token: aliceToken,
    body: { dailyStyle: 'Şık & Zarif', priority: 'Şıklık' },
  })
  check('kaydedildi 200', prefs.status === 200)
  check('doğru kullanıcıya bağlandı', prefs.data?.user_id === aliceId)
  check(
    'Bob\'un tercihleri yok (404)',
    (await call('GET', '/style-preferences', { token: bobToken })).status === 404,
  )
  check(
    'Alice\'in tercihleri var (200)',
    (await call('GET', '/style-preferences', { token: aliceToken })).status === 200,
  )

  // ---------------- ŞİFRE DEĞİŞTİRME ----------------
  console.log('\n7) POST /auth/change-password')
  check(
    'yanlış mevcut şifre 401',
    (await call('POST', '/auth/change-password', {
      token: aliceToken,
      body: { currentPassword: 'YanlisSifre', newPassword: 'YeniSifre456' },
    })).status === 401,
  )
  check(
    'kısa yeni şifre 400',
    (await call('POST', '/auth/change-password', {
      token: aliceToken,
      body: { currentPassword: 'GucluSifre123', newPassword: '123' },
    })).status === 400,
  )

  const changed = await call('POST', '/auth/change-password', {
    token: aliceToken,
    body: { currentPassword: 'GucluSifre123', newPassword: 'YeniSifre456' },
  })
  check('şifre değişti 204', changed.status === 204)
  check(
    'eski şifreyle giriş artık 401',
    (await call('POST', '/auth/login', { body: {email: aliceEmail, password: 'GucluSifre123' } })).status === 401,
  )
  check(
    'yeni şifreyle giriş 200',
    (await call('POST', '/auth/login', { body: {email: aliceEmail, password: 'YeniSifre456' } })).status === 200,
  )

  // ---------------- TEMİZLİK ----------------
  console.log('\n8) Temizlik')
  const freshAlice = await call('POST', '/auth/login', { body: {email: aliceEmail, password: 'YeniSifre456' } })
  check(
    'Alice kendi hesabını silebiliyor',
    (await call('DELETE', `/users/${aliceId}`, { token: freshAlice.data.token })).status === 204,
  )
  check(
    'Bob kendi hesabını silebiliyor',
    (await call('DELETE', `/users/${bob.data.user.id}`, { token: bobToken })).status === 204,
  )

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
