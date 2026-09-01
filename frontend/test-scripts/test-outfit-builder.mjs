// Kombin kurma mantığı — saf fonksiyon testleri (Gemini Aşama 4).
//
// Kullanım (frontend/ klasöründen):
//   node test-scripts/test-outfit-builder.mjs
//
// SUNUCU, CHROMA VE ANAHTAR GEREKTİRMEZ: lib/outfitBuilder.js React'tan ve
// ağ katmanından bağımsız yazıldığı için doğrudan çalıştırılabiliyor.
//
// Asıl güvence burada: vektör adaylarının temiz/kirli ve hava durumu
// filtrelerini ATLAYAMAMASI ve bir kategoride aday kalmadığında YALNIZCA
// O SLOTUN rastgele seçime düşmesi.

import {
  CANDIDATE_CATEGORIES,
  DRESS_CATEGORY,
  MAKEUP_CATEGORY,
  OUTERWEAR_CATEGORY,
  OUTFIT_CATEGORIES,
  buildOutfitFromCandidates,
  buildRandomOutfit,
  createMoodContext,
  isSameOutfit,
  pickMakeupItem,
  pickOuterwearItem,
  pickSeedItem,
  resolveActiveCategories,
  variantDepth,
} from '../src/lib/outfitBuilder.js'
import { matchesSkinTone } from '../src/lib/skinTone.js'

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

// ---- Test gardırobu ----
// Adlar kategoriyi ve özelliği taşısın diye kısa tutuldu.

let sayac = 0
function parca(overrides = {}) {
  sayac += 1
  return {
    id: `id-${sayac}`,
    name: `parca-${sayac}`,
    category: 'Üst',
    season: null,
    isClean: true,
    aiAnalysis: null,
    ...overrides,
  }
}

const kategoriler = (items) => items.map((item) => item.category)
const adlar = (items) => items.map((item) => item.name)

console.log('\n=== KOMBİN KURMA MANTIĞI (Aşama 4) ===\n')

// ---------------------------------------------------------------
console.log('1) buildRandomOutfit — mevcut davranış (regresyon)')

{
  const items = [
    parca({ name: 'ust-1', category: 'Üst' }),
    parca({ name: 'alt-1', category: 'Alt' }),
    parca({ name: 'ayk-1', category: 'Ayakkabı' }),
    parca({ name: 'cnt-1', category: 'Çanta' }),
    parca({ name: 'makyaj-1', category: 'Makyaj' }),
  ]

  const kombin = buildRandomOutfit(items, null)
  check('Dört kombin kategorisi de dolu', kombin.length === 4, kategoriler(kombin).join(', '))
  check(
    'Kombin kategorileri doğru sırada',
    JSON.stringify(kategoriler(kombin)) === JSON.stringify(OUTFIT_CATEGORIES),
  )
  check('Makyaj kombine GİRMİYOR', !adlar(kombin).includes('makyaj-1'))

  // O kategoride parça yoksa slot atlanır, kombin yine üretilir.
  const eksik = buildRandomOutfit(
    items.filter((item) => item.category !== 'Çanta'),
    null,
  )
  check('Parçası olmayan kategori slotu atlanıyor', eksik.length === 3)

  // Sezon ÖNCELİKLENDİRİR, ELEMEZ.
  const sezonlu = [
    parca({ name: 'yaz-ust', category: 'Üst', season: 'Yaz' }),
    parca({ name: 'kis-ust', category: 'Üst', season: 'Kış' }),
    parca({ name: 'kis-alt', category: 'Alt', season: 'Kış' }),
  ]
  const yazKombinleri = Array.from({ length: 40 }, () => buildRandomOutfit(sezonlu, ['Yaz']))
  check(
    'Uygun sezondaki parça tercih ediliyor',
    yazKombinleri.every((k) => adlar(k).includes('yaz-ust')),
  )
  check(
    'Uygun sezonda parça YOKSA tüm havuza düşülüyor (slot boş kalmıyor)',
    yazKombinleri.every((k) => adlar(k).includes('kis-alt')),
  )

  const sezonsuz = [parca({ name: 'sezonsuz-ust', category: 'Üst', season: null })]
  check(
    'Sezonu boş parça her havaya uygun',
    buildRandomOutfit(sezonsuz, ['Kış']).length === 1,
  )
}

// ---------------------------------------------------------------
console.log('\n2) pickSeedItem — başlangıç parçası seçimi')

{
  const analizli = parca({ name: 'analizli-ust', category: 'Üst', aiAnalysis: { veri: {} } })
  const analizsiz = parca({ name: 'analizsiz-ust', category: 'Üst' })
  const makyaj = parca({ name: 'makyaj', category: 'Makyaj', aiAnalysis: { veri: {} } })

  const secimler = Array.from({ length: 60 }, () =>
    pickSeedItem([analizli, analizsiz, makyaj], null),
  )
  check(
    'ANALİZİ OLAN parça tercih ediliyor (embedding onun üstünden üretiliyor)',
    secimler.every((s) => s.name === 'analizli-ust'),
  )
  check('Makyaj başlangıç parçası OLAMAZ', !secimler.some((s) => s.category === 'Makyaj'))

  check(
    'Analizli parça yoksa analizsiz parçaya düşülüyor',
    pickSeedItem([analizsiz], null)?.name === 'analizsiz-ust',
  )
  check('Hiç uygun parça yoksa null', pickSeedItem([makyaj], null) === null)

  // Hava durumu önceliği başlangıç parçasında da geçerli.
  const yazlik = parca({ name: 'yazlik', category: 'Üst', season: 'Yaz', aiAnalysis: {} })
  const kislik = parca({ name: 'kislik', category: 'Üst', season: 'Kış', aiAnalysis: {} })
  check(
    'Hava durumuna uygun sezon önceliklendiriliyor',
    Array.from({ length: 40 }, () => pickSeedItem([yazlik, kislik], ['Yaz'])).every(
      (s) => s.name === 'yazlik',
    ),
  )

  // excludeId: "Başka Öneri Göster" yeni bir başlangıç parçası isterken.
  const a = parca({ name: 'a', category: 'Üst', aiAnalysis: {} })
  const b = parca({ name: 'b', category: 'Alt', aiAnalysis: {} })
  check(
    'excludeId verilen parça seçilmiyor',
    Array.from({ length: 40 }, () => pickSeedItem([a, b], null, { excludeId: a.id })).every(
      (s) => s.id === b.id,
    ),
  )
  check(
    'Alternatifi yoksa excludeId yok sayılıyor (öneri yine üretilir)',
    pickSeedItem([a], null, { excludeId: a.id })?.id === a.id,
  )
}

// ---------------------------------------------------------------
console.log('\n3) buildOutfitFromCandidates — vektör adaylarından kombin')

{
  const seed = parca({ name: 'seed-ust', category: 'Üst', aiAnalysis: {} })
  const altYakin = parca({ name: 'alt-yakin', category: 'Alt' })
  const altUzak = parca({ name: 'alt-uzak', category: 'Alt' })
  const ayk = parca({ name: 'ayk-yakin', category: 'Ayakkabı' })
  const cnt = parca({ name: 'cnt-yakin', category: 'Çanta' })

  const cleanItems = [seed, altYakin, altUzak, ayk, cnt]
  const candidatesByCategory = new Map([
    ['Alt', [altYakin, altUzak]],
    ['Ayakkabı', [ayk]],
    ['Çanta', [cnt]],
  ])

  const v0 = buildOutfitFromCandidates({ seedItem: seed, candidatesByCategory, cleanItems, seasons: null })
  check('Başlangıç parçası kendi slotunda', adlar(v0.items)[0] === 'seed-ust')
  check(
    'En yakın adaylar seçildi',
    JSON.stringify(adlar(v0.items)) ===
      JSON.stringify(['seed-ust', 'alt-yakin', 'ayk-yakin', 'cnt-yakin']),
  )
  check('vectorCount = vektörden gelen slot sayısı', v0.vectorCount === 3, `${v0.vectorCount}`)
  check('fallbackCount sıfır', v0.fallbackCount === 0)

  // "Başka Öneri Göster" — aynı başlangıç parçasıyla sıradaki aday.
  const v1 = buildOutfitFromCandidates({
    seedItem: seed,
    candidatesByCategory,
    cleanItems,
    seasons: null,
    variant: 1,
  })
  check('variant=1 ikinci en yakın adayı seçiyor', adlar(v1.items).includes('alt-uzak'))
  check('Başlangıç parçası varyantla değişmiyor', adlar(v1.items)[0] === 'seed-ust')
  check('İki varyant birbirinden farklı', !isSameOutfit(v0.items, v1.items))
  check(
    'Havuzu tek adaylı kategori aynı kalıyor (başa sarıyor)',
    adlar(v1.items).includes('ayk-yakin'),
  )
}

