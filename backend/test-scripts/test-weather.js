// Hava durumu ucu ve şehir alanı testleri.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-weather.js
//
// EN ÖNEMLİ BÖLÜM: hava durumu HİÇBİR KOŞULDA kombin önerisini kırmamalıdır.
// Bu yüzden uç, başarısızlıkta bile 200 + { status: "bilinmiyor" } döner.
//
// Script WEATHER_API_KEY'in tanımlı olup olmadığından bağımsız çalışır:
// anahtar yoksa "bilinmiyor" beklenir, varsa gerçek yanıt da kabul edilir.

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`
const HAS_API_KEY = Boolean(process.env.WEATHER_API_KEY)

const VALID_STATUSES = ['sıcak', 'ılık', 'soğuk']

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

// Frontend'deki seasons.js kurallarının birebir kopyası.
const ALL_SEASON = 'Tüm Sezon'
const STATUS_SEASONS = { sıcak: ['Yaz'], ılık: ['İlkbahar-Sonbahar'], soğuk: ['Kış'] }
const seasonsForWeather = (status) => STATUS_SEASONS[status] ?? null

const matchesSeason = (item, seasons) => {
  if (!seasons) return true
  if (!item.season || item.season === ALL_SEASON) return true
  return seasons.includes(item.season)
}

const OUTFIT_CATEGORIES = ['Üst', 'Alt', 'Ayakkabı', 'Çanta']
const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]

const buildRandomOutfit = (items, categoryNames, seasons) =>
  OUTFIT_CATEGORIES.map((category) => {
    const pool = items.filter((item) => categoryNames.get(item.category_id) === category)
    if (pool.length === 0) return null
    const preferred = pool.filter((item) => matchesSeason(item, seasons))
    return pickRandom(preferred.length > 0 ? preferred : pool)
  }).filter(Boolean)

// WeatherService'i SAHTE bir repository ile doğrudan sürer. Gerçek anahtar
// olmadan test edilemeyen iki şeyi kapsar: (1) API ÇALIŞTIĞINDA sıcaklık → kategori
// eşlemesi, (2) API BOZULDUĞUNDA (ağ hatası, 404, zaman aşımı, bozuk gövde)
// servisin fırlatmak yerine "bilinmiyor" dönmesi.
async function testWeatherServiceBirimleri() {
  console.log('0) WeatherService birim testleri (sahte repository)')

  const { WeatherService } = require('../src/services/WeatherService')

  const sahteRepo = (davranis) => ({ isConfigured: true, fetchByCity: davranis })
  const sicaklikla = (temp) =>
    new WeatherService(sahteRepo(async () => ({ name: 'Istanbul', main: { temp } })))

  const esikler = [
    [35, 'sıcak'], [21, 'sıcak'], [20.1, 'sıcak'],
    [20, 'ılık'], [15, 'ılık'], [10, 'ılık'],
    [9.9, 'soğuk'], [0, 'soğuk'], [-12, 'soğuk'],
  ]

  for (const [temp, beklenen] of esikler) {
    const sonuc = await sicaklikla(temp).getWeather('Istanbul')
    check(`${temp}°C → "${beklenen}"`, sonuc.status === beklenen, sonuc.status)
  }

  const yuvarlama = await sicaklikla(22.6).getWeather('Istanbul')
  check(
    'sıcaklık yuvarlanıyor (22.6 → 23)',
    yuvarlama.temperature === 23,
    String(yuvarlama.temperature),
  )

  // --- API bozuk senaryoları: hiçbiri fırlatmamalı ---
  const bozuk = [
    ['ağ hatası', async () => { throw new Error('fetch failed') }, 'servis-hatasi'],
    ['zaman aşımı', async () => {
      const e = new Error('The operation was aborted')
      e.name = 'TimeoutError'
      throw e
    }, 'servis-hatasi'],
    ['404 şehir yok', async () => {
      const e = new Error('OpenWeatherMap 404')
      e.status = 404
      throw e
    }, 'sehir-bulunamadi'],
    ['401 geçersiz anahtar', async () => {
      const e = new Error('OpenWeatherMap 401')
      e.status = 401
      throw e
    }, 'servis-hatasi'],
    ['boş gövde', async () => null, 'sicaklik-okunamadi'],
    ['main alanı yok', async () => ({ name: 'X' }), 'sicaklik-okunamadi'],
    ['temp metin', async () => ({ main: { temp: 'yirmi' } }), 'sicaklik-okunamadi'],
    ['temp NaN', async () => ({ main: { temp: Number.NaN } }), 'sicaklik-okunamadi'],
  ]

  for (const [adi, davranis, beklenenReason] of bozuk) {
    const service = new WeatherService(sahteRepo(davranis))
    let sonuc = null
    let firlatti = false
    try {
      sonuc = await service.getWeather('Istanbul')
    } catch {
      firlatti = true
    }
    check(
      `${adi} — fırlatmadan "bilinmiyor"`,
      !firlatti && sonuc?.status === 'bilinmiyor',
      firlatti ? 'FIRLATTI' : `${sonuc?.status} (${sonuc?.reason})`,
    )
    check(`${adi} — reason: ${beklenenReason}`, sonuc?.reason === beklenenReason, sonuc?.reason)
  }

  const anahtarsiz = new WeatherService({
    isConfigured: false,
    fetchByCity: async () => {
      throw new Error('çağrılmamalıydı')
    },
  })
  const anahtarsizSonuc = await anahtarsiz.getWeather('Istanbul')
  check(
    'anahtar yoksa dış servise HİÇ gidilmiyor',
    anahtarsizSonuc.reason === 'api-anahtari-yok',
    anahtarsizSonuc.reason,
  )
}

async function main() {
  console.log(`Hedef: ${BASE_URL}`)
  console.log(`WEATHER_API_KEY tanımlı mı: ${HAS_API_KEY ? 'EVET' : 'HAYIR'}\n`)

  await testWeatherServiceBirimleri()
  console.log('')

  const reg = await call('POST', '/auth/register', {
    body: { name: 'Hava Test', email: `hava-${Date.now()}@example.com`, password: 'GucluSifre123' },
  })
  if (reg.status !== 201) throw new Error('Kayıt başarısız: ' + JSON.stringify(reg.data))
  const token = reg.data.token
  const userId = reg.data.user.id

  // --- 1. Uç asla hata dönmemeli ---
  console.log('1) GET /weather — hiçbir koşulda kırılmamalı')
  const senaryolar = [
    ['?city=Istanbul', 'normal şehir'],
    ['', 'parametresiz'],
    ['?city=', 'boş şehir'],
    ['?city=BoyleBirSehirYok12345', 'olmayan şehir'],
    ['?city=%20%20', 'yalnızca boşluk'],
    [`?city=${'x'.repeat(300)}`, 'çok uzun şehir'],
    ['?city=<script>alert(1)</script>', 'zararlı görünümlü girdi'],
  ]

  for (const [query, adi] of senaryolar) {
    const result = await call('GET', `/weather${query}`, { token })
    const gecerli =
      result.status === 200 &&
      (result.data?.status === 'bilinmiyor' || VALID_STATUSES.includes(result.data?.status))
    check(
      `${adi} → 200 ve geçerli status`,
      gecerli,
      `${result.status} / ${result.data?.status}${result.data?.reason ? ` (${result.data.reason})` : ''}`,
    )
  }

  // --- 2. Yanıt biçimi ---
  console.log('\n2) Yanıt biçimi')
  const ornek = await call('GET', '/weather?city=Istanbul', { token })
  const alanlar = ['city', 'temperature', 'status']
  check(
    'beklenen alanlar var',
    alanlar.every((key) => key in (ornek.data || {})),
    Object.keys(ornek.data || {}).join(', '),
  )
  check('hata gövdesi ({ error }) DÖNMÜYOR', !('error' in (ornek.data || {})))

  if (ornek.data?.status === 'bilinmiyor') {
    check('anahtarsız/erişimsiz durumda temperature null', ornek.data.temperature === null)
    check('anahtarsız/erişimsiz durumda city null', ornek.data.city === null)
  } else {
    check('sıcaklık sayı', typeof ornek.data.temperature === 'number', String(ornek.data.temperature))
    check('status geçerli kategori', VALID_STATUSES.includes(ornek.data.status), ornek.data.status)
  }

  // --- 3. Yetkilendirme ---
  console.log('\n3) Yetkilendirme')
  check('token olmadan 401', (await call('GET', '/weather?city=Istanbul')).status === 401)

  // --- 4. users.city alanı ---
  console.log('\n4) users.city alanı')
  check('yeni kullanıcıda city null', reg.data.user.city === null, String(reg.data.user.city))
  check('password_hash sızmıyor', !('password_hash' in reg.data.user))

  const guncel = await call('PUT', `/users/${userId}`, {
    token,
    body: { name: 'Hava Test', email: reg.data.user.email, city: 'Izmir' },
  })
  check('şehir kaydedildi', guncel.data?.city === 'Izmir', String(guncel.data?.city))
  check('PUT yanıtında password_hash yok', !('password_hash' in (guncel.data || {})))

  const bosSehir = await call('PUT', `/users/${userId}`, {
    token,
    body: { name: 'Hava Test', email: reg.data.user.email, city: '   ' },
  })
  check('boşluk şehir null olur', bosSehir.data?.city === null, String(bosSehir.data?.city))

  const uzunSehir = await call('PUT', `/users/${userId}`, {
    token,
    body: { name: 'Hava Test', email: reg.data.user.email, city: 'x'.repeat(101) },
  })
  check('101 karakter şehir 400', uzunSehir.status === 400, `gelen: ${uzunSehir.status}`)

  const me = await call('GET', '/auth/me', { token })
  check('/auth/me city döndürüyor', 'city' in (me.data || {}), String(me.data?.city))

  // --- 5. Sezon alanı ---
  console.log('\n5) clothing_items.season')
  const categories = (await call('GET', '/categories', { token })).data
  const idOf = (name) => categories.find((row) => row.name === name).id

  const yazlik = await call('POST', '/clothing-items', {
    token,
    body: { categoryId: idOf('Üst'), name: 'Keten Gömlek', season: 'Yaz' },
  })
  check('season kaydediliyor', yazlik.data?.season === 'Yaz', String(yazlik.data?.season))

  const sezonsuz = await call('POST', '/clothing-items', {
    token,
    body: { categoryId: idOf('Üst'), name: 'Sezonsuz Parça' },
  })
  check('season zorunlu değil (null)', sezonsuz.data?.season === null, String(sezonsuz.data?.season))

  const uzunSezon = await call('POST', '/clothing-items', {
    token,
    body: { categoryId: idOf('Üst'), name: 'Bozuk', season: 'x'.repeat(21) },
  })
  check('21 karakter season 400', uzunSezon.status === 400, `gelen: ${uzunSezon.status}`)

  const uzunSezonSinir = await call('POST', '/clothing-items', {
    token,
    body: { categoryId: idOf('Üst'), name: 'Sinir', season: 'İlkbahar-Sonbahar' },
  })
  check(
    '"İlkbahar-Sonbahar" (17 karakter) sığıyor',
    uzunSezonSinir.status === 201,
    `gelen: ${uzunSezonSinir.status}`,
  )

  // --- 6. Sezon önceliklendirme mantığı ---
  console.log('\n6) Öneri mantığı — sezon önceliklendirme')
  const categoryNames = new Map(categories.map((row) => [row.id, row.name]))

  // Üst: 1 Yaz + 1 Kış | Alt: yalnızca Kış | Ayakkabı: sezonsuz | Çanta: Tüm Sezon
  const mk = async (category, name, season) =>
    (await call('POST', '/clothing-items', {
      token,
      body: { categoryId: idOf(category), name, season },
    })).data

  const ustYaz = await mk('Üst', 'UST YAZ', 'Yaz')
  const ustKis = await mk('Üst', 'UST KIS', 'Kış')
  const altKis = await mk('Alt', 'ALT KIS', 'Kış')
  const ayakkabiSezonsuz = await mk('Ayakkabı', 'AYAKKABI SEZONSUZ', undefined)
  const cantaTum = await mk('Çanta', 'CANTA TUM', 'Tüm Sezon')

  const havuz = (await call('GET', '/clothing-items', { token })).data.filter(
    (row) => [ustYaz.id, ustKis.id, altKis.id, ayakkabiSezonsuz.id, cantaTum.id].includes(row.id),
  )

  const yazSezonlari = seasonsForWeather('sıcak')
  check('"sıcak" → Yaz', JSON.stringify(yazSezonlari) === JSON.stringify(['Yaz']))
  check('"ılık" → İlkbahar-Sonbahar', seasonsForWeather('ılık')[0] === 'İlkbahar-Sonbahar')
  check('"soğuk" → Kış', seasonsForWeather('soğuk')[0] === 'Kış')
  check('"bilinmiyor" → null (filtre yok)', seasonsForWeather('bilinmiyor') === null)

  let kisSecildi = 0
  const secilenler = new Set()
  for (let i = 0; i < 200; i += 1) {
    const outfit = buildRandomOutfit(havuz, categoryNames, yazSezonlari)
    for (const item of outfit) {
      secilenler.add(item.id)
      if (item.id === ustKis.id) kisSecildi += 1
    }
  }

  check(
    'sıcak havada Üst kategorisinden KIŞ parçası hiç seçilmedi',
    kisSecildi === 0,
    `kış seçimi: ${kisSecildi}`,
  )
  check('sıcak havada YAZ üstü seçildi', secilenler.has(ustYaz.id))
  check(
    'uygun sezon yoksa kategori BOŞ KALMADI (Alt yalnızca Kış olmasına rağmen)',
    secilenler.has(altKis.id),
  )
  check('sezonsuz parça her havada uygun', secilenler.has(ayakkabiSezonsuz.id))
  check('"Tüm Sezon" parça her havada uygun', secilenler.has(cantaTum.id))

  // --- 7. Filtresiz davranış (şehri olmayan kullanıcı) ---
  console.log('\n7) Şehri olmayan kullanıcı — mevcut davranış korunmalı')
  const filtresiz = new Set()
  for (let i = 0; i < 200; i += 1) {
    for (const item of buildRandomOutfit(havuz, categoryNames, null)) filtresiz.add(item.id)
  }
  check(
    'filtre yokken KIŞ üstü de seçilebiliyor',
    filtresiz.has(ustKis.id) && filtresiz.has(ustYaz.id),
    `seçilen farklı parça: ${filtresiz.size}`,
  )
  check('dört kategori de dolduruldu', filtresiz.size === 5, `${filtresiz.size} parça`)

  // --- Temizlik ---
  console.log('\n8) Temizlik')
  const silindi = await call('DELETE', `/users/${userId}`, { token })
  check('test hesabı silindi', silindi.status === 204, `gelen: ${silindi.status}`)

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
