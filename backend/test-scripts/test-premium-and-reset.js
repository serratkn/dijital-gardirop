// Premium plan sınırları + şifre sıfırlama akışı.
//
// Kullanım (backend/ klasöründen, sunucu ÇALIŞIYOR olmalı):
//   node test-scripts/test-premium-and-reset.js
//
// Şifre sıfırlama e-postası GERÇEKTEN gönderilmez (RESEND_API_KEY yerelde
// tanımlı değil) — bu yüzden AuthService DOĞRUDAN (HTTP'siz) örneklenip
// sahte bir emailRepository ile ham token, gönderilecek olan e-postanın
// HTML'inden okunur (gerçek e-posta servisini taklit ETMEDEN, yalnızca
// "e-posta gönderilseydi ne giderdi" sorusuna cevap verir). Token üretildikten
// SONRA gerçek HTTP ucu (`POST /auth/reset-password`) test edilir — yalnızca
// e-postanın kendisi taklit ediliyor, sıfırlama akışının GERİ KALANI uçtan
// uca gerçek.
const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const pool = require('../src/config/database')
const UserRepository = require('../src/repositories/UserRepository')
const { AuthService } = require('../src/services/AuthService')
const { FREE_LIMITS } = require('../src/config/plans')

const BASE = 'http://localhost:3001/api'

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