// ---------------------------------------------------------------
console.log('\n4) KRİTİK — vektör adayları temiz/kirli filtresini ATLAMIYOR')

{
  const seed = parca({ name: 'seed-ust', category: 'Üst' })
  const kirliEnYakin = parca({ name: 'alt-kirli', category: 'Alt', isClean: false })
  const temizUzak = parca({ name: 'alt-temiz', category: 'Alt' })

  const cleanItems = [seed, temizUzak] // kirli parça buraya HİÇ girmez
  const candidatesByCategory = new Map([['Alt', [kirliEnYakin, temizUzak]]])

  const sonuc = buildOutfitFromCandidates({ seedItem: seed, candidatesByCategory, cleanItems, seasons: null })
  check('En yakın aday KİRLİ olduğu için elendi', !adlar(sonuc.items).includes('alt-kirli'))
  check('Yerine temiz aday seçildi', adlar(sonuc.items).includes('alt-temiz'))

  // Tüm adaylar kirliyse o slot rastgele seçime düşer.
  const hepsiKirli = new Map([['Alt', [kirliEnYakin]]])
  const dusen = buildOutfitFromCandidates({
    seedItem: seed,
    candidatesByCategory: hepsiKirli,
    cleanItems,
    seasons: null,
  })
  check('Adayların hepsi kirliyse slot rastgele seçime düşüyor', dusen.fallbackCount === 1)
  check('Rastgele seçim de kirli parçayı ALMIYOR', !adlar(dusen.items).includes('alt-kirli'))
  check('Vektörden gelen slot kalmadı', dusen.vectorCount === 0)

  // Kirli parça HİÇBİR kategoride kombine giremez.
  const kirliAyk = parca({ name: 'ayk-kirli', category: 'Ayakkabı', isClean: false })
  const yuzKombin = Array.from({ length: 100 }, () =>
    buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: new Map([['Ayakkabı', [kirliAyk]]]),
      cleanItems: [seed, kirliAyk].filter((item) => item.isClean !== false),
      seasons: null,
    }),
  )
  check(
    '100 kombinin hiçbirinde kirli parça yok',
    yuzKombin.every((k) => !adlar(k.items).includes('ayk-kirli')),
  )
}

// ---------------------------------------------------------------
console.log('\n5) KRİTİK — vektör adayları hava durumu filtresini ATLAMIYOR')

{
  const seed = parca({ name: 'seed-ust', category: 'Üst', season: 'Tüm Sezon' })
  const kislikEnYakin = parca({ name: 'alt-kislik', category: 'Alt', season: 'Kış' })
  const yazlikUzak = parca({ name: 'alt-yazlik', category: 'Alt', season: 'Yaz' })
  const cleanItems = [seed, kislikEnYakin, yazlikUzak]
  const candidatesByCategory = new Map([['Alt', [kislikEnYakin, yazlikUzak]]])

  const sicak = buildOutfitFromCandidates({ seedItem: seed, candidatesByCategory, cleanItems, seasons: ['Yaz'] })
  check(
    'Sıcak havada en yakın aday KIŞLIK olduğu için geri plana düştü',
    adlar(sicak.items).includes('alt-yazlik'),
  )
  check('Yine de vektörden gelmiş sayılıyor', sicak.vectorCount === 1)

  const soguk = buildOutfitFromCandidates({ seedItem: seed, candidatesByCategory, cleanItems, seasons: ['Kış'] })
  check('Soğuk havada kışlık aday seçiliyor', adlar(soguk.items).includes('alt-kislik'))

  // ÖNCELİKLENDİRME, ELEME DEĞİL: uygun sezonda aday yoksa slot boş kalmaz.
  const sadeceKislik = new Map([['Alt', [kislikEnYakin]]])
  const zorunlu = buildOutfitFromCandidates({
    seedItem: seed,
    candidatesByCategory: sadeceKislik,
    cleanItems,
    seasons: ['Yaz'],
  })
  check(
    'Uygun sezonda aday yoksa slot BOŞ KALMIYOR (önceliklendirme, eleme değil)',
    adlar(zorunlu.items).includes('alt-kislik'),
  )

  check(
    'Başlangıç parçasının sezonu kombini bozmuyor (Tüm Sezon her havaya uygun)',
    adlar(sicak.items)[0] === 'seed-ust',
  )
}

// ---------------------------------------------------------------
console.log('\n6) Geri düşüş (fallback) — kategori bazında, kombin bazında değil')

{
  const seed = parca({ name: 'seed-ust', category: 'Üst' })
  const alt = parca({ name: 'alt-aday', category: 'Alt' })
  const ayk = parca({ name: 'ayk-aday', category: 'Ayakkabı' })
  const cnt = parca({ name: 'cnt-indekssiz', category: 'Çanta' })
  const cleanItems = [seed, alt, ayk, cnt]

  // Çanta kategorisinde vektör adayı yok (embedding'i olmayan parça).
  const kismi = new Map([
    ['Alt', [alt]],
    ['Ayakkabı', [ayk]],
  ])

  const sonuc = buildOutfitFromCandidates({ seedItem: seed, candidatesByCategory: kismi, cleanItems, seasons: null })
  check('Kombin yine dört parçalı', sonuc.items.length === 4, adlar(sonuc.items).join(', '))
  check('Adayı olan kategoriler vektörden geldi', sonuc.vectorCount === 2)
  check('Adayı olmayan kategori rastgele seçimle doldu', sonuc.fallbackCount === 1)
  check('Rastgele dolan slot doğru kategoriden', adlar(sonuc.items).includes('cnt-indekssiz'))

  // Hiç aday yoksa davranış buildRandomOutfit ile aynı olmalı.
  const hicAday = buildOutfitFromCandidates({
    seedItem: null,
    candidatesByCategory: null,
    cleanItems,
    seasons: null,
  })
  check('Hiç aday yoksa vectorCount sıfır (rozet gösterilmez)', hicAday.vectorCount === 0)
  check('Hiç aday yoksa kombin yine tam', hicAday.items.length === 4)
  check(
    'Hiç aday yoksa kategoriler doğru',
    JSON.stringify(kategoriler(hicAday.items)) === JSON.stringify(OUTFIT_CATEGORIES),
  )

  // Gardırop boşsa kombin de boş (sayfa "temiz parçan yok" ekranına düşer).
  const bos = buildOutfitFromCandidates({
    seedItem: null,
    candidatesByCategory: null,
    cleanItems: [],
    seasons: null,
  })
  check('Boş gardıropta kombin boş', bos.items.length === 0)
}

// ---------------------------------------------------------------
console.log('\n7) variantDepth — "Başka Öneri Göster" ne zaman yeni başlangıç parçası ister')

