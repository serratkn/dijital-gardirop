// Temiz/kirli (is_clean) davranışı testleri.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-clean-status.js
//
// NOT: Rastgele kombin üretimi BACKEND'DE DEĞİL, frontend'deki
// OutfitSuggestion.jsx > buildRandomOutfit() içindedir. Bu script iki şeyi
// doğrular: (1) is_clean alanının uçlarda doğru davranması, (2) öneri havuzunu
// besleyen GET /clothing-items yanıtındaki is_clean değerlerine göre filtrelenen
// havuzun kirli parçayı HİÇ içermemesi — yani frontend'in uyguladığı kuralın
// aynısı veriye uygulandığında kirli parça asla seçilemiyor.

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`

// Frontend ile aynı kategoriler (OutfitSuggestion.jsx > OUTFIT_CATEGORIES)
const OUTFIT_CATEGORIES = ['Üst', 'Alt', 'Ayakkabı', 'Çanta']
const SUGGESTION_ROUNDS = 200

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

// --- Frontend'deki buildRandomOutfit'in birebir kopyası ---
const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]

const buildRandomOutfit = (items, categoryNames) =>
  OUTFIT_CATEGORIES.map((category) => {
    const pool = items.filter((item) => categoryNames.get(item.category_id) === category)
    return pool.length > 0 ? pickRandom(pool) : null
  }).filter(Boolean)

async function main() {
  console.log(`Hedef: ${BASE_URL}\n`)

  const email = `temiz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const reg = await call('POST', '/auth/register', {
    body: { name: 'Temiz Test', email, password: 'GucluSifre123' },
  })
  if (reg.status !== 201) throw new Error('Kayıt başarısız: ' + JSON.stringify(reg.data))
  const token = reg.data.token
  const userId = reg.data.user.id

  const categories = (await call('GET', '/categories', { token })).data
  const categoryNames = new Map(categories.map((row) => [row.id, row.name]))
  const idOf = (name) => categories.find((row) => row.name === name).id

  // --- 1. Varsayılan değer ---
  console.log('1) Varsayılan is_clean')
  const varsayilan = await call('POST', '/clothing-items', {
    token,
    body: { categoryId: idOf('Üst'), name: 'Varsayılan Gömlek' },
  })
  check('POST 201', varsayilan.status === 201, `gelen: ${varsayilan.status}`)
  check(
    'is_clean belirtilmezse true',
    varsayilan.data?.is_clean === true,
    String(varsayilan.data?.is_clean),
  )

  const kirliDogum = await call('POST', '/clothing-items', {
    token,
    body: { categoryId: idOf('Üst'), name: 'Kirli Doğan Tişört', isClean: false },
  })
  check('isClean:false ile oluşturulabiliyor', kirliDogum.data?.is_clean === false)

  const gecersiz = await call('POST', '/clothing-items', {
    token,
    body: { categoryId: idOf('Üst'), name: 'Bozuk', isClean: 'evet' },
  })
  check('isClean boolean değilse 400', gecersiz.status === 400, `gelen: ${gecersiz.status}`)
  check('Türkçe hata mesajı', typeof gecersiz.data?.error === 'string', gecersiz.data?.error)

  // --- 2. Toggle ucu ---
  console.log('\n2) PATCH /clothing-items/:id/clean-status')
  const hedef = varsayilan.data
  const ilk = await call('PATCH', `/clothing-items/${hedef.id}/clean-status`, { token })
  check('HTTP 200', ilk.status === 200, `gelen: ${ilk.status}`)
  check('true → false', ilk.data?.is_clean === false, String(ilk.data?.is_clean))

  const ikinci = await call('PATCH', `/clothing-items/${hedef.id}/clean-status`, { token })
  check('false → true (toggle)', ikinci.data?.is_clean === true, String(ikinci.data?.is_clean))

  check(
    'token olmadan 401',
    (await call('PATCH', `/clothing-items/${hedef.id}/clean-status`)).status === 401,
  )
  check(
    'olmayan kayıt 404',
    (await call('PATCH', '/clothing-items/11111111-1111-1111-1111-111111111111/clean-status', {
      token,
    })).status === 404,
  )

  // --- 3. PUT davranışı ---
  console.log('\n3) PUT /clothing-items/:id — isClean korunuyor mu?')
  await call('PATCH', `/clothing-items/${hedef.id}/clean-status`, { token }) // kirli yap
  const guncel = await call('PUT', `/clothing-items/${hedef.id}`, {
    token,
    body: { categoryId: idOf('Üst'), name: 'Yeni Ad' },
  })
  check('PUT 200', guncel.status === 200, `gelen: ${guncel.status}`)
  check('ad güncellendi', guncel.data?.name === 'Yeni Ad')
  check(
    'isClean gönderilmediyse KİRLİ kalır (sessizce temizlenmez)',
    guncel.data?.is_clean === false,
    String(guncel.data?.is_clean),
  )

  const acikca = await call('PUT', `/clothing-items/${hedef.id}`, {
    token,
    body: { categoryId: idOf('Üst'), name: 'Yeni Ad', isClean: true },
  })
  check('isClean açıkça gönderilirse uygulanır', acikca.data?.is_clean === true)

  // --- 4. Öneri havuzu: kirli parça hiç seçilmemeli ---
  console.log('\n4) Kombin önerisi — kirli parça asla seçilmemeli')

  // Her kategoride 1 temiz + 1 kirli parça.
  const beklenenTemiz = new Set()
  const kirliIdler = new Set()
  for (const category of OUTFIT_CATEGORIES) {
    const temiz = await call('POST', '/clothing-items', {
      token,
      body: { categoryId: idOf(category), name: `${category} TEMIZ`, isClean: true },
    })
    const kirli = await call('POST', '/clothing-items', {
      token,
      body: { categoryId: idOf(category), name: `${category} KIRLI`, isClean: false },
    })
    beklenenTemiz.add(temiz.data.id)
    kirliIdler.add(kirli.data.id)
  }
  // 1-3. adımlardan kalan parçaları da kirli yapıp havuzu netleştirelim.
  await call('PATCH', `/clothing-items/${hedef.id}/clean-status`, { token })
  kirliIdler.add(hedef.id)
  kirliIdler.add(kirliDogum.data.id)

  const tumParcalar = (await call('GET', '/clothing-items', { token })).data
  check('GET yanıtında is_clean var', 'is_clean' in (tumParcalar[0] || {}))
  check(
    'kirli parçalar listede GÖRÜNMEYE devam ediyor (gizlenmiyor)',
    tumParcalar.filter((row) => row.is_clean === false).length === kirliIdler.size,
    `kirli: ${tumParcalar.filter((row) => row.is_clean === false).length}/${kirliIdler.size}`,
  )

  const temizHavuz = tumParcalar.filter((row) => row.is_clean !== false)
  let kirliSecildi = 0
  let bosKombin = 0
  const secilenler = new Set()

  for (let round = 0; round < SUGGESTION_ROUNDS; round += 1) {
    const outfit = buildRandomOutfit(temizHavuz, categoryNames)
    if (outfit.length === 0) bosKombin += 1
    for (const item of outfit) {
      secilenler.add(item.id)
      if (kirliIdler.has(item.id)) kirliSecildi += 1
    }
  }

  check(
    `${SUGGESTION_ROUNDS} denemede hiç kirli parça seçilmedi`,
    kirliSecildi === 0,
    `kirli seçim: ${kirliSecildi}`,
  )
  check('hiç boş kombin üretilmedi', bosKombin === 0, `boş: ${bosKombin}`)
  check(
    'seçilenlerin tamamı beklenen temiz parçalar',
    [...secilenler].every((id) => beklenenTemiz.has(id)),
    `farklı seçilen: ${secilenler.size}`,
  )
  check('4 kategorinin dördü de dolduruldu', secilenler.size === 4, `${secilenler.size}/4`)

  // --- 5. Bir kategoride hiç temiz parça yoksa o kategori boş kalmalı (hata yok) ---
  console.log('\n5) Kategoride temiz parça yoksa o slot boş kalmalı')
  const ustTemizler = temizHavuz.filter((row) => categoryNames.get(row.category_id) === 'Üst')
  for (const row of ustTemizler) {
    await call('PATCH', `/clothing-items/${row.id}/clean-status`, { token })
  }

  const sonrasi = (await call('GET', '/clothing-items', { token })).data
  const yeniTemizHavuz = sonrasi.filter((row) => row.is_clean !== false)
  check(
    'Üst kategorisinde temiz parça kalmadı',
    !yeniTemizHavuz.some((row) => categoryNames.get(row.category_id) === 'Üst'),
  )

  const eksikKombin = buildRandomOutfit(yeniTemizHavuz, categoryNames)
  check('hata fırlatmadan kombin üretildi', Array.isArray(eksikKombin))
  check('kombin 3 parçalı (Üst slotu boş)', eksikKombin.length === 3, `${eksikKombin.length} parça`)
  check(
    'kombinde Üst yok',
    !eksikKombin.some((item) => categoryNames.get(item.category_id) === 'Üst'),
  )

  // --- 6. Veri izolasyonu ---
  console.log('\n6) Veri izolasyonu')
  const baskasi = await call('POST', '/auth/register', {
    body: { name: 'Baskasi', email: `temiz-b-${Date.now()}@example.com`, password: 'GucluSifre123' },
  })
  const yabanci = await call('PATCH', `/clothing-items/${hedef.id}/clean-status`, {
    token: baskasi.data.token,
  })
  check('başkasının parçasını toggle etmek 404', yabanci.status === 404, `gelen: ${yabanci.status}`)

  // --- Temizlik ---
  console.log('\n7) Temizlik')
  const sil1 = await call('DELETE', `/users/${userId}`, { token })
  const sil2 = await call('DELETE', `/users/${baskasi.data.user.id}`, { token: baskasi.data.token })
  check('test hesapları silindi', sil1.status === 204 && sil2.status === 204)

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
