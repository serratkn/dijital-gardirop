// POST /api/clothing-items ve GET /api/clothing-items uçlarını test-data.json
// verisiyle deneyen manuel test scripti.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-clothing-items.js
//   node test-scripts/test-clothing-items.js --cleanup   # oluşturduğu kaydı sonda siler
//
// Not: istekler Node'un fetch'i ile atılır. Git Bash üzerinden curl kullanmak
// Türkçe karakterleri bozduğu için bu script kabuk katmanını atlar.

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const testData = require('../test-data.json')

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`
const SHOULD_CLEANUP = process.argv.includes('--cleanup')

// Yanıtta bulunmasını beklediğimiz snake_case kolonlar ve
// kesinlikle bulunmaması gereken camelCase karşılıkları.
const EXPECTED_SNAKE_KEYS = [
  'user_id',
  'category_id',
  'image_url',
  'is_favorite',
  'is_deleted',
  'created_at',
  'updated_at',
]
const FORBIDDEN_CAMEL_KEYS = ['userId', 'categoryId', 'imageUrl', 'isFavorite', 'createdAt']

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

async function request(method, endpoint, body) {
  const response = await fetch(BASE_URL + endpoint, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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

async function main() {
  console.log('Gönderilen veri (test-data.json):')
  console.log(JSON.stringify(testData, null, 2))
  console.log(`\nHedef: ${BASE_URL}`)

  // --- 1. Kayıt oluşturuluyor mu? ---
  console.log('\n1) POST /clothing-items — kayıt oluşturma')
  const created = await request('POST', '/clothing-items', testData)

  check('HTTP 201 Created dönüyor', created.status === 201, `gelen: ${created.status}`)

  if (created.status !== 201) {
    console.log('\n   Yanıt gövdesi:', JSON.stringify(created.data))
    throw new Error('Kayıt oluşturulamadı, sonraki adımlar atlanıyor.')
  }

  const item = created.data
  check('yanıtta id var', typeof item.id === 'string' && item.id.length > 0, item.id)
  check(
    'gönderilen name korunmuş',
    item.name === testData.name,
    `"${item.name}"`,
  )
  check(
    'gönderilen userId doğru kaydedilmiş',
    item.user_id === testData.userId,
    item.user_id,
  )
  check(
    'categoryId doğru kaydedilmiş',
    item.category_id === testData.categoryId,
    String(item.category_id),
  )

  // --- 2. Yanıt snake_case mi? ---
  console.log('\n2) Yanıt formatı — snake_case doğrulaması')
  const responseKeys = Object.keys(item)
  console.log(`   dönen alanlar: ${responseKeys.join(', ')}`)

  const missingSnake = EXPECTED_SNAKE_KEYS.filter((key) => !(key in item))
  check(
    'beklenen snake_case alanların tümü var',
    missingSnake.length === 0,
    missingSnake.length ? `eksik: ${missingSnake.join(', ')}` : EXPECTED_SNAKE_KEYS.join(', '),
  )

  const leakedCamel = FORBIDDEN_CAMEL_KEYS.filter((key) => key in item)
  check(
    'camelCase alan sızmamış',
    leakedCamel.length === 0,
    leakedCamel.length ? `sızan: ${leakedCamel.join(', ')}` : 'yok',
  )

  // İstek camelCase, yanıt snake_case: aradaki asimetriyi açıkça gösteriyoruz.
  console.log(
    `   istek "userId" → yanıt "user_id" | istek "categoryId" → yanıt "category_id"`,
  )

  // --- 3. GET listesinde görünüyor mu? ---
  console.log('\n3) GET /clothing-items?userId=... — listede görünme')
  const list = await request('GET', `/clothing-items?userId=${testData.userId}`)

  check('HTTP 200 dönüyor', list.status === 200, `gelen: ${list.status}`)
  check('yanıt bir dizi', Array.isArray(list.data), `tip: ${typeof list.data}`)

  if (Array.isArray(list.data)) {
    console.log(`   kullanıcının toplam parça sayısı: ${list.data.length}`)
    const found = list.data.find((row) => row.id === item.id)
    check('az önce eklenen kayıt listede', Boolean(found), found ? `id: ${found.id}` : 'bulunamadı')
    check(
      'listedeki kayıt is_deleted = false',
      found ? found.is_deleted === false : false,
      found ? String(found.is_deleted) : '-',
    )
  }

  // --- Temizlik (opsiyonel) ---
  if (SHOULD_CLEANUP) {
    console.log('\n4) Temizlik (--cleanup)')
    const deleted = await request('DELETE', `/clothing-items/${item.id}`)
    check('DELETE 204 dönüyor', deleted.status === 204, `gelen: ${deleted.status}`)

    const afterDelete = await request('GET', `/clothing-items/${item.id}`)
    check(
      'soft delete sonrası kayıt 404',
      afterDelete.status === 404,
      `gelen: ${afterDelete.status}`,
    )
  } else {
    console.log(`\nOluşturulan kayıt veritabanında bırakıldı (id: ${item.id}).`)
    console.log('Silmek için: node test-scripts/test-clothing-items.js --cleanup')
  }

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