{
  const temiz = (n, category) =>
    Array.from({ length: n }, () => parca({ category, isClean: true }))

  check('Havuz yoksa derinlik 0', variantDepth(null) === 0)
  check(
    'Derinlik en derin kategoriye göre',
    variantDepth(new Map([['Alt', temiz(3, 'Alt')], ['Çanta', temiz(1, 'Çanta')]])) === 3,
  )
  check(
    'KİRLİ adaylar derinliğe sayılmıyor',
    variantDepth(
      new Map([['Alt', [parca({ category: 'Alt', isClean: false }), parca({ category: 'Alt' })]]]),
    ) === 1,
  )
  check(
    'Hepsi kirliyse derinlik 0 (hemen yeni başlangıç parçası istenir)',
    variantDepth(new Map([['Alt', [parca({ category: 'Alt', isClean: false })]]])) === 0,
  )
  check(
    'MAKYAJ havuzu derinliğe SAYILMIYOR (yoksa dört kart değişmeden düğme dönerdi)',
    variantDepth(new Map([['Makyaj', temiz(5, 'Makyaj')], ['Alt', temiz(1, 'Alt')]])) === 1,
  )
}

// ---------------------------------------------------------------
console.log('\n8) pickMakeupItem — isteğe bağlı makyaj önerisi')

{
  const ruj = parca({ name: 'ruj', category: 'Makyaj' })
  const fondoten = parca({ name: 'fondoten', category: 'Makyaj' })
  const kirliMaskara = parca({ name: 'maskara-kirli', category: 'Makyaj', isClean: false })

  check('Havuz yoksa null (bölüm hiç gösterilmez)', pickMakeupItem(null) === null)
  check('Boş havuzda null', pickMakeupItem(new Map()) === null)
  check(
    'Makyaj adayı olmayan havuzda null (kombin kategorileri makyaj yerine geçmez)',
    pickMakeupItem(new Map([['Alt', [parca({ category: 'Alt' })]]])) === null,
  )

  const havuz = new Map([[MAKEUP_CATEGORY, [ruj, fondoten]]])
  check('En yakın makyaj ürünü seçiliyor', pickMakeupItem(havuz)?.name === 'ruj')
  check('variant=1 sıradaki ürünü veriyor', pickMakeupItem(havuz, 1)?.name === 'fondoten')
  check('Havuz tükenince başa sarıyor', pickMakeupItem(havuz, 2)?.name === 'ruj')

  check(
    'KİRLİ makyaj ürünü eleniyor',
    pickMakeupItem(new Map([[MAKEUP_CATEGORY, [kirliMaskara, ruj]]]))?.name === 'ruj',
  )
  check(
    'Hepsi kirliyse null — RASTGELE BİR ÜRÜNE DÜŞÜLMÜYOR',
    pickMakeupItem(new Map([[MAKEUP_CATEGORY, [kirliMaskara]]])) === null,
  )

  // Sezon makyaja UYGULANMAZ: "kışlık ruj" diye bir kavram yok.
  const yazlikRuj = parca({ name: 'yazlik-ruj', category: 'Makyaj', season: 'Yaz' })
  check(
    'Sezon makyajı elemiyor',
    pickMakeupItem(new Map([[MAKEUP_CATEGORY, [yazlikRuj]]]))?.name === 'yazlik-ruj',
  )
}

// ---------------------------------------------------------------
console.log('\n9) Makyaj kombin ızgarasına SIZMIYOR')

{
  const seed = parca({ name: 'seed-ust', category: 'Üst' })
  const ruj = parca({ name: 'ruj', category: 'Makyaj' })
  const alt = parca({ name: 'alt-aday', category: 'Alt' })
  const cleanItems = [seed, ruj, alt]
  const havuz = new Map([
    ['Alt', [alt]],
    [MAKEUP_CATEGORY, [ruj]],
  ])

  const sonuc = buildOutfitFromCandidates({
    seedItem: seed,
    candidatesByCategory: havuz,
    cleanItems,
    seasons: null,
  })
  check('Makyaj dört kartlık ızgaraya girmiyor', !adlar(sonuc.items).includes('ruj'))
  check('Makyaj vectorCount degerine sayilmiyor', sonuc.vectorCount === 1, `${sonuc.vectorCount}`)
  check(
    'Rastgele kombin de makyaj seçmiyor (regresyon)',
    !adlar(buildRandomOutfit(cleanItems, null)).includes('ruj'),
  )
  check(
    'Makyaj yine de ayrı öneri olarak erişilebilir',
    pickMakeupItem(havuz)?.name === 'ruj',
  )
  check(
    'CANDIDATE_CATEGORIES = kombin kategorileri + Makyaj + Dış Giyim + Elbise',
    JSON.stringify(CANDIDATE_CATEGORIES) ===
      JSON.stringify([...OUTFIT_CATEGORIES, MAKEUP_CATEGORY, OUTERWEAR_CATEGORY, DRESS_CATEGORY]),
    CANDIDATE_CATEGORIES.join(', '),
  )
}

// ---------------------------------------------------------------
console.log('\n9b) pickOuterwearItem — koşullu 5. slot (kışlık dış giyim)')

{
  const mont = parca({ name: 'mont', category: OUTERWEAR_CATEGORY })
  const kaban = parca({ name: 'kaban', category: OUTERWEAR_CATEGORY })
  const kirliMont = parca({ name: 'mont-kirli', category: OUTERWEAR_CATEGORY, isClean: false })
  const havuz = new Map([[OUTERWEAR_CATEGORY, [mont, kaban]]])

  check('Havuz yoksa null (bölüm hiç gösterilmez)', pickOuterwearItem(null, 'soğuk') === null)
  check('Boş havuzda null', pickOuterwearItem(new Map(), 'soğuk') === null)
  check(
    'Dış Giyim adayı olmayan havuzda null (kombin kategorileri yerine geçmez)',
    pickOuterwearItem(new Map([['Alt', [parca({ category: 'Alt' })]]]), 'soğuk') === null,
  )

  console.log('\n   KRİTİK — hava durumu koşulu (Makyaj\'dan TEK farkı)')
  check('Hava SOĞUK iken en yakın mont seçiliyor', pickOuterwearItem(havuz, 'soğuk')?.name === 'mont')
  check('Hava ILIK iken slot HİÇ denenmiyor (null)', pickOuterwearItem(havuz, 'ılık') === null)
  check('Hava SICAK iken slot HİÇ denenmiyor (null)', pickOuterwearItem(havuz, 'sıcak') === null)
  check(
    'Hava BİLİNMİYORSA (null) "belirsizlikte ekleme" — slot yine gösterilmiyor',
    pickOuterwearItem(havuz, null) === null,
  )
  check(
    'Hava BİLİNMİYORSA (undefined) da aynı şekilde gösterilmiyor',
    pickOuterwearItem(havuz, undefined) === null,
  )

  console.log('\n   Havuzda ilerleme ve temiz/kirli filtresi (Makyaj ile AYNI desen)')
  check('variant=1 sıradaki montu veriyor', pickOuterwearItem(havuz, 'soğuk', 1)?.name === 'kaban')
  check('Havuz tükenince başa sarıyor', pickOuterwearItem(havuz, 'soğuk', 2)?.name === 'mont')
  check(
    'KİRLİ dış giyim ürünü eleniyor',
    pickOuterwearItem(new Map([[OUTERWEAR_CATEGORY, [kirliMont, mont]]]), 'soğuk')?.name === 'mont',
  )
  check(
    'Hepsi kirliyse null — RASTGELE BİR MONTA DÜŞÜLMÜYOR',
    pickOuterwearItem(new Map([[OUTERWEAR_CATEGORY, [kirliMont]]]), 'soğuk') === null,
  )

  // Sezon dış giyime de UYGULANMAZ (Makyaj'daki gerekçenin aynısı): bu slot
  // zaten yalnızca hava soğukken çalışıyor, ayrı bir sezon filtresi gereksiz.
  const yazlikHirka = parca({ name: 'yazlik-hirka', category: OUTERWEAR_CATEGORY, season: 'Yaz' })
  check(
    'Sezon dış giyimi elemiyor',
    pickOuterwearItem(new Map([[OUTERWEAR_CATEGORY, [yazlikHirka]]]), 'soğuk')?.name === 'yazlik-hirka',
  )

  console.log('\n   Dış Giyim kombin ızgarasına SIZMIYOR (Makyaj ile AYNI garanti)')
  {
    const seed = parca({ name: 'seed-ust', category: 'Üst' })
    const alt = parca({ name: 'alt-aday', category: 'Alt' })
    const cleanItems = [seed, mont, alt]
    const karma = new Map([
      ['Alt', [alt]],
      [OUTERWEAR_CATEGORY, [mont]],
    ])

    const sonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: karma,
      cleanItems,
      seasons: null,
    })
    check('Dış Giyim dört kartlık ızgaraya girmiyor', !adlar(sonuc.items).includes('mont'))
    check('Dış Giyim vectorCount değerine sayılmıyor', sonuc.vectorCount === 1, `${sonuc.vectorCount}`)
    check(
      'Dış Giyim MAKYAJ HAVUZUNUN AYNI ANDA var olmasından etkilenmiyor',
      pickOuterwearItem(karma, 'soğuk')?.name === 'mont',
    )
    check(
      'variantDepth Dış Giyim havuzunu SAYMIYOR (yoksa dört kart değişmeden düğme dönerdi)',
      variantDepth(new Map([[OUTERWEAR_CATEGORY, [mont, kaban]], ['Alt', [alt]]])) === 1,
    )
  }
}

