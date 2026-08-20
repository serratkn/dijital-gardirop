// GET /api/users/:id/stats testleri.
// Profil sayfasındaki "Gardırop İstatistiklerim" kartını besleyen uç.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-stats.js
//
// Script kendi hesaplarını açar ve sonunda siler (CASCADE ile kıyafet/kombinler de gider).
// Üç veri durumu ayrı ayrı sürülür: BOŞ (yeni kullanıcı), AZ VERİ, ÇOK VERİ.

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
  `stats-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`

async function registerUser(tag) {
  const result = await call('POST', '/auth/register', {
    body: { name: `${tag} Test`, email: email(tag), password: 'GucluSifre123' },
  })
  if (result.status !== 201) {
    throw new Error(`${tag} kaydedilemedi: ${JSON.stringify(result.data)}`)
  }
  return { token: result.data.token, id: result.data.user.id }
}

async function createItem(token, payload) {
  const result = await call('POST', '/clothing-items', { token, body: payload })
  if (result.status !== 201) {
    throw new Error(`Kıyafet oluşturulamadı: ${JSON.stringify(result.data)}`)
  }
  return result.data
}

async function createOutfit(token, occasion, clothingItemIds) {
  const result = await call('POST', '/outfits', { token, body: { occasion, clothingItemIds } })
  if (result.status !== 201) {
    throw new Error(`Kombin oluşturulamadı: ${JSON.stringify(result.data)}`)
  }
  return result.data
}

function getStats(user) {
  return call('GET', `/users/${user.id}/stats`, { token: user.token })
}

