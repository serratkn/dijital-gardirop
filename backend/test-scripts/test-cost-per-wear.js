// Kullanım başına maliyet (cost-per-wear) — parçaya isteğe bağlı bir satın
// alma fiyatı eklenip bunun kombinlerde "Bugün Giydim" ile artan
// outfits.times_worn toplamına bölünmesiyle hesaplanır.
//
// Kullanım (backend/ klasöründen, sunucu ÇALIŞIYOR olmalı):
//   node test-scripts/test-cost-per-wear.js

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const pool = require('../src/config/database')

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

async function call(method, endpoint, body, token) {
  const res = await fetch(`${BASE}${endpoint}`, {
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

async function main() {
  console.log('\n=== KULLANIM BAŞINA MALİYET (cost-per-wear) ===\n')

  const email = `cost-per-wear-${Date.now()}@example.com`
  const reg = await call('POST', '/auth/register', { name: 'Cost Test', email, password: 'sifre1234' })
  check('Test kullanıcısı oluşturuldu', reg.status === 201, `${reg.status}`)
  const token = reg.data.token
  const userId = reg.data.user.id

  const categories = await call('GET', '/categories', null, token)
  const categoryId = categories.data[0].id

  console.log('\n1) Fiyat girilmeden oluşturma — purchase_price NULL, cost_per_wear NULL')
  {
    const created = await call('POST', '/clothing-items', { categoryId, name: 'Fiyatsız Parça' }, token)
    check('201 döndü', created.status === 201)
    check('purchase_price NULL', created.data.purchase_price === null)

    const fetched = await call('GET', `/clothing-items/${created.data.id}`, null, token)
    check('GET tekilde cost_per_wear NULL (fiyat yok)', fetched.data.cost_per_wear === null)
    check('GET tekilde total_times_worn 0', fetched.data.total_times_worn === 0)
  }

  console.log('\n2) Fiyatlı, hiç giyilmemiş parça — cost_per_wear NULL (0\'a bölünmez)')
  let itemId
  {
    const created = await call(
      'POST',
      '/clothing-items',
      { categoryId, name: 'Ceket', purchasePrice: 1400 },
      token,
    )
    check('201 döndü', created.status === 201)
    itemId = created.data.id
    check('purchase_price doğru kaydedildi', Number(created.data.purchase_price) === 1400, created.data.purchase_price)

    const fetched = await call('GET', `/clothing-items/${itemId}`, null, token)
    check(
      'HİÇ giyilmemiş parçada cost_per_wear NULL (0\'a bölme değil)',
      fetched.data.cost_per_wear === null,
    )
  }

  console.log('\n3) Kombin oluşturup 2 kez "Bugün Giydim" — cost_per_wear = fiyat / toplam giyilme')
  {
    const outfit = await call(
      'POST',
      '/outfits',
      { occasion: 'Test', clothingItemIds: [itemId] },
      token,
    )
    check('Kombin oluşturuldu', outfit.status === 201, `${outfit.status}`)

    await call('PATCH', `/outfits/${outfit.data.id}/worn`, null, token)
    await call('PATCH', `/outfits/${outfit.data.id}/worn`, null, token)

    const fetched = await call('GET', `/clothing-items/${itemId}`, null, token)
    check('total_times_worn = 2', fetched.data.total_times_worn === 2, `${fetched.data.total_times_worn}`)
    check(
      'KRİTİK — cost_per_wear = 1400 / 2 = 700',
      fetched.data.cost_per_wear === 700,
      `${fetched.data.cost_per_wear}`,
    )
  }

  console.log('\n4) İKİNCİ bir kombinle aynı parça bir kez daha giyiliyor — toplam 3 giyilme')
  {
    const outfit2 = await call(
      'POST',
      '/outfits',
      { occasion: 'Diğer', clothingItemIds: [itemId] },
      token,
    )
    await call('PATCH', `/outfits/${outfit2.data.id}/worn`, null, token)

    const fetched = await call('GET', `/clothing-items/${itemId}`, null, token)
    check(
      'İki AYRI kombindeki giyilmeler TOPLANIYOR (total_times_worn = 3)',
      fetched.data.total_times_worn === 3,
      `${fetched.data.total_times_worn}`,
    )
    check(
      'cost_per_wear güncellendi (1400 / 3 ≈ 466.67)',
      Math.abs(fetched.data.cost_per_wear - 466.67) < 0.01,
      `${fetched.data.cost_per_wear}`,
    )
  }

  console.log('\n5) Doğrulama — geçersiz fiyat reddediliyor')
  {
    const negative = await call('POST', '/clothing-items', { categoryId, name: 'X', purchasePrice: -5 }, token)
    check('Negatif fiyat 400 ile reddediliyor', negative.status === 400, `${negative.status}`)

    const nonNumeric = await call('POST', '/clothing-items', { categoryId, name: 'X', purchasePrice: 'abc' }, token)
    check('Sayı olmayan fiyat 400 ile reddediliyor', nonNumeric.status === 400, `${nonNumeric.status}`)
  }

  console.log('\n6) PUT ile fiyat gönderilmezse KORUNUR (isClean ile aynı ilke)')
  {
    const beforePut = await call('GET', `/clothing-items/${itemId}`, null, token)
    const putRes = await call(
      'PUT',
      `/clothing-items/${itemId}`,
      { categoryId, name: 'Ceket (güncellendi)' },
      token,
    )
    check('PUT başarılı', putRes.status === 200, `${putRes.status}`)
    check(
      'purchasePrice gönderilmedi ama KORUNDU',
      Number(putRes.data.purchase_price) === Number(beforePut.data.purchase_price),
      `${putRes.data.purchase_price}`,
    )
  }

  console.log('\n7) PUT ile purchasePrice: null gönderilirse GERÇEKTEN temizlenir')
  {
    const putRes = await call(
      'PUT',
      `/clothing-items/${itemId}`,
      { categoryId, name: 'Ceket', purchasePrice: null },
      token,
    )
    check('purchase_price NULL\'a döndü', putRes.data.purchase_price === null)

    const fetched = await call('GET', `/clothing-items/${itemId}`, null, token)
    check('cost_per_wear de NULL (fiyat yok)', fetched.data.cost_per_wear === null)
  }

  console.log('\n8) Liste ucu (GET /clothing-items) cost_per_wear TAŞIMAZ (bilinçli kapsam sınırı)')
  {
    const list = await call('GET', '/clothing-items', null, token)
    check(
      'Liste yanıtında cost_per_wear/total_times_worn alanları YOK',
      list.data.every((item) => !('cost_per_wear' in item) && !('total_times_worn' in item)),
    )
    check('Liste yanıtında purchase_price VAR (form ön-doldurma için)', 'purchase_price' in list.data[0])
  }

  console.log('\n9) Temizlik')
  await pool.query('DELETE FROM users WHERE id = $1', [userId])
  check('Test kullanıcısı silindi', true)

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