// ---------------------------------------------------------------
console.log('\n10) Serbest metin (mood) bağlamı — GERÇEK VAKA: "parmak arası terlik"')
console.log('    (bkz. deneme@gmail.com gardırobu: sneaker + terlik + babet + stiletto)')

{
  // --- createMoodContext ---
  check('interpretation yoksa moodContext null', createMoodContext(null) === null)
  check('interpretation yoksa moodContext null (undefined)', createMoodContext(undefined) === null)

  const context = createMoodContext({
    occasion: 'Akşam Yemeği',
    stil_tercihi: 'Sade ve Şık',
    kacinilmasi_gerekenler: ['Aşırı gösterişli', 'Çok rahat/spor'],
    onem_verilen_ozellikler: ['Dengeli görünüm'],
    arama_metni: 'Şık ama abartısız, dengeli bir akşam yemeği kombini',
  })
  check('occasion doğru taşınıyor', context.occasion === 'Akşam Yemeği')
  check('stilTercihi doğru taşınıyor (camelCase)', context.stilTercihi === 'Sade ve Şık')
  check(
    'kacinilanKelimeler "rahat" VE "spor" kelimelerini içeriyor',
    context.kacinilanKelimeler.has('rahat') && context.kacinilanKelimeler.has('spor'),
    [...context.kacinilanKelimeler].join(', '),
  )
  check(
    'Durak kelimeler ("çok", "aşırı") kacinilanKelimeler\'e GİRMİYOR',
    !context.kacinilanKelimeler.has('çok') && !context.kacinilanKelimeler.has('aşırı'),
  )

  // --- Gerçek gardıropla BİREBİR AYNI ai_analysis şekli ---
  const terlik = parca({
    name: 'parmak arası terlik',
    category: 'Ayakkabı',
    aiAnalysis: { veri: { stil: 'Plaj', ayakkabi_turu: 'Terlik' } },
  })
  const sneaker = parca({
    name: 'New balance 530',
    category: 'Ayakkabı',
    aiAnalysis: { veri: { stil: 'Spor', ayakkabi_turu: 'Sneaker' } },
  })
  const stiletto = parca({
    name: 'stradivarius bordo stiletto',
    category: 'Ayakkabı',
    aiAnalysis: { veri: { stil: 'Klasik', ayakkabi_turu: 'Stiletto' } },
  })
  const babet = parca({
    name: 'stradivarius babet',
    category: 'Ayakkabı',
    aiAnalysis: { veri: { stil: 'Klasik', ayakkabi_turu: 'Babet' } },
  })

  console.log('\n   a) preferFormalShoes — resmi durum + stil tercihi VARKEN')
  {
    const seed = parca({ name: 'seed-ust', category: 'Üst' })
    const cleanItems = [seed, terlik, sneaker, stiletto, babet]
    const havuz = new Map([['Ayakkabı', [terlik, sneaker, stiletto, babet]]])

    const sonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
      moodContext: context,
    })
    const secilenAyakkabi = sonuc.items.find((item) => item.category === 'Ayakkabı')?.name
    check(
      'KRİTİK — Akşam Yemeği + "Sade ve Şık" iken parmak arası terlik SEÇİLMİYOR',
      secilenAyakkabi !== 'parmak arası terlik',
      secilenAyakkabi,
    )
    check(
      'KRİTİK — sneaker de seçilmiyor (formal değil)',
      secilenAyakkabi !== 'New balance 530',
      secilenAyakkabi,
    )
    check(
      'Bunun yerine RESMİ etiketli bir ayakkabı (stiletto/babet) seçildi',
      secilenAyakkabi === 'stradivarius bordo stiletto' || secilenAyakkabi === 'stradivarius babet',
      secilenAyakkabi,
    )
  }

  console.log('\n   b) preferFormalShoes — moodContext YOKKEN (regresyon: eski davranış)')
  {
    const seed = parca({ name: 'seed-ust', category: 'Üst' })
    const cleanItems = [seed, terlik]
    const havuz = new Map([['Ayakkabı', [terlik]]])

    // moodContext verilmiyor: terlik TEK aday olduğu için normalde seçilir.
    const sonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
    })
    check(
      'moodContext YOKKEN tek aday (terlik) yine seçiliyor — davranış DEĞİŞMEDİ',
      sonuc.items.some((item) => item.name === 'parmak arası terlik'),
    )
  }

  console.log('\n   c) preferFormalShoes — resmi olmayan durumda (ör. Spor) etkisiz')
  {
    const sporContext = createMoodContext({
      occasion: 'Spor',
      stil_tercihi: 'Rahat',
      kacinilmasi_gerekenler: [],
    })
    const seed = parca({ name: 'seed-ust', category: 'Üst' })
    const cleanItems = [seed, sneaker]
    const havuz = new Map([['Ayakkabı', [sneaker]]])

    const sonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
      moodContext: sporContext,
    })
    check(
      '"Spor" durumunda sneaker GERİ İTİLMİYOR (resmi kural yalnızca formal occasion\'larda)',
      sonuc.items.some((item) => item.name === 'New balance 530'),
    )
  }

  console.log('\n   c2) preferFormalShoes/preferFormalStyle — SİMETRİK yön (2026-09-01, "deniz kenarı" vakası)')
  console.log('       Resmi durumda günlük ayakkabıdan kaçınma kuralının TERSİ: günlük/plaj')
  console.log('       bağlamında resmi ayakkabıdan kaçınma. Öncesinde bu yön HİÇ yoktu.')
  {
    const gunlukContext = createMoodContext({
      occasion: 'Diğer', // "deniz kenarı" gibi 6 standart occasion'a uymayan istekler
      stil_tercihi: 'Rahat ve Yazlık',
      kacinilmasi_gerekenler: [],
    })

    const seed = parca({ name: 'seed-ust', category: 'Üst' })
    const cleanItems = [seed, terlik, sneaker, stiletto, babet]
    const havuz = new Map([['Ayakkabı', [babet, terlik, sneaker, stiletto]]]) // babet/terlik'e YAKIN, gerçek vakadaki sıra

    const sonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
      moodContext: gunlukContext,
    })
    const secilenAyakkabi = sonuc.items.find((item) => item.category === 'Ayakkabı')?.name
    check(
      'KRİTİK — "Rahat ve Yazlık" + occasion "Diğer" iken stiletto SEÇİLMİYOR',
      secilenAyakkabi !== 'stradivarius bordo stiletto',
      secilenAyakkabi,
    )
    check(
      'Bunun yerine GÜNLÜK etiketli bir ayakkabı (terlik/sneaker) seçildi',
      secilenAyakkabi === 'parmak arası terlik' || secilenAyakkabi === 'New balance 530',
      secilenAyakkabi,
    )

    // occasion'DAN BAĞIMSIZ çalıştığını doğrula: "Akşam yemeğine gidiyorum ama
    // rahat olsun" — occasion formal olsa bile stilTercihi günlük sinyali
    // veriyorsa yön YİNE günlüğe döner (preferFormalShoes'un ANA dalıyla
    // ÇAKIŞMADIĞINI kanıtlar — ikisi karşılıklı dışlayıcı olmalı).
    const rahatAmaAksamContext = createMoodContext({
      occasion: 'Akşam Yemeği',
      stil_tercihi: 'Rahat',
      kacinilmasi_gerekenler: [],
    })
    const sonuc2 = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
      moodContext: rahatAmaAksamContext,
    })
    const secilen2 = sonuc2.items.find((item) => item.category === 'Ayakkabı')?.name
    check(
      'occasion "Akşam Yemeği" OLSA BİLE stilTercihi "Rahat" iken stiletto seçilmiyor',
      secilen2 !== 'stradivarius bordo stiletto',
      secilen2,
    )

    // Genel giyim (Üst/Alt/Elbise/Çanta) için de AYNI simetrik yön çalışmalı.
    const klasikCanta = parca({
      name: 'klasik deri çanta',
      category: 'Çanta',
      aiAnalysis: { veri: { stil: 'Klasik', canta_turu: 'El Çantası' } },
    })
    const plajCantasi = parca({
      name: 'hasır plaj çantası',
      category: 'Çanta',
      aiAnalysis: { veri: { stil: 'Günlük', canta_turu: 'Hasır Çanta' } },
    })
    const cantaHavuzu = new Map([['Çanta', [klasikCanta, plajCantasi]]])
    const cantaCleanItems = [seed, klasikCanta, plajCantasi]
    const cantaSonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: cantaHavuzu,
      cleanItems: cantaCleanItems,
      seasons: null,
      moodContext: gunlukContext,
    })
    const secilenCanta = cantaSonuc.items.find((item) => item.category === 'Çanta')?.name
    check(
      'preferFormalStyle SİMETRİK yön — günlük bağlamda klasik deri çanta geri itiliyor',
      secilenCanta === 'hasır plaj çantası',
      secilenCanta,
    )

    // Regresyon: moodContext YOKKEN yeni dal hiç tetiklenmiyor.
    const sonucMoodsuz = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
    })
    check(
      'moodContext YOKKEN simetrik yön devreye girmiyor (en yakın aday — babet — aynen seçiliyor)',
      sonucMoodsuz.items.find((item) => item.category === 'Ayakkabı')?.name === 'stradivarius babet',
      sonucMoodsuz.items.find((item) => item.category === 'Ayakkabı')?.name,
    )
  }

  console.log('\n   c3) preferSportyStyle — GERÇEK VAKA: "spor" yazınca eşofman DEĞİL etek seçiliyordu')
  console.log('       (deneme@gmail.com, 2026-09-01: "zara esofman" [Spor] yerine "zara sort etek"')
  console.log('       [Günlük] çıktı — ikisi de preferFormalStyle\'a göre "resmi değil", aralarında')
  console.log('       ayrım yapan bir katman yoktu.)')
  {
    const esofman = parca({
      name: 'zara esofman',
      category: 'Alt',
      aiAnalysis: { veri: { stil: 'Spor', genel_aciklama: 'Bağcıklı bol paça eşofman altı, spor bir görünüm.' } },
    })
    const sortEtek = parca({
      name: 'zara sort etek',
      category: 'Alt',
      aiAnalysis: { veri: { stil: 'Günlük', genel_aciklama: 'Gri yıkamalı mini kot etek, günlük stiller için.' } },
    })
    const sporContext = createMoodContext({
      occasion: 'Spor',
      stil_tercihi: 'Spor',
      kacinilmasi_gerekenler: [],
    })

    const seed = parca({ name: 'seed-ust', category: 'Üst' })
    // Gerçek vakadaki sıra: vektör benzerliği etek'i eşofmandan ÖNde getiriyordu.
    const havuz = new Map([['Alt', [sortEtek, esofman]]])
    const cleanItems = [seed, sortEtek, esofman]

    const sonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
      moodContext: sporContext,
    })
    const secilenAlt = sonuc.items.find((item) => item.category === 'Alt')?.name
    check(
      'KRİTİK — "Spor" stilTercihiyle GERÇEKTEN spor etiketli eşofman seçiliyor (etek DEĞİL)',
      secilenAlt === 'zara esofman',
      secilenAlt,
    )

    // Regresyon — yalnızca "Rahat" (spor-spesifik olmayan) stilTercihiyle bu
    // dar katman DEVREYE GİRMEMELİ; preferFormalStyle'ın kendi kararına
    // (ikisi de günlük, vektör sırası korunur) karışılmamalı.
    const rahatContext = createMoodContext({
      occasion: 'Buluşma',
      stil_tercihi: 'Rahat',
      kacinilmasi_gerekenler: [],
    })
    const sonuc2 = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
      moodContext: rahatContext,
    })
    const secilenAlt2 = sonuc2.items.find((item) => item.category === 'Alt')?.name
    check(
      'Yalnızca "Rahat" (spor-spesifik DEĞİL) iken dar katman devreye girmiyor — vektör sırası korunuyor',
      secilenAlt2 === 'zara sort etek',
      secilenAlt2,
    )

    // Regresyon: moodContext yokken hiç etkilenmiyor.
    const sonuc3 = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
    })
    check(
      'moodContext YOKKEN preferSportyStyle devreye girmiyor — vektör sırası (etek) korunuyor',
      sonuc3.items.find((item) => item.category === 'Alt')?.name === 'zara sort etek',
    )
  }

  console.log('\n   d) preferAvoidingKeywords — ÖNCELİKLENDİRİR, ELEMEZ')
  {
    const seed = parca({ name: 'seed-ust', category: 'Üst' })
    // Ayakkabı kategorisinde TEK seçenek terlik: eleme OLSAYDI kombin
    // kurulamazdı; öncelik düşürme davranışında yine de seçilmeli.
    const cleanItems = [seed, terlik]
    const havuz = new Map([['Ayakkabı', [terlik]]])

    const sonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: havuz,
      cleanItems,
      seasons: null,
      moodContext: context,
    })
    check(
      'Tek seçenek terlik olsa BİLE kombin kuruluyor (tamamen ELENMİYOR)',
      sonuc.items.some((item) => item.name === 'parmak arası terlik'),
    )
  }

  console.log('\n   e) pickSeedItem — textRanking ile en yakın parça seed olarak seçiliyor')
  {
    const uzakUst = parca({ name: 'uzak-ust', category: 'Üst', aiAnalysis: { veri: {} } })
    const yakinUst = parca({ name: 'yakin-ust', category: 'Üst', aiAnalysis: { veri: {} } })
    const indekssizAlt = parca({ name: 'indekssiz-alt', category: 'Alt' }) // aiAnalysis yok

    const textRanking = new Map([
      [uzakUst.id, 0.65],
      [yakinUst.id, 0.91],
    ])

    const secilen = pickSeedItem([uzakUst, yakinUst, indekssizAlt], null, { textRanking })
    check(
      'textRanking varken EN YÜKSEK benzerlikli parça deterministik seçiliyor',
      secilen?.name === 'yakin-ust',
      secilen?.name,
    )

    // textRanking BOŞSA (Chroma erişilemedi) sessizce rastgele davranışa düşülür.
    const bosRanking = new Map()
    const rastgeleSecimler = Array.from({ length: 30 }, () =>
      pickSeedItem([uzakUst, yakinUst], null, { textRanking: bosRanking }),
    )
    check(
      'Boş textRanking → sessizce rastgele seçime düşülüyor (hata yok)',
      rastgeleSecimler.every((s) => s?.name === 'uzak-ust' || s?.name === 'yakin-ust'),
    )
    check(
      'Boş textRanking gerçekten RASTGELE (tek bir isim değil)',
      new Set(rastgeleSecimler.map((s) => s.name)).size === 2,
    )

    // textRanking'te olmayan bir parça havuzda TEK başınaysa yine seçilebilir
    // (elenmiyor, yalnızca ranking'te öncelikli değil).
    const sadeceIndekssiz = pickSeedItem([indekssizAlt], null, { textRanking })
    check(
      'Ranking\'te olmayan tek parça ELENMİYOR, yine seçiliyor',
      sadeceIndekssiz?.name === 'indekssiz-alt',
    )
  }

  console.log('\n   f) buildRandomOutfit — moodContext rastgele geri düşüşte de ÇALIŞIYOR')
  {
    // Chroma tamamen erişilemez olsa bile (candidatesByCategory hiç yok),
    // kaçınılan kelimeler ai_analysis'ten okunduğu için hâlâ uygulanabilir.
    const cleanItems = [terlik, stiletto]
    const kombinler = Array.from({ length: 30 }, () =>
      buildRandomOutfit(cleanItems, null, context),
    )
    check(
      'Rastgele geri düşüşte BİLE terlik yerine stiletto tercih ediliyor',
      kombinler.every((k) => k.some((item) => item.name === 'stradivarius bordo stiletto')),
    )

    // moodContext YOKSA (eski çağrı imzası) davranış deterministik değil,
    // ikisi de çıkabilir — bu REGRESYONUN kanıtı.
    const eskiDavranis = Array.from({ length: 30 }, () => buildRandomOutfit(cleanItems, null))
    check(
      'moodContext verilmezse ESKİ (tamamen rastgele) davranış korunuyor',
      new Set(eskiDavranis.map((k) => k[0]?.name)).size === 2,
    )
  }
}

