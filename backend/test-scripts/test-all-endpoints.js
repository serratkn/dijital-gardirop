// Tüm API uçlarını uçtan uca doğrular: mutlu yol, doğrulama hataları,
// bulunamayan kayıtlar, benzersizlik ihlali ve ilişkisel davranışlar.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-all-endpoints.js
//
// Script kendi test verisini oluşturur ve sonunda tamamını siler.
// Çıkış kodu: 0 = hepsi geçti, 1 = en az bir kontrol başarısız.

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`

let passed = 0
let failed = 0
const createdUserIds = []

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`   ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`   ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function call(method, endpoint, body) {
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

const uniqueEmail = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
const longText = (length) => 'x'.repeat(length)

async function main() {
  console.log(`Hedef: ${BASE_URL}\n`)

  // ---------------- HEALTH ----------------
  console.log('1) HEALTH')
  const health = await call('GET', '/health')
  check('GET /health → 200', health.status === 200, `status: ${health.data?.status}`)
  check('veritabanı bağlı', health.data?.database?.connected === true)

  // ---------------- CATEGORIES ----------------
  console.log('\n2) CATEGORIES (salt okunur)')
  const categories = await call('GET', '/categories')
  check('GET /categories → 200', categories.status === 200)
  check('6 kategori seed edilmiş', categories.data?.length === 6, `${categories.data?.length} kategori`)
  check(
    'Türkçe karakterler bozulmamış',
    categories.data?.some((row) => row.name === 'Üst') &&
      categories.data?.some((row) => row.name === 'Ayakkabı'),
    categories.data?.map((row) => row.name).join(', '),
  )
  check('GET /categories/1 → 200', (await call('GET', '/categories/1')).status === 200)
  check('GET /categories/999 → 404', (await call('GET', '/categories/999')).status === 404)
  check('GET /categories/abc → 400', (await call('GET', '/categories/abc')).status === 400)

  // ---------------- USERS ----------------
  console.log('\n3) USERS')
  const email = uniqueEmail()
  const createdUser = await call('POST', '/users', { name: 'Test Kullanıcı', email, age: 27 })
  check('POST /users → 201', createdUser.status === 201)
  const userId = createdUser.data?.id
  createdUserIds.push(userId)
  check('password_hash sızmıyor', createdUser.data && !('password_hash' in createdUser.data))
  check('e-posta küçük harfe çevrildi', createdUser.data?.email === email.toLowerCase())

  check('aynı e-posta → 409', (await call('POST', '/users', { name: 'X', email })).status === 409)
  check('e-posta yok → 400', (await call('POST', '/users', { name: 'X' })).status === 400)
  check('geçersiz e-posta → 400', (await call('POST', '/users', { email: 'abc' })).status === 400)
  check('yaş 999 → 400', (await call('POST', '/users', { email: uniqueEmail(), age: 999 })).status === 400)
  check(
    'name 101 karakter → 400',
    (await call('POST', '/users', { email: uniqueEmail(), name: longText(101) })).status === 400,
  )

  check('GET /users/:id → 200', (await call('GET', `/users/${userId}`)).status === 200)
  check(
    'GET /users/<olmayan> → 404',
    (await call('GET', '/users/00000000-0000-0000-0000-000000000000')).status === 404,
  )

  const updatedUser = await call('PUT', `/users/${userId}`, {
    name: 'Güncellenmiş Ad',
    email,
    age: 28,
    subscriptionTier: 'premium',
  })
  check('PUT /users/:id → 200', updatedUser.status === 200)
  check('subscription_tier güncellendi', updatedUser.data?.subscription_tier === 'premium')
  check(
    'geçersiz tier → 400',
    (await call('PUT', `/users/${userId}`, { email, subscriptionTier: 'gold' })).status === 400,
  )

  // ---------------- STYLE PREFERENCES ----------------
  console.log('\n4) STYLE PREFERENCES (upsert)')
  check(
    'GET (henüz yok) → 404',
    (await call('GET', `/style-preferences?userId=${userId}`)).status === 404,
  )

  const prefsBody = {
    userId,
    dailyStyle: 'Şık & Zarif',
    colorPreference: 'Pastel & Yumuşak Tonlar',
    priority: 'Şıklık',
    styleIcon: 'Romantik & Feminen',
    frequency: 'Her Gün Farklı',
  }
  const insertedPrefs = await call('PUT', '/style-preferences', prefsBody)
  check('PUT (insert) → 200', insertedPrefs.status === 200)
  check('Türkçe karakter korunuyor', insertedPrefs.data?.daily_style === 'Şık & Zarif')

  const updatedPrefs = await call('PUT', '/style-preferences', { ...prefsBody, priority: 'Rahatlık' })
  check('PUT (update) aynı satırı günceller', updatedPrefs.data?.id === insertedPrefs.data?.id)
  check('alan güncellendi', updatedPrefs.data?.priority === 'Rahatlık')
  check('GET → 200', (await call('GET', `/style-preferences?userId=${userId}`)).status === 200)
  check('userId yok → 400', (await call('PUT', '/style-preferences', { dailyStyle: 'x' })).status === 400)
  check(
    'olmayan kullanıcı → 400',
    (await call('PUT', '/style-preferences', {
      userId: '00000000-0000-0000-0000-000000000000',
    })).status === 400,
  )
  check(
    'dailyStyle 51 karakter → 400',
    (await call('PUT', '/style-preferences', { userId, dailyStyle: longText(51) })).status === 400,
  )

  // ---------------- CLOTHING ITEMS ----------------
  console.log('\n5) CLOTHING ITEMS')
  const item1 = await call('POST', '/clothing-items', {
    userId,
    categoryId: 1,
    name: 'Test Parça Üst',
    color: 'Beyaz',
    brand: 'Zara',
  })
  check('POST → 201', item1.status === 201)
  check('yanıt snake_case', item1.data && 'user_id' in item1.data && 'is_favorite' in item1.data)
  check('camelCase sızmıyor', item1.data && !('userId' in item1.data))

  const item2 = await call('POST', '/clothing-items', { userId, categoryId: 2, name: 'Test Parça Alt' })
  const item3 = await call('POST', '/clothing-items', { userId, categoryId: 4, name: 'Test Parça Ayakkabı' })
  check('farklı kategorilerde parçalar eklendi', item2.status === 201 && item3.status === 201)

  check('userId yok → 400', (await call('POST', '/clothing-items', { categoryId: 1, name: 'x' })).status === 400)
  check('name yok → 400', (await call('POST', '/clothing-items', { userId, categoryId: 1 })).status === 400)
  check(
    'name 201 karakter → 400',
    (await call('POST', '/clothing-items', { userId, categoryId: 1, name: longText(201) })).status === 400,
  )
  check(
    'olmayan kategori → 400',
    (await call('POST', '/clothing-items', { userId, categoryId: 9999, name: 'x' })).status === 400,
  )

  const list = await call('GET', `/clothing-items?userId=${userId}`)
  check('GET liste → 200', list.status === 200)
  check('3 parça listelendi', list.data?.length === 3, `${list.data?.length} parça`)
  check('created_at DESC sıralı', list.data?.[0]?.id === item3.data.id)

  const filtered = await call('GET', `/clothing-items?userId=${userId}&categoryId=1`)
  check('kategori filtresi çalışıyor', filtered.data?.length === 1, `${filtered.data?.length} parça`)
  check('userId yok → 400', (await call('GET', '/clothing-items')).status === 400)
  check('GET /:id → 200', (await call('GET', `/clothing-items/${item1.data.id}`)).status === 200)
  check(
    'GET /<olmayan> → 404',
    (await call('GET', '/clothing-items/00000000-0000-0000-0000-000000000000')).status === 404,
  )

  const updatedItem = await call('PUT', `/clothing-items/${item1.data.id}`, {
    categoryId: 1,
    name: 'Test Parça Güncellenmiş',
    color: 'Siyah',
  })
  check('PUT → 200', updatedItem.status === 200)
  check('alanlar güncellendi', updatedItem.data?.name === 'Test Parça Güncellenmiş')

  const fav1 = await call('PATCH', `/clothing-items/${item1.data.id}/favorite`)
  check('PATCH favorite → true', fav1.data?.is_favorite === true)
  const fav2 = await call('PATCH', `/clothing-items/${item1.data.id}/favorite`)
  check('PATCH favorite → false (toggle)', fav2.data?.is_favorite === false)
  check(
    'PATCH favorite <olmayan> → 404',
    (await call('PATCH', '/clothing-items/00000000-0000-0000-0000-000000000000/favorite')).status === 404,
  )

  // ---------------- OUTFITS ----------------
  console.log('\n6) OUTFITS')
  const outfit = await call('POST', '/outfits', {
    userId,
    occasion: 'Üniversite',
    clothingItemIds: [item1.data.id, item2.data.id, item3.data.id],
  })
  check('POST → 201', outfit.status === 201)
  check('parçalar gömülü döndü', outfit.data?.items?.length === 3, `${outfit.data?.items?.length} parça`)

  check('boş items → 400', (await call('POST', '/outfits', { userId, clothingItemIds: [] })).status === 400)
  check(
    'tekrarlı items → 400',
    (await call('POST', '/outfits', { userId, clothingItemIds: [item1.data.id, item1.data.id] })).status === 400,
  )
  check(
    'başkasının parçası → 400',
    (await call('POST', '/outfits', {
      userId,
      clothingItemIds: ['00000000-0000-0000-0000-000000000000'],
    })).status === 400,
  )
  check(
    'occasion 51 karakter → 400',
    (await call('POST', '/outfits', {
      userId,
      occasion: longText(51),
      clothingItemIds: [item1.data.id],
    })).status === 400,
  )

  check('GET liste → 200', (await call('GET', `/outfits?userId=${userId}`)).status === 200)
  check('userId yok → 400', (await call('GET', '/outfits')).status === 400)
  check('GET /:id → 200', (await call('GET', `/outfits/${outfit.data.id}`)).status === 200)
  check(
    'GET /<olmayan> → 404',
    (await call('GET', '/outfits/00000000-0000-0000-0000-000000000000')).status === 404,
  )

  const updatedOutfit = await call('PUT', `/outfits/${outfit.data.id}`, {
    occasion: 'Akşam Yemeği',
    clothingItemIds: [item1.data.id],
  })
  check('PUT → 200', updatedOutfit.status === 200)
  check('parça listesi değişti', updatedOutfit.data?.items?.length === 1)
  check('occasion güncellendi', updatedOutfit.data?.occasion === 'Akşam Yemeği')

  const outfitFav = await call('PATCH', `/outfits/${outfit.data.id}/favorite`)
  check('PATCH favorite → true', outfitFav.data?.is_favorite === true)
  const worn = await call('PATCH', `/outfits/${outfit.data.id}/worn`)
  check('PATCH worn → times_worn 1', worn.data?.times_worn === 1)
  check(
    'PATCH worn <olmayan> → 404',
    (await call('PATCH', '/outfits/00000000-0000-0000-0000-000000000000/worn')).status === 404,
  )

  // ---------------- İLİŞKİSEL DAVRANIŞ ----------------
  console.log('\n7) İLİŞKİSEL DAVRANIŞ')
  await call('DELETE', `/clothing-items/${item1.data.id}`)
  const afterSoftDelete = await call('GET', `/outfits/${outfit.data.id}`)
  check('soft delete edilen parça kombinden düşer', afterSoftDelete.data?.items?.length === 0)
  check('kombin yine erişilebilir', afterSoftDelete.status === 200)
  check(
    'soft delete edilen parça 404',
    (await call('GET', `/clothing-items/${item1.data.id}`)).status === 404,
  )
  check(
    'soft delete edilen parça listede yok',
    (await call('GET', `/clothing-items?userId=${userId}`)).data?.length === 2,
  )

  check('DELETE /outfits/:id → 204', (await call('DELETE', `/outfits/${outfit.data.id}`)).status === 204)
  check('silinen kombin 404', (await call('GET', `/outfits/${outfit.data.id}`)).status === 404)

  // ---------------- CASCADE ----------------
  console.log('\n8) CASCADE (kullanıcı silme)')
  check('DELETE /users/:id → 204', (await call('DELETE', `/users/${userId}`)).status === 204)
  check('kullanıcı gitti', (await call('GET', `/users/${userId}`)).status === 404)
  check(
    'tercihleri CASCADE ile gitti',
    (await call('GET', `/style-preferences?userId=${userId}`)).status === 404,
  )
  const itemsAfterCascade = await call('GET', `/clothing-items?userId=${userId}`)
  check('parçaları CASCADE ile gitti', itemsAfterCascade.data?.length === 0)
  const outfitsAfterCascade = await call('GET', `/outfits?userId=${userId}`)
  check('kombinleri CASCADE ile gitti', outfitsAfterCascade.data?.length === 0)

  console.log(`\n${'='.repeat(46)}`)
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