async function main() {
  console.log(`Hedef: ${BASE_URL}\n`)

  const bos = await registerUser('bos')
  const az = await registerUser('az')
  const cok = await registerUser('cok')

  // --- 1. BOŞ: yeni kullanıcı ---
  console.log('1) BOŞ veri — yeni kullanıcı')
  const bosStats = await getStats(bos)
  check('HTTP 200', bosStats.status === 200, `gelen: ${bosStats.status}`)
  check('has_data false', bosStats.data?.has_data === false, `gelen: ${bosStats.data?.has_data}`)
  check('items.total 0', bosStats.data?.items?.total === 0)
  check('items.favorite 0', bosStats.data?.items?.favorite === 0)
  check('items.clean 0', bosStats.data?.items?.clean === 0)
  check('items.dirty 0', bosStats.data?.items?.dirty === 0)
  check(
    'by_category boş dizi',
    Array.isArray(bosStats.data?.items?.by_category) &&
      bosStats.data.items.by_category.length === 0,
  )
  check('outfits.total 0', bosStats.data?.outfits?.total === 0)
  // Uydurma varsayılan yerine null: "en çok kullandığın renk: Beyaz (0)" yanlış bilgi olurdu.
  check('colors.top null', bosStats.data?.colors?.top === null)
  check('outfits.top_occasion null', bosStats.data?.outfits?.top_occasion === null)
  check('generated_at var', typeof bosStats.data?.generated_at === 'string')

  // Sayımlar SAYI olmalı: COUNT(*) ::int ile daraltılmazsa pg string döndürür.
  check(
    'sayımlar number tipinde (string değil)',
    typeof bosStats.data?.items?.total === 'number' &&
      typeof bosStats.data?.outfits?.total === 'number',
    `tipler: ${typeof bosStats.data?.items?.total} / ${typeof bosStats.data?.outfits?.total}`,
  )

  // --- 2. AZ VERİ: tek parça, kombin yok ---
  console.log('\n2) AZ veri — 1 parça, kombin yok')
  const tekParca = await createItem(az.token, {
    categoryId: 1,
    name: 'Tek Gömlek',
    color: 'Beyaz',
  })
  const azStats = await getStats(az)
  check('has_data true', azStats.data?.has_data === true)
  check('items.total 1', azStats.data?.items?.total === 1, `gelen: ${azStats.data?.items?.total}`)
  check('varsayılan temiz sayılır', azStats.data?.items?.clean === 1)
  check('dirty 0', azStats.data?.items?.dirty === 0)
  check('favorite 0', azStats.data?.items?.favorite === 0)
  check('by_category tek satır', azStats.data?.items?.by_category?.length === 1)
  check(
    'kategori adı Üst',
    azStats.data?.items?.by_category?.[0]?.name === 'Üst',
    `gelen: ${azStats.data?.items?.by_category?.[0]?.name}`,
  )
  check('kategori sayısı 1', azStats.data?.items?.by_category?.[0]?.count === 1)
  check('kategori icon alanı var', Boolean(azStats.data?.items?.by_category?.[0]?.icon))
  check('top color Beyaz', azStats.data?.colors?.top?.name === 'Beyaz')
  check('top color sayısı 1', azStats.data?.colors?.top?.count === 1)
  // Parça var ama kombin yok: has_data true olsa da top_occasion NULL kalmalı.
  check('kombin yokken top_occasion null', azStats.data?.outfits?.top_occasion === null)
  check('outfits.total 0', azStats.data?.outfits?.total === 0)

  console.log('\n2b) Parça soft delete edilince istatistikten düşüyor mu?')
  await createOutfit(az.token, 'Test Durumu', [tekParca.id])
  const silme = await call('DELETE', `/clothing-items/${tekParca.id}`, { token: az.token })
  check('parça silindi', silme.status === 204, `gelen: ${silme.status}`)
  const azSonra = await getStats(az)
  check(
    'items.total 0 (soft delete sayılmıyor)',
    azSonra.data?.items?.total === 0,
    `gelen: ${azSonra.data?.items?.total}`,
  )
  check('by_category boşaldı', azSonra.data?.items?.by_category?.length === 0)
  check('top color null oldu', azSonra.data?.colors?.top === null)
  // Kombin duruyor: parçası silinen kombin kaybolmaz (uygulamanın geri kalanıyla tutarlı).
  check('kombin sayısı korundu', azSonra.data?.outfits?.total === 1)
  check('parça yokken bile has_data true (kombin var)', azSonra.data?.has_data === true)

  // --- 3. ÇOK VERİ ---
  console.log('\n3) ÇOK veri — 10 parça, 5 kombin')
  // Renk dağılımı: Siyah x4, Beyaz x3, Bordo x2, (renksiz) x1 → en çok Siyah
  const parcalar = []
  parcalar.push(await createItem(cok.token, { categoryId: 1, name: 'Ust 1', color: 'Siyah' }))
  parcalar.push(await createItem(cok.token, { categoryId: 1, name: 'Ust 2', color: 'Siyah' }))
  parcalar.push(await createItem(cok.token, { categoryId: 1, name: 'Ust 3', color: 'Beyaz' }))
  parcalar.push(await createItem(cok.token, { categoryId: 1, name: 'Ust 4', color: 'Beyaz' }))
  parcalar.push(await createItem(cok.token, { categoryId: 2, name: 'Alt 1', color: 'Siyah' }))
  parcalar.push(await createItem(cok.token, { categoryId: 2, name: 'Alt 2', color: 'Siyah' }))
  parcalar.push(await createItem(cok.token, { categoryId: 2, name: 'Alt 3', color: 'Bordo' }))
  parcalar.push(await createItem(cok.token, { categoryId: 4, name: 'Ayakkabi 1', color: 'Bordo' }))
  parcalar.push(await createItem(cok.token, { categoryId: 4, name: 'Ayakkabi 2', color: 'Beyaz' }))
  // Rengi hiç girilmemiş parça: "en çok renk" yarışına girmemeli.
  parcalar.push(await createItem(cok.token, { categoryId: 5, name: 'Canta 1' }))

  // 2 parça kirli, 3 parça favori
  await call('PATCH', `/clothing-items/${parcalar[0].id}/clean-status`, { token: cok.token })
  await call('PATCH', `/clothing-items/${parcalar[1].id}/clean-status`, { token: cok.token })
  await call('PATCH', `/clothing-items/${parcalar[0].id}/favorite`, { token: cok.token })
  await call('PATCH', `/clothing-items/${parcalar[3].id}/favorite`, { token: cok.token })
  await call('PATCH', `/clothing-items/${parcalar[7].id}/favorite`, { token: cok.token })

  // Kombinler: Akşam Yemeği x3, Üniversite x1, durumsuz x1 → en çok Akşam Yemeği
  await createOutfit(cok.token, 'Akşam Yemeği', [parcalar[0].id, parcalar[4].id])
  await createOutfit(cok.token, 'Akşam Yemeği', [parcalar[1].id, parcalar[5].id])
  await createOutfit(cok.token, 'Akşam Yemeği', [parcalar[2].id])
  await createOutfit(cok.token, 'Üniversite', [parcalar[3].id, parcalar[6].id])
  await createOutfit(cok.token, null, [parcalar[8].id])

  const cokStats = await getStats(cok)
  check('HTTP 200', cokStats.status === 200)
  check('has_data true', cokStats.data?.has_data === true)
  check(
    'items.total 10',
    cokStats.data?.items?.total === 10,
    `gelen: ${cokStats.data?.items?.total}`,
  )
  check(
    'favorite 3',
    cokStats.data?.items?.favorite === 3,
    `gelen: ${cokStats.data?.items?.favorite}`,
  )
  check('clean 8', cokStats.data?.items?.clean === 8, `gelen: ${cokStats.data?.items?.clean}`)
  check('dirty 2', cokStats.data?.items?.dirty === 2, `gelen: ${cokStats.data?.items?.dirty}`)
  check(
    'clean + dirty = total',
    cokStats.data?.items?.clean + cokStats.data?.items?.dirty === cokStats.data?.items?.total,
  )

  const dagilim = cokStats.data?.items?.by_category ?? []
  check('4 kategoride parça var', dagilim.length === 4, `gelen: ${dagilim.length}`)
  // Parçası olmayan kategori listede HİÇ görünmemeli ("0 Elbise" satırı olmamalı).
  check('parçasız kategori listelenmiyor', !dagilim.some((row) => row.count === 0))
  check(
    'sayıya göre azalan sıralı',
    dagilim.every((row, i) => i === 0 || dagilim[i - 1].count >= row.count),
    dagilim.map((r) => `${r.name}:${r.count}`).join(', '),
  )
  const ust = dagilim.find((row) => row.name === 'Üst')
  const alt = dagilim.find((row) => row.name === 'Alt')
  const canta = dagilim.find((row) => row.name === 'Çanta')
  check('Üst 4', ust?.count === 4, `gelen: ${ust?.count}`)
  check('Alt 3', alt?.count === 3, `gelen: ${alt?.count}`)
  check('Çanta 1', canta?.count === 1, `gelen: ${canta?.count}`)
  check(
    'kategori toplamı = items.total',
    dagilim.reduce((sum, row) => sum + row.count, 0) === cokStats.data?.items?.total,
  )
  // Türkçe karakterler yolun tamamında bozulmadan geliyor mu?
  check(
    'Türkçe kategori adı bozulmamış',
    ust?.name === 'Üst' && canta?.name === 'Çanta',
    `${ust?.name} / ${canta?.name}`,
  )

  check(
    'top color Siyah',
    cokStats.data?.colors?.top?.name === 'Siyah',
    `gelen: ${cokStats.data?.colors?.top?.name}`,
  )
  check(
    'top color sayısı 4',
    cokStats.data?.colors?.top?.count === 4,
    `gelen: ${cokStats.data?.colors?.top?.count}`,
  )

  check(
    'outfits.total 5',
    cokStats.data?.outfits?.total === 5,
    `gelen: ${cokStats.data?.outfits?.total}`,
  )
  check(
    'top_occasion Akşam Yemeği',
    cokStats.data?.outfits?.top_occasion?.name === 'Akşam Yemeği',
    `gelen: ${cokStats.data?.outfits?.top_occasion?.name}`,
  )
  // Durumsuz (occasion NULL) kombin "en çok" yarışına girmemeli.
  check(
    'top_occasion sayısı 3',
    cokStats.data?.outfits?.top_occasion?.count === 3,
    `gelen: ${cokStats.data?.outfits?.top_occasion?.count}`,
  )

  // --- 4. Veri izolasyonu: başkasının istatistiğine erişilemez ---
  console.log('\n4) Yetkilendirme — başkasının istatistiği')
  const baskasi = await call('GET', `/users/${cok.id}/stats`, { token: az.token })
  check('başkasının id ile 404', baskasi.status === 404, `gelen: ${baskasi.status}`)
  check('kayıt varlığı sızmıyor (403 değil)', baskasi.status !== 403)
  check('Türkçe hata mesajı', typeof baskasi.data?.error === 'string', baskasi.data?.error)
  // Sızıntı kontrolü: yanıt gövdesinde başka kullanıcının sayıları olmamalı.
  check('yanıtta istatistik yok', baskasi.data?.items === undefined)

  const tokensiz = await call('GET', `/users/${cok.id}/stats`)
  check('token olmadan 401', tokensiz.status === 401, `gelen: ${tokensiz.status}`)

  const bozukToken = await call('GET', `/users/${cok.id}/stats`, {
    token: 'gecersiz.token.degeri',
  })
  check('geçersiz token 401', bozukToken.status === 401, `gelen: ${bozukToken.status}`)

  // Var olmayan / bozuk biçimli id: sahiplik kontrolüne takılıp 404 dönmeli,
  // Postgres'e gidip 22P02 ile 500'e DÜŞMEMELİ.
  const bozukId = await call('GET', '/users/boyle-bir-uuid-yok/stats', { token: az.token })
  check('geçersiz UUID 404 (500 değil)', bozukId.status === 404, `gelen: ${bozukId.status}`)

  // Kendi istatistiğini okumak elbette serbest.
  const kendi = await getStats(cok)
  check('kendi istatistiği 200', kendi.status === 200)

  // --- 5. Temizlik ---
  console.log('\n5) Temizlik')
  const silinenler = await Promise.all([
    call('DELETE', `/users/${bos.id}`, { token: bos.token }),
    call('DELETE', `/users/${az.id}`, { token: az.token }),
    call('DELETE', `/users/${cok.id}`, { token: cok.token }),
  ])
  check(
    'test hesapları silindi',
    silinenler.every((result) => result.status === 204),
    silinenler.map((result) => result.status).join(' / '),
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