// ---------------------------------------------------------------
console.log('\n13) KALİTE DÜZELTMESİ — Elbise, Üst+Alt ikilisine ALTERNATİF')
console.log('    (bkz. gerçek şikayet: "şık bir akşam yemeği" → basit tişört+pantolon çıkıyordu,')
console.log('     gardıropta elbise olmasına rağmen HİÇ önerilmiyordu)')

{
  // Karışık, gerçekçi bir gardırop: her kategoride hem "şık" hem "günlük"
  // etiketli parçalar var — testin asıl amacı DOĞRU olanın seçilmesi.
  const basicTisort = parca({ name: 'beyaz basic tişört', category: 'Üst', aiAnalysis: { veri: { stil: 'Günlük', alt_kategori: 'Tişört' } } })
  const ipekBluz = parca({ name: 'ipek şık bluz', category: 'Üst', aiAnalysis: { veri: { stil: 'Şık', alt_kategori: 'Bluz' } } })
  const kotPantolon = parca({ name: 'mavi kot pantolon', category: 'Alt', aiAnalysis: { veri: { stil: 'Günlük', alt_kategori: 'Kot Pantolon' } } })
  const kumasPantolon = parca({ name: 'siyah kumaş pantolon', category: 'Alt', aiAnalysis: { veri: { stil: 'Klasik', alt_kategori: 'Kumaş Pantolon' } } })
  const kokteylElbise = parca({ name: 'siyah kokteyl elbisesi', category: 'Elbise', aiAnalysis: { veri: { stil: 'Şık', genel_aciklama: 'Zarif bir kokteyl elbisesi' } } })
  const sneaker = parca({ name: 'beyaz sneaker', category: 'Ayakkabı', aiAnalysis: { veri: { stil: 'Spor', ayakkabi_turu: 'Sneaker' } } })
  const topuklu = parca({ name: 'siyah topuklu ayakkabı', category: 'Ayakkabı', aiAnalysis: { veri: { stil: 'Klasik', ayakkabi_turu: 'Topuklu Ayakkabı' } } })
  const gunlukCanta = parca({ name: 'kanvas günlük çanta', category: 'Çanta', aiAnalysis: { veri: { stil: 'Günlük', canta_turu: 'Tote' } } })
  const sikCanta = parca({ name: 'siyah saten clutch', category: 'Çanta', aiAnalysis: { veri: { stil: 'Şık', canta_turu: 'Clutch' } } })

  const tumParcalar = [
    basicTisort, ipekBluz, kotPantolon, kumasPantolon, kokteylElbise, sneaker, topuklu, gunlukCanta, sikCanta,
  ]

  console.log('\n   a) resolveActiveCategories — REGRESYON: moodContext yoksa HER ZAMAN Üst+Alt')
  {
    check(
      'moodContext yokken elbise olsa BİLE her zaman OUTFIT_CATEGORIES (referans eşit)',
      resolveActiveCategories(tumParcalar, null) === OUTFIT_CATEGORIES,
    )
    const sikContext = createMoodContext({ occasion: 'Akşam Yemeği', stil_tercihi: 'Şık', kacinilmasi_gerekenler: [] })
    const textRankingSik = new Map([[kokteylElbise.id, 0.99], [basicTisort.id, 0.1], [kotPantolon.id, 0.1]])
    check(
      'moodContext VE textRanking elbiseyi güçlü işaret etse bile moodContext null ise yine Üst+Alt',
      JSON.stringify(resolveActiveCategories(tumParcalar, null, textRankingSik)) === JSON.stringify(OUTFIT_CATEGORIES),
    )
    check(
      'Gardıropta HİÇ temiz Elbise yoksa (moodContext VE textRanking olsa bile) Üst+Alt kalır',
      JSON.stringify(
        resolveActiveCategories(tumParcalar.filter((i) => i.category !== 'Elbise'), sikContext, textRankingSik),
      ) === JSON.stringify(OUTFIT_CATEGORIES),
    )
  }

  console.log('\n   b) resolveActiveCategories — textRanking VARKEN: elbise skoru üst+alt ORTALAMASINA karşı')
  {
    const sikContext = createMoodContext({ occasion: 'Akşam Yemeği', stil_tercihi: 'Şık', kacinilmasi_gerekenler: [] })
    // Elbise (0.93) > (Üst en iyi 0.82 + Alt en iyi 0.80) / 2 = 0.81 → Elbise kazanır.
    const textRankingSik = new Map([
      [basicTisort.id, 0.55], [ipekBluz.id, 0.82], [kotPantolon.id, 0.50], [kumasPantolon.id, 0.80],
      [kokteylElbise.id, 0.93], [sneaker.id, 0.45], [topuklu.id, 0.85], [gunlukCanta.id, 0.48], [sikCanta.id, 0.88],
    ])
    check(
      'KRİTİK — "şık" isteğinde textRanking Elbise rotasını GERÇEKTEN seçtiriyor',
      JSON.stringify(resolveActiveCategories(tumParcalar, sikContext, textRankingSik)) ===
        JSON.stringify(['Elbise', 'Ayakkabı', 'Çanta']),
    )

    // Aynı gardırop, TERS istek: "rahat bir gün" — elbise skoru düşük, dress
    // route KAZANMAMALI (dress'in "varsayılan olarak resmi" sayılmadığının kanıtı).
    const rahatContext = createMoodContext({ occasion: 'Buluşma', stil_tercihi: 'Rahat', kacinilmasi_gerekenler: [] })
    const textRankingRahat = new Map([
      [basicTisort.id, 0.88], [ipekBluz.id, 0.40], [kotPantolon.id, 0.85], [kumasPantolon.id, 0.35],
      [kokteylElbise.id, 0.30], [sneaker.id, 0.90], [topuklu.id, 0.20], [gunlukCanta.id, 0.82], [sikCanta.id, 0.25],
    ])
    check(
      'KRİTİK — "rahat bir gün" isteğinde Elbise TERCİH EDİLMİYOR, Üst+Alt kalıyor',
      JSON.stringify(resolveActiveCategories(tumParcalar, rahatContext, textRankingRahat)) ===
        JSON.stringify(OUTFIT_CATEGORIES),
    )
  }

  console.log('\n   c) resolveActiveCategories — textRanking YOKKEN (Chroma erişilemedi): formallik sinyaline düşülür')
  {
    const sikContext = createMoodContext({ occasion: 'Akşam Yemeği', stil_tercihi: 'Şık', kacinilmasi_gerekenler: [] })

    // Yalnızca Elbise'de resmi bir seçenek var (kumasPantolon 'Klasik' ama
    // ipekBluz 'Şık' — Üst+Alt'ta İKİSİ BİRDEN resmi olmalı, o yüzden bu
    // senaryoda Üst tarafı için resmi olmayan bir gardırop kuruluyor).
    const sadeceUstGunluk = [basicTisort, kumasPantolon, kokteylElbise, topuklu, sikCanta]
    check(
      'Üst+Alt tarafında resmi seçenek YOKKEN (yalnızca Üst günlük) Elbise tercih ediliyor',
      JSON.stringify(resolveActiveCategories(sadeceUstGunluk, sikContext)) ===
        JSON.stringify(['Elbise', 'Ayakkabı', 'Çanta']),
    )

    // Üst+Alt'ta DA resmi bir seçenek varsa (ipekBluz + kumasPantolon)
    // BELİRSİZLİKTE MEVCUT DAVRANIŞ (Üst+Alt) korunur.
    check(
      'Üst+Alt tarafında DA resmi seçenek varsa belirsizlikte Üst+Alt KORUNUYOR',
      JSON.stringify(resolveActiveCategories(tumParcalar, sikContext)) === JSON.stringify(OUTFIT_CATEGORIES),
    )

    // Elbise hiç resmi değilse (yalnızca günlük elbise olsaydı) Üst+Alt kalır.
    const gunlukElbise = parca({ name: 'gündelik keten elbise', category: 'Elbise', aiAnalysis: { veri: { stil: 'Günlük' } } })
    check(
      'Elbise GÜNLÜK etiketliyse (resmi değilse) tercih edilmiyor',
      JSON.stringify(resolveActiveCategories([basicTisort, kumasPantolon, gunlukElbise, topuklu], sikContext)) ===
        JSON.stringify(OUTFIT_CATEGORIES),
    )
  }

  console.log('\n   d) pickSeedItem + buildOutfitFromCandidates — UÇTAN UCA "şık bir akşam yemeği"')
  {
    const sikContext = createMoodContext({ occasion: 'Akşam Yemeği', stil_tercihi: 'Şık', kacinilmasi_gerekenler: [] })
    const textRankingSik = new Map([
      [basicTisort.id, 0.55], [ipekBluz.id, 0.82], [kotPantolon.id, 0.50], [kumasPantolon.id, 0.80],
      [kokteylElbise.id, 0.93], [sneaker.id, 0.45], [topuklu.id, 0.85], [gunlukCanta.id, 0.48], [sikCanta.id, 0.88],
    ])

    const seed = pickSeedItem(tumParcalar, null, { textRanking: textRankingSik, moodContext: sikContext })
    check('Seed olarak GERÇEKTEN elbise seçildi (en yüksek "şık" skoru)', seed?.name === 'siyah kokteyl elbisesi', seed?.name)

    // Vektör-yakınlık adayları BİLEREK "yanıltıcı" kuruldu: her kategoride
    // GÜNLÜK parça vektör olarak DAHA YAKIN (listede ÖNCE) ama stil filtresi
    // yine de resmi olanı öne çıkarmalı.
    const candidatesByCategory = new Map([
      ['Ayakkabı', [sneaker, topuklu]],
      ['Çanta', [gunlukCanta, sikCanta]],
    ])

    const sonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory,
      cleanItems: tumParcalar,
      seasons: null,
      moodContext: sikContext,
      textRanking: textRankingSik,
    })

    check('KRİTİK — kombin TAM 3 PARÇA (Elbise+Ayakkabı+Çanta), Üst/Alt YOK', sonuc.items.length === 3, adlar(sonuc.items).join(', '))
    check('Elbise kombinde', adlar(sonuc.items).includes('siyah kokteyl elbisesi'))
    check('Üst hiç kombine girmiyor', !kategoriler(sonuc.items).includes('Üst'))
    check('Alt hiç kombine girmiyor', !kategoriler(sonuc.items).includes('Alt'))
    check(
      'KRİTİK — vektörce daha yakın sneaker DEĞİL, RESMİ topuklu seçildi',
      adlar(sonuc.items).includes('siyah topuklu ayakkabı') && !adlar(sonuc.items).includes('beyaz sneaker'),
      adlar(sonuc.items).join(', '),
    )
    check(
      'KRİTİK — vektörce daha yakın günlük çanta DEĞİL, RESMİ clutch seçildi',
      adlar(sonuc.items).includes('siyah saten clutch') && !adlar(sonuc.items).includes('kanvas günlük çanta'),
      adlar(sonuc.items).join(', '),
    )
  }

  console.log('\n   e) UÇTAN UCA — TERS vaka: "rahat bir gün" günlük parçalar seçiyor, Elbise YOK')
  {
    const rahatContext = createMoodContext({ occasion: 'Buluşma', stil_tercihi: 'Rahat', kacinilmasi_gerekenler: [] })
    const kombinler = Array.from({ length: 30 }, () => buildRandomOutfit(tumParcalar, null, rahatContext))
    check(
      'Elbise 30 denemenin HİÇBİRİNDE seçilmiyor (occasion resmi değil, dress route hiç devreye girmiyor)',
      kombinler.every((k) => !k.some((item) => item.category === 'Elbise')),
    )
    check(
      'Kombin her zaman 4 parça (Üst+Alt+Ayakkabı+Çanta)',
      kombinler.every((k) => k.length === 4),
    )
  }

  console.log('\n   f) preferFormalStyle — GENELLEŞTİRİLMİŞ kural artık Üst/Alt/Çanta\'ya da uygulanıyor')
  {
    const sikContext = createMoodContext({ occasion: 'Akşam Yemeği', stil_tercihi: 'Şık', kacinilmasi_gerekenler: [] })
    // BİLEREK Ayakkabı kategorisinden bir seed: hem Üst hem Çanta slotunun
    // candidatesByCategory'DEN bağımsız çözülmesi gerekiyor (seed'in KENDİ
    // kategorisi olsaydı o slot doğrudan seed'e eşitlenir, candidates hiç
    // devreye girmezdi). cleanItems'ta hiç Elbise YOK — bu test yalnızca
    // Üst/Çanta'daki genel stil filtresini izole etmek istiyor, dress route
    // kararına (bkz. bölüm b/c) hiç girmemeli.
    const seed = parca({ name: 'seed-ayakkabi', category: 'Ayakkabı' })

    // ÖNCEDEN (bu düzeltmeden önce) preferAvoidingKeywords tek başına bu
    // durumu YAKALAYAMAZDI: Gemini "kaçınılması gerekenler" listesine
    // "günlük"/"basic" kelimelerini KOYMADIĞI sürece basicTisort hiç geri
    // plana atılmazdı. Artık genelFormallik/preferFormalStyle BAĞIMSIZ
    // olarak bu ayrımı yapıyor.
    const sonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: new Map([
        ['Üst', [basicTisort, ipekBluz]],
        ['Çanta', [gunlukCanta, sikCanta]],
      ]),
      cleanItems: [seed, basicTisort, ipekBluz, gunlukCanta, sikCanta],
      seasons: null,
      moodContext: sikContext,
    })
    check(
      'KRİTİK — GÜNLÜK tişört DEĞİL, ŞIK bluz seçildi (Üst kategorisi artık stil-farkında)',
      adlar(sonuc.items).includes('ipek şık bluz') && !adlar(sonuc.items).includes('beyaz basic tişört'),
      adlar(sonuc.items).join(', '),
    )
    check(
      'Çanta kategorisinde de aynı kural: GÜNLÜK çanta DEĞİL, ŞIK clutch seçildi',
      adlar(sonuc.items).includes('siyah saten clutch') && !adlar(sonuc.items).includes('kanvas günlük çanta'),
    )
  }

  console.log('\n   g) YENİ BULUNAN HATA DÜZELTMESİ — stilTercihi İÇERİĞİ artık gerçekten okunuyor')
  {
    // "Akşam yemeğine gidiyorum ama RAHAT giyinmek istiyorum": occasion RESMİ
    // (Akşam Yemeği) ama stilTercihi AÇIKÇA "Rahat" — ÖNCEDEN kod yalnızca
    // "stilTercihi dolu mu" diye bakıyordu ve occasion resmi olduğu için
    // YANLIŞLIKLA resmi ayakkabı/kıyafet önceliklendiriyordu. Artık
    // stilTercihiResmiMi içeriği okuyor ve bu durumda HİÇBİR ŞEY yapmıyor.
    const rahatAmaResmiMekan = createMoodContext({
      occasion: 'Akşam Yemeği',
      stil_tercihi: 'Rahat',
      kacinilmasi_gerekenler: [],
    })
    const seed = parca({ name: 'seed-ust', category: 'Üst' })

    const ayakkabiSonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: new Map([['Ayakkabı', [sneaker, topuklu]]]),
      cleanItems: [seed, sneaker, topuklu],
      seasons: null,
      moodContext: rahatAmaResmiMekan,
    })
    check(
      'KRİTİK REGRESYON — occasion resmi ama stilTercihi "Rahat" iken sneaker GERİ İTİLMİYOR',
      adlar(ayakkabiSonuc.items).includes('beyaz sneaker'),
      adlar(ayakkabiSonuc.items).join(', '),
    )

    const cantaSonuc = buildOutfitFromCandidates({
      seedItem: seed,
      candidatesByCategory: new Map([['Çanta', [gunlukCanta, sikCanta]]]),
      cleanItems: [seed, gunlukCanta, sikCanta],
      seasons: null,
      moodContext: rahatAmaResmiMekan,
    })
    check(
      'Aynı senaryoda günlük çanta da GERİ İTİLMİYOR (preferFormalStyle de aynı düzeltmeyi kullanıyor)',
      adlar(cantaSonuc.items).includes('kanvas günlük çanta'),
      adlar(cantaSonuc.items).join(', '),
    )

    // Dress route kararı da (formallik-fallback dalı) aynı düzeltmeyi kullanmalı.
    check(
      '"Rahat" stilTercihiyle Elbise route\'a HİÇ girilmiyor (textRanking yokken formallik-fallback)',
      JSON.stringify(resolveActiveCategories([seed, kokteylElbise], rahatAmaResmiMekan)) ===
        JSON.stringify(OUTFIT_CATEGORIES),
    )
  }

  console.log('\n   h) variantDepth — dress route AKTİFKEN doğru kategori kümesiyle çağrılabiliyor')
  {
    const dressCandidates = new Map([
      [DRESS_CATEGORY, [kokteylElbise]],
      ['Ayakkabı', [topuklu, sneaker]],
      ['Çanta', [sikCanta]],
      // Kullanılmayan Üst/Alt havuzları BİLEREK BÜYÜK — eski (hatalı)
      // davranışta bunlar derinliği yanlış şişirirdi.
      ['Üst', [basicTisort, ipekBluz, kumasPantolon, kotPantolon, kokteylElbise]],
    ])
    check(
      'KRİTİK — dress route kategorileriyle çağrılınca derinlik GERÇEK (kullanılan) havuzlara göre',
      variantDepth(dressCandidates, [DRESS_CATEGORY, 'Ayakkabı', 'Çanta']) === 2,
      `${variantDepth(dressCandidates, [DRESS_CATEGORY, 'Ayakkabı', 'Çanta'])}`,
    )
    check(
      'Varsayılan (OUTFIT_CATEGORIES) çağrı REGRESYONSUZ — eski imza hâlâ çalışıyor',
      variantDepth(dressCandidates) === 5,
    )
  }
}

