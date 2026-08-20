// GET /api/outfits?clothingItemId=... testleri.
// Kıyafet Detay sayfasındaki "Bu Kıyafetle Yapılan Kombinler" bölümünü besleyen uç.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-item-outfits.js
//
// Script kendi hesaplarını açar ve sonunda siler (CASCADE ile kıyafet/kombinler de gider).

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

const email = (tag) =>
  `kombin-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`

async function registerUser(tag) {
  const result = await call('POST', '/auth/register', {
    body: { name: `${tag} Test`, email: email(tag), password: 'GucluSifre123' },
  })
  if (result.status !== 201) {
    throw new Error(`${tag} kaydedilemedi: ${JSON.stringify(result.data)}`)
  }
  return { token: result.data.token, id: result.data.user.id }
}

async function createItem(token, name, categoryId = 1) {
  const result = await call('POST', '/clothing-items', {
    token,
    body: { categoryId, name },
  })
  if (result.status !== 201) {
    throw new Error(`Kıyafet oluşturulamadı: ${JSON.stringify(result.data)}`)
  }
  return result.data
}

async function createOutfit(token, occasion, clothingItemIds) {
  const result = await call('POST', '/outfits', {
    token,
    body: { occasion, clothingItemIds },
  })
  if (result.status !== 201) {
    throw new Error(`Kombin oluşturulamadı: ${JSON.stringify(result.data)}`)
  }
  return result.data
}