async function call(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === null || body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

async function registerUser(prefix) {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const res = await call('POST', '/auth/register', { name: prefix, email, password: 'sifre1234' })
  if (res.status !== 201) throw new Error(`Kayıt başarısız: ${res.status} ${JSON.stringify(res.data)}`)
  return { email, userId: res.data.user.id, token: res.data.token, refreshToken: res.data.refreshToken }
}

async function main() {
  console.log('\n=== PREMIUM SINIRLARI + ŞİFRE SIFIRLAMA ===\n')
  const createdUserIds = []

  console.log('1) Ücretsiz plan — parça (clothing_items) sınırı')
  {
    const user = await registerUser('premium-item')
    createdUserIds.push(user.userId)

    const categories = await call('GET', '/categories', null, user.token)
    const categoryId = categories.data[0].id

    let lastStatus
    for (let i = 0; i < FREE_LIMITS.clothingItems; i += 1) {
      const res = await call(
        'POST',
        '/clothing-items',
        { categoryId, name: `Parça ${i + 1}` },
        user.token,
      )
      lastStatus = res.status
    }
    check(`İlk ${FREE_LIMITS.clothingItems} parça sorunsuz oluşturuluyor`, lastStatus === 201, `${lastStatus}`)

    const overLimit = await call('POST', '/clothing-items', { categoryId, name: 'Sınırı Aşan Parça' }, user.token)
    check(
      `${FREE_LIMITS.clothingItems + 1}. parça 402 (Premium gerekli) ile reddediliyor`,
      overLimit.status === 402,
      `${overLimit.status} ${overLimit.data?.error}`,
    )
    check(
      'Hata mesajı sınır sayısını içeriyor',
      overLimit.data?.error?.includes(String(FREE_LIMITS.clothingItems)),
    )

    // Premium'a yükselt — artık limit uygulanmamalı.
    await pool.query("UPDATE users SET subscription_tier = 'premium' WHERE id = $1", [user.userId])
    const afterUpgrade = await call('POST', '/clothing-items', { categoryId, name: 'Premium Parçası' }, user.token)
    check('Premium kullanıcı sınırın ÜSTÜNE çıkabiliyor', afterUpgrade.status === 201, `${afterUpgrade.status}`)
  }

  console.log('\n2) Ücretsiz plan — kombin (outfits) sınırı')
  {
    const user = await registerUser('premium-outfit')
    createdUserIds.push(user.userId)

    const categories = await call('GET', '/categories', null, user.token)
    const categoryId = categories.data[0].id
    const item = await call('POST', '/clothing-items', { categoryId, name: 'Tek Parça' }, user.token)
    const clothingItemIds = [item.data.id]

    let lastStatus
    for (let i = 0; i < FREE_LIMITS.outfits; i += 1) {
      const res = await call('POST', '/outfits', { occasion: 'Test', clothingItemIds }, user.token)
      lastStatus = res.status
    }
    check(`İlk ${FREE_LIMITS.outfits} kombin sorunsuz oluşturuluyor`, lastStatus === 201, `${lastStatus}`)

    const overLimit = await call('POST', '/outfits', { occasion: 'Test', clothingItemIds }, user.token)
    check(
      `${FREE_LIMITS.outfits + 1}. kombin 402 (Premium gerekli) ile reddediliyor`,
      overLimit.status === 402,
      `${overLimit.status} ${overLimit.data?.error}`,
    )

    await pool.query("UPDATE users SET subscription_tier = 'premium' WHERE id = $1", [user.userId])
    const afterUpgrade = await call('POST', '/outfits', { occasion: 'Test', clothingItemIds }, user.token)
    check('Premium kullanıcı kombin sınırının ÜSTÜNE çıkabiliyor', afterUpgrade.status === 201, `${afterUpgrade.status}`)
  }

  console.log('\n3) Şifre sıfırlama — uçtan uca')
  {
    const user = await registerUser('reset-flow')
    createdUserIds.push(user.userId)

    // --- Var olmayan e-posta için de AYNI (204) yanıt — enumeration yok ---
    const fakeEmailRes = await call('POST', '/auth/forgot-password', { email: 'hic-olmayan-birisi@example.com' })
    check('Var olmayan e-posta için de 204 dönüyor (enumeration yok)', fakeEmailRes.status === 204)

    // --- Gerçek e-posta: 204 dönüyor VE reset_token_hash gerçekten yazılıyor ---
    const realEmailRes = await call('POST', '/auth/forgot-password', { email: user.email })
    check('Kayıtlı e-posta için 204 dönüyor', realEmailRes.status === 204)

    const dbRow = await pool.query('SELECT reset_token_hash, reset_token_expires_at FROM users WHERE id = $1', [user.userId])
    check('reset_token_hash veritabanına GERÇEKTEN yazıldı', Boolean(dbRow.rows[0].reset_token_hash))

    // --- Ham token'ı almak için AuthService'i sahte bir e-posta deposuyla DOĞRUDAN çağır ---
    let capturedHtml = null
    const fakeEmailRepository = {
      isConfigured: true,
      async send({ html }) {
        capturedHtml = html
      },
    }
    const directAuthService = new AuthService(new UserRepository(pool), fakeEmailRepository)
    await directAuthService.forgotPassword(user.email)
    const tokenMatch = capturedHtml?.match(/token=([^"&]+)/)
    const rawToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null
    check('Ham sıfırlama token\'ı e-posta HTML\'inden okunabildi', Boolean(rawToken))

    // --- Geçersiz token → 401 ---
    const badToken = await call('POST', '/auth/reset-password', { token: 'gecersiz:token', newPassword: 'yenisifre1' })
    check('Geçersiz token 401 ile reddediliyor', badToken.status === 401)

    // --- GERÇEK sıfırlamayı, HİÇ dokunulmamış ilk (hâlâ geçerli) token ile dene ---
    const NEW_PASSWORD = 'yepyeni-sifre-123'
    const resetRes = await call('POST', '/auth/reset-password', { token: rawToken, newPassword: NEW_PASSWORD })
    check('KRİTİK — geçerli token ile sıfırlama 204 dönüyor', resetRes.status === 204, `${resetRes.status}`)

    // --- Aynı token İKİNCİ KEZ kullanılamaz (tek kullanımlık) ---
    const reuseRes = await call('POST', '/auth/reset-password', { token: rawToken, newPassword: 'baska-bir-sifre' })
    check('KRİTİK — kullanılmış token TEKRAR işe yaramıyor', reuseRes.status === 401)

    // --- Eski şifre artık ÇALIŞMIYOR, YENİ şifre ÇALIŞIYOR ---
    const oldPasswordLogin = await call('POST', '/auth/login', { email: user.email, password: 'sifre1234' })
    check('Eski şifre ile giriş ARTIK BAŞARISIZ', oldPasswordLogin.status === 401)

    const newPasswordLogin = await call('POST', '/auth/login', { email: user.email, password: NEW_PASSWORD })
    check('KRİTİK — YENİ şifre ile giriş GERÇEKTEN çalışıyor', newPasswordLogin.status === 200)

    // --- Şifre sıfırlanınca ESKİ refresh token geçersiz kılınmalı ---
    const oldRefreshRes = await call('POST', '/auth/refresh', { refreshToken: user.refreshToken })
    check('Şifre değişince ESKİ refresh token geçersiz kılınıyor', oldRefreshRes.status === 401)

    // --- Süresi dolmuş token → 401 (elle simüle edilir) ---
    // KENDİ AYRI token'ı, akışın EN SONUNDA: resetPassword süresi dolmuş bir
    // token'ı fark edince reset_token_hash'i TEMİZLER (doğru davranış —
    // housekeeping). Bu token yukarıdaki "gerçek başarılı sıfırlama"
    // testinde kullanılan token'la AYNI OLSAYDI (forgotPassword her
    // çağrıldığında hash'in ÜZERİNE YAZAR), bu temizlik önceki token'ı da
    // geçersiz kılar ve testler birbirine karışırdı — bu yüzden süre dolumu
    // en son, kendi bağımsız token'ıyla test ediliyor.
    await directAuthService.forgotPassword(user.email)
    const expiredTokenMatch = capturedHtml?.match(/token=([^"&]+)/)
    const expiredRawToken = expiredTokenMatch ? decodeURIComponent(expiredTokenMatch[1]) : null
    await pool.query(
      "UPDATE users SET reset_token_expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1",
      [user.userId],
    )
    const expiredRes = await call('POST', '/auth/reset-password', { token: expiredRawToken, newPassword: 'yenisifre1' })
    check('Süresi dolmuş token 401 ile reddediliyor', expiredRes.status === 401)
  }

  console.log('\n4) Temizlik')
  for (const userId of createdUserIds) {
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
  }
  check('Test kullanıcıları silindi', true, `${createdUserIds.length} hesap`)

  console.log(`\n${'='.repeat(46)}`)
  console.log(`SONUÇ: ${passed} başarılı, ${failed} başarısız`)
  console.log('='.repeat(46))

  await pool.end()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('\nÇalıştırılamadı:', error.message)
  console.error(error.stack)
  process.exitCode = 1
  pool.end()
})