// ---------------------------------------------------------------
console.log('\n11) isSameOutfit')

{
  const a = parca()
  const b = parca()
  check('Aynı sıradaki aynı parçalar eşit', isSameOutfit([a, b], [a, b]))
  check('Farklı sıra eşit değil', !isSameOutfit([a, b], [b, a]))
  check('Farklı uzunluk eşit değil', !isSameOutfit([a], [a, b]))
}

// ---------------------------------------------------------------
console.log('\n12) matchesSkinTone — ten tonu işareti (yalnızca bilgilendirici)')

{
  const parcaTon = (tonlar) => ({ aiAnalysis: { veri: { uyumluluk: { ten_tonu: tonlar } } } })

  check('Kullanıcı tonu parçanınkiyle eşleşiyor', matchesSkinTone(parcaTon(['Sıcak ten']), 'Sıcak'))
  check('Eşleşmeyen ton işaret almıyor', !matchesSkinTone(parcaTon(['Sıcak ten']), 'Soğuk'))
  check(
    '"Tüm Ten Tonları" HER tona uyuyor',
    matchesSkinTone(parcaTon(['Tüm Ten Tonları']), 'Soğuk') &&
      matchesSkinTone(parcaTon(['Tüm Ten Tonları']), 'Sıcak'),
  )
  check(
    'Türkçe büyük harf doğru küçültülüyor (SICAK -> sıcak)',
    matchesSkinTone(parcaTon(['SICAK TEN']), 'Sıcak'),
  )
  check('Listedeki herhangi bir eşleşme yeterli', matchesSkinTone(parcaTon(['Buğday', 'Nötr ten']), 'Nötr'))
  check('Analizi olmayan parça işaret almıyor', !matchesSkinTone(parca(), 'Sıcak'))
  check('Boş uyumluluk listesi işaret almıyor', !matchesSkinTone(parcaTon([]), 'Sıcak'))
  check(
    'Kullanıcının ten tonu yoksa HİÇBİR parça işaret almıyor',
    !matchesSkinTone(parcaTon(['Tüm Ten Tonları']), null) &&
      !matchesSkinTone(parcaTon(['Sıcak ten']), ''),
  )
  check('Alakasız değerler eşleşmiyor', !matchesSkinTone(parcaTon(['Açık Ten', 'Buğday']), 'Soğuk'))

  // KOMBİN MANTIĞINA KARIŞMADIĞININ kanıtı: işaret hesabı kombini değiştirmiyor.
  const seed = parca({ name: 'seed', category: 'Üst' })
  const alt = parca({ name: 'alt', category: 'Alt' })
  const oncesi = buildOutfitFromCandidates({
    seedItem: seed,
    candidatesByCategory: new Map([['Alt', [alt]]]),
    cleanItems: [seed, alt],
    seasons: null,
  })
  check(
    'Ten tonu bilgisi kombin kurulumunu ETKİLEMİYOR (saf gösterim katmanı)',
    oncesi.items.length === 2 && oncesi.vectorCount === 1,
  )
}

console.log(`\n${'='.repeat(46)}`)
console.log(`SONUÇ: ${passed} başarılı, ${failed} başarısız`)
console.log('='.repeat(46))
process.exit(failed > 0 ? 1 : 0)