async function main() {
  console.log(`Hedef: ${BASE_URL}\n`)

  const ayse = await registerUser('ayse')
  const zeynep = await registerUser('zeynep')

  console.log('0) Hazırlık — 4 kıyafet, 3 kombin')
  const gomlek = await createItem(ayse.token, 'Beyaz Gömlek', 1)
  const etek = await createItem(ayse.token, 'Siyah Etek', 2)
  const bot = await createItem(ayse.token, 'Kahverengi Bot', 4)
  const kullanilmayan = await createItem(ayse.token, 'Hiç Giyilmeyen Ceket', 1)

  // O1: gömlek + etek | O2: gömlek + bot | O3: yalnızca etek
  const o1 = await createOutfit(ayse.token, 'Üniversite', [gomlek.id, etek.id])
  const o2 = await createOutfit(ayse.token, 'Akşam Yemeği', [gomlek.id, bot.id])
  const o3 = await createOutfit(ayse.token, 'Hafta Sonu', [etek.id])
  check('hazırlık tamam', Boolean(o1.id && o2.id && o3.id))

  // --- 1. Filtre doğru kombinleri getiriyor mu? ---
  console.log('\n1) GET /outfits?clothingItemId= — filtreleme')
  const gomlekOutfits = await call('GET', `/outfits?clothingItemId=${gomlek.id}`, {
    token: ayse.token,
  })
  check('HTTP 200', gomlekOutfits.status === 200, `gelen: ${gomlekOutfits.status}`)
  check('yanıt bir dizi', Array.isArray(gomlekOutfits.data))

  const ids = (gomlekOutfits.data || []).map((row) => row.id)
  check('gömleğin geçtiği 2 kombin döndü', ids.length === 2, `gelen: ${ids.length}`)
  check('O1 listede', ids.includes(o1.id))
  check('O2 listede', ids.includes(o2.id))
  check('O3 (gömlek içermiyor) listede DEĞİL', !ids.includes(o3.id))

  // --- 2. Kombinin TÜM parçaları dönüyor mu? ---
  // Filtre JOIN koşuluna yazılsaydı items yalnızca aranan parçaya inerdi.
  console.log('\n2) Filtrelenen kombin tüm parçalarıyla dönüyor mu?')
  const donenO1 = (gomlekOutfits.data || []).find((row) => row.id === o1.id)
  check(
    'O1 iki parçasıyla birlikte döndü',
    donenO1?.items?.length === 2,
    `items: ${donenO1?.items?.length}`,
  )
  check(
    'O1 içinde etek de var (yalnızca aranan parça değil)',
    (donenO1?.items || []).some((item) => item.id === etek.id),
  )
  check('occasion korunmuş', donenO1?.occasion === 'Üniversite', donenO1?.occasion)
  check('created_at var (tarih gösterimi için)', Boolean(donenO1?.created_at))

  // --- 3. Sıralama ---
  console.log('\n3) Sıralama — created_at DESC')
  check('en yeni kombin başta (O2)', ids[0] === o2.id, `ilk id: ${ids[0]}`)

  // --- 4. Hiç kombinde kullanılmayan parça ---
  console.log('\n4) Hiç kullanılmayan parça')
  const bosSonuc = await call('GET', `/outfits?clothingItemId=${kullanilmayan.id}`, {
    token: ayse.token,
  })
  check('HTTP 200', bosSonuc.status === 200)
  check(
    'boş dizi döndü',
    Array.isArray(bosSonuc.data) && bosSonuc.data.length === 0,
    `uzunluk: ${bosSonuc.data?.length}`,
  )

  // --- 5. Filtresiz istek eskisi gibi çalışıyor mu (regresyon)? ---
  console.log('\n5) Regresyon — filtresiz GET /outfits')
  const hepsi = await call('GET', '/outfits', { token: ayse.token })
  check('HTTP 200', hepsi.status === 200)
  check('3 kombinin tümü döndü', hepsi.data?.length === 3, `gelen: ${hepsi.data?.length}`)

  // --- 6. Geçersiz UUID 500 değil 400 dönmeli ---
  console.log('\n6) Geçersiz clothingItemId')
  const gecersiz = await call('GET', '/outfits?clothingItemId=abc', { token: ayse.token })
  check('HTTP 400', gecersiz.status === 400, `gelen: ${gecersiz.status}`)
  check('Türkçe hata mesajı', typeof gecersiz.data?.error === 'string', gecersiz.data?.error)

  const bosParam = await call('GET', '/outfits?clothingItemId=', { token: ayse.token })
  check(
    'boş clothingItemId filtresiz sayılır',
    bosParam.status === 200 && bosParam.data?.length === 3,
    `${bosParam.status} / ${bosParam.data?.length}`,
  )

  // --- 7. Veri izolasyonu ---
  console.log('\n7) Veri izolasyonu')
  const zeynepBakiyor = await call('GET', `/outfits?clothingItemId=${gomlek.id}`, {
    token: zeynep.token,
  })
  check('HTTP 200', zeynepBakiyor.status === 200)
  check(
    'başkasının parçasıyla sorgu boş döner',
    Array.isArray(zeynepBakiyor.data) && zeynepBakiyor.data.length === 0,
    `uzunluk: ${zeynepBakiyor.data?.length}`,
  )

  const tokensiz = await call('GET', `/outfits?clothingItemId=${gomlek.id}`)
  check('token olmadan 401', tokensiz.status === 401, `gelen: ${tokensiz.status}`)

  // --- 8. Silinen parça ---
  console.log('\n8) Soft delete edilen parça')
  const silme = await call('DELETE', `/clothing-items/${bot.id}`, { token: ayse.token })
  check('DELETE 204', silme.status === 204, `gelen: ${silme.status}`)

  const silinenSonuc = await call('GET', `/outfits?clothingItemId=${bot.id}`, {
    token: ayse.token,
  })
  check(
    'silinen parça hiçbir kombinde görünmez',
    silinenSonuc.data?.length === 0,
    `uzunluk: ${silinenSonuc.data?.length}`,
  )

  // Botu içeren O2 kaybolmaz; gömlekle sorgulandığında hâlâ gelir.
  const silmeSonrasi = await call('GET', `/outfits?clothingItemId=${gomlek.id}`, {
    token: ayse.token,
  })
  check(
    'parçası silinen kombin kaybolmadı',
    (silmeSonrasi.data || []).some((row) => row.id === o2.id),
  )
  const o2SilmeSonrasi = (silmeSonrasi.data || []).find((row) => row.id === o2.id)
  check(
    'silinen parça items dizisinden çıkmış',
    o2SilmeSonrasi?.items?.length === 1,
    `items: ${o2SilmeSonrasi?.items?.length}`,
  )

  // --- Temizlik ---
  console.log('\n9) Temizlik')
  const silinenAyse = await call('DELETE', `/users/${ayse.id}`, { token: ayse.token })
  const silinenZeynep = await call('DELETE', `/users/${zeynep.id}`, { token: zeynep.token })
  check(
    'test hesapları silindi',
    silinenAyse.status === 204 && silinenZeynep.status === 204,
    `${silinenAyse.status} / ${silinenZeynep.status}`,
  )

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
