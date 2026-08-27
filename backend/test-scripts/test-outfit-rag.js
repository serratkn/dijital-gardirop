// Gemini entegrasyonu — AŞAMA 4: RAG ile Kombin Öner testleri.
// ChromaDB'den pgvector'a geçiş sonrası güncellendi (bkz. CLAUDE.md §9,
// 2026-08-27 kaydı).
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-outfit-rag.js
//   node test-scripts/test-outfit-rag.js --birim      (yalnızca birim; DB/anahtar GEREKMEZ)
//   node test-scripts/test-outfit-rag.js --cleanup    (test verisini sonda siler)
//
// BÖLÜM 1 (birim) ÇALIŞAN VERİTABANI VE GEÇERLİ ANAHTAR GEREKTİRMEZ.
// BÖLÜM 2 çalışan Postgres (migration 011 uygulanmış) + geçerli GEMINI_API_KEY ister.
// BÖLÜM 3 kritik olan: vektör deposu DEVRE DIŞI BIRAKILMIŞ İKİNCİ BİR SUNUCU
// açar ve Kombin Öner'i besleyen akışın kırılmadığını kanıtlar (bkz.
// test-vector.js'teki aynı isimli değişikliğin gerekçesi: pgvector artık aynı
// Postgres'i paylaştığı için "Postgres ayakta, yalnızca vektör deposu
// erişilemez" senaryosu fiilen imkânsız — devre dışı bırakma AYNI kod
// yolunu egzersiz eder).
//
// Bölüm 2 ai_analysis'i ELLE yazar (sentetik) — test-vector.js ile aynı gerekçe:
// günlük generateContent kotasına bağlı kalmamak ve "siyah tişörte siyah
// pantolon daha yakın çıkmalı" iddiasını DETERMİNİSTİK sınamak. Embedding
// çağrıları gerçektir.
//
// NOT: Kombin kurma mantığının (temiz/kirli + hava durumu filtreleri, varyant
// ilerletme, geri düşüş) kendisi İSTEMCİDEDİR ve ayrı bir dosyada test edilir:
//   frontend/test-scripts/test-outfit-builder.mjs

const path = require('node:path')
const { spawn } = require('node:child_process')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`
const SERVER_FILE = path.join(__dirname, '..', 'server.js')

// Vektör deposu devre dışı bırakılmış ikinci sunucunun portu (test-vector.js'ten
// FARKLI olmalı: ikisi aynı anda çalıştırılabilsin).
const BROKEN_PORT = 3197

const CLEANUP = process.argv.includes('--cleanup')
const ONLY_UNIT = process.argv.includes('--birim')

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

async function call(method, endpoint, { body, token, baseUrl = BASE_URL } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(baseUrl + endpoint, {
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0

// ============================================================
// BÖLÜM 1 — birim testleri (veritabanı ve anahtar GEREKTİRMEZ)
// ============================================================

const SEED_ID = 'aaaaaaaa-0000-0000-0000-000000000001'

function sahteKayit(extra = {}) {
  return {
    id: SEED_ID,
    user_id: 'user-1',
    category_id: 1,
    name: 'Siyah tişört',
    color: 'Siyah',
    season: 'Yaz',
    is_clean: true,
    is_deleted: false,
    image_url: '/uploads/a.png',
    ai_analysis: { sema: 'giyim', veri: { alt_kategori: 'Tişört' } },
    ...extra,
  }
}

// Kayıtları id ile veren sahte repository. findByIds gerçek repository ile
// aynı sözleşmeyi taşır: silinmiş kayıtlar HİÇ dönmez.
function sahteItemRepo(kayitlar) {
  const map = new Map(kayitlar.map((row) => [row.id, row]))
  return {
    async findById(id) {
      return map.get(id) ?? null
    },
    async findByIds(ids) {
      return ids.map((id) => map.get(id)).filter(Boolean)
    },
  }
}

function sahteVectorRepo({ embedding = [0.1, 0.2, 0.3], sonuclar = {}, hata = null, aski = false } = {}) {
  return {
    sorgular: [],
    async getEmbedding() {
      if (hata === 'getEmbedding') throw new Error('ECONNREFUSED 127.0.0.1:9')
      return embedding
    },
    async query(args) {
      this.sorgular.push(args)
      if (hata === 'query') throw new Error('Veritabanı yanıt vermedi')
      // Askıda kalma senaryosu: hiç çözülmeyen bir söz.
      if (aski) return new Promise(() => {})
      return sonuclar[args.categoryId] ?? []
    },
  }
}

function komsu(id, distance) {
  return { id, distance, document: `ozet-${id}`, metadata: {} }
}

async function birimTestleri() {
  const VectorService = require('../src/services/VectorService')
  const { COMPANION_MAX_LIMIT, COMPANION_TIMEOUT_MS } = VectorService
  const { NotFoundError, ServiceUnavailableError, ValidationError } = require('../src/utils/errors')

  console.log('1) findCompanions — yetkilendirme ve girdi doğrulama')

  {
    const service = new VectorService(sahteVectorRepo(), sahteItemRepo([sahteKayit()]), {})

    let hata = null
    try {
      // BİÇİMİ GEÇERLİ ama var olmayan id: 404 beklenir.
      await service.findCompanions('aaaaaaaa-0000-0000-0000-00000000dead', 'user-1', {
        categoryIds: '2',
      })
    } catch (error) {
      hata = error
    }
    check('Olmayan parça için NotFoundError', hata instanceof NotFoundError)

    hata = null
    try {
      // BİÇİMİ BOZUK id: Postgres'e hiç gitmemeli (22P02 -> 500 tuzağı).
      await service.findCompanions('yok-boyle-bir-id', 'user-1', { categoryIds: '2' })
    } catch (error) {
      hata = error
    }
    check(
      'Bozuk biçimli id 400 (Postgres 22P02 yüzünden 500 DEĞİL)',
      hata instanceof ValidationError && hata.statusCode === 400,
    )

    hata = null
    try {
      await service.findCompanions(SEED_ID, 'BASKA-KULLANICI', { categoryIds: '2' })
    } catch (error) {
      hata = error
    }
    check(
      'Başkasının parçası için 404 (403 DEĞİL — kaydın varlığı sızmasın)',
      hata instanceof NotFoundError && hata.statusCode === 404,
    )

    hata = null
    try {
      await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '' })
    } catch (error) {
      hata = error
    }
    check('categoryIds boşsa 400', hata instanceof ValidationError && hata.statusCode === 400)

    hata = null
    try {
      await service.findCompanions(SEED_ID, 'user-1', { categoryIds: 'abc,,-1' })
    } catch (error) {
      hata = error
    }
    check('Geçersiz categoryIds değerleri eleniyor ve 400 dönüyor', hata instanceof ValidationError)

    // Başlangıç parçasının KENDİ kategorisi hedeflerden düşer: kombin slotu
    // başka bir kategoriye ait.
    hata = null
    try {
      await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '1' })
    } catch (error) {
      hata = error
    }
    check(
      'Yalnızca başlangıç parçasının kendi kategorisi istenirse 400',
      hata instanceof ValidationError,
    )
  }

  console.log('\n2) findCompanions — sorgu kurulumu ve veri izolasyonu')

  {
    const repo = sahteVectorRepo({
      sonuclar: {
        2: [komsu('alt-1', 0.09), komsu('alt-2', 0.15)],
        4: [komsu('ayk-1', 0.2)],
      },
    })
    const service = new VectorService(
      repo,
      sahteItemRepo([
        sahteKayit(),
        sahteKayit({ id: 'alt-1', category_id: 2, name: 'Siyah pantolon', season: 'Tüm Sezon' }),
        sahteKayit({ id: 'alt-2', category_id: 2, name: 'Beyaz şort', is_clean: false }),
        sahteKayit({ id: 'ayk-1', category_id: 4, name: 'Sneaker' }),
      ]),
      {},
    )

    const sonuc = await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '1,2,4', limit: 5 })

    check('indekslendi = true', sonuc.indekslendi === true)
    check('Başlangıç parçasının kategorisi (1) sorgulanmadı', !(1 in sonuc.adaylar))
    check('İstenen her kategori yanıtta', 2 in sonuc.adaylar && 4 in sonuc.adaylar)

    check(
      'HER SORGUDA kullanıcı filtresi var (başkasının gardırobu sızmasın)',
      repo.sorgular.length === 2 && repo.sorgular.every((s) => s.userId === 'user-1'),
    )
    check(
      'HER SORGUDA kategori filtresi var',
      repo.sorgular.every((s) => Number.isInteger(s.categoryId)),
    )
    check(
      'Kategori başına AYRI sorgu atılıyor (az parçalı kategori kaybolmasın)',
      repo.sorgular.map((s) => s.categoryId).sort().join(',') === '2,4',
    )
    check(
      'Başlangıç parçasının vektörü yeniden ÜRETİLMİYOR (veritabanından okunuyor)',
      repo.sorgular.every((s) => Array.isArray(s.embedding)),
    )

    const alt = sonuc.adaylar[2]
    check('Adaylar benzerlik sırasında', alt[0].id === 'alt-1' && alt[1].id === 'alt-2')
    check('Postgres\'ten zenginleştirildi (ad, renk, fotoğraf)', alt[0].name === 'Siyah pantolon')
    check(
      'KİRLİ/SEZON alanları yanıtta var (filtreyi istemci uygular)',
      alt[1].is_clean === false && alt[0].season === 'Tüm Sezon',
    )
    check(
      'Değişken durum POSTGRES\'ten geliyor, embedding tablosundan değil',
      alt.every((row) => 'is_clean' in row && 'season' in row),
    )
    check(
      'mesafe ve benzerlik birlikte dönüyor',
      alt[0].mesafe === 0.09 && alt[0].benzerlik === 0.91,
      `benzerlik: ${alt[0].benzerlik}`,
    )
  }

  {
    // Embedding tablosunda kalmış bayat bir kayıt (Postgres'te silinmiş) yanıta SIZMAMALI.
    const repo = sahteVectorRepo({ sonuclar: { 2: [komsu('silinmis', 0.1), komsu('alt-1', 0.2)] } })
    const service = new VectorService(
      repo,
      sahteItemRepo([sahteKayit(), sahteKayit({ id: 'alt-1', category_id: 2 })]),
      {},
    )
    const sonuc = await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    check(
      'Embedding tablosunda kalan ÖKSÜZ vektör yanıta sızmıyor',
      sonuc.adaylar[2].length === 1 && sonuc.adaylar[2][0].id === 'alt-1',
    )
  }

  {
    // Vektör sorgusundaki kullanıcı filtresi bir şekilde delinse bile Postgres doğrulaması tutmalı.
    const repo = sahteVectorRepo({ sonuclar: { 2: [komsu('baskasinin', 0.05)] } })
    const service = new VectorService(
      repo,
      sahteItemRepo([
        sahteKayit(),
        sahteKayit({ id: 'baskasinin', category_id: 2, user_id: 'BASKA-KULLANICI' }),
      ]),
      {},
    )
    const sonuc = await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    check(
      'Başka kullanıcıya ait aday Postgres doğrulamasında eleniyor',
      sonuc.adaylar[2].length === 0,
    )
  }

  {
    // Başlangıç parçası kendi sonucunda çıkarsa elenmeli (mesafesi daima 0).
    const repo = sahteVectorRepo({ sonuclar: { 2: [komsu(SEED_ID, 0), komsu('alt-1', 0.2)] } })
    const service = new VectorService(
      repo,
      sahteItemRepo([sahteKayit(), sahteKayit({ id: 'alt-1', category_id: 2 })]),
      {},
    )
    const sonuc = await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    check(
      'Başlangıç parçasının kendisi adaylardan eleniyor',
      !sonuc.adaylar[2].some((row) => row.id === SEED_ID),
    )
  }

  console.log('\n3) findCompanions — limit')

  {
    const repo = sahteVectorRepo({
      sonuclar: { 2: Array.from({ length: 30 }, (_, i) => komsu(`alt-${i}`, i / 100)) },
    })
    const service = new VectorService(
      repo,
      sahteItemRepo([
        sahteKayit(),
        ...Array.from({ length: 30 }, (_, i) => sahteKayit({ id: `alt-${i}`, category_id: 2 })),
      ]),
      {},
    )

    const bes = await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2', limit: 5 })
    check('limit uygulanıyor', bes.adaylar[2].length === 5)

    const varsayilan = await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    check('Varsayılan limit 5', varsayilan.adaylar[2].length === 5)

    const cok = await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2', limit: 9999 })
    check(`limit en fazla ${COMPANION_MAX_LIMIT}`, cok.adaylar[2].length === COMPANION_MAX_LIMIT)

    const bozuk = await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2', limit: 'abc' })
    check('Sayı olmayan limit varsayılana düşüyor (NaN sorguya gitmiyor)', bozuk.adaylar[2].length === 5)
  }

  console.log('\n4) KRİTİK — indekslenmemiş parça ve erişilemeyen vektör deposu')

  {
    // Vektörü olmayan parça HATA DEĞİLDİR: istemci bunu görüp rastgele seçime düşer.
    const service = new VectorService(
      sahteVectorRepo({ embedding: null }),
      sahteItemRepo([sahteKayit()]),
      {},
    )
    const sonuc = await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    check('Vektörü olmayan parça HATA DEĞİL', sonuc.indekslendi === false)
    check('Sebep bildiriliyor', sonuc.sebep === 'embedding-henuz-olusturulmadi', sonuc.sebep)
    check('Aday listesi boş nesne', Object.keys(sonuc.adaylar).length === 0)

    const analizsiz = new VectorService(
      sahteVectorRepo({ embedding: null }),
      sahteItemRepo([sahteKayit({ ai_analysis: null })]),
      {},
    )
    const sonuc2 = await analizsiz.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    check('Analizi olmayan parçada sebep "analiz-yok"', sonuc2.sebep === 'analiz-yok')
  }

  {
    // OKUMA YOLU FIRLATIR: sessizce boş liste dönmek "uyumlu parçan yok" gibi
    // YANLIŞ bir cevap olurdu. Geri düşme kararı istemcinin.
    const service = new VectorService(
      sahteVectorRepo({ hata: 'getEmbedding' }),
      sahteItemRepo([sahteKayit()]),
      {},
    )
    let hata = null
    try {
      await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    } catch (error) {
      hata = error
    }
    check(
      'Vektör deposuna erişilemezken 503 FIRLATIYOR (boş liste DEĞİL)',
      hata instanceof ServiceUnavailableError && hata.statusCode === 503,
    )
    check('Hata mesajı Türkçe ve açıklayıcı', isNonEmptyString(hata?.message), hata?.message)

    const sorguHatasi = new VectorService(
      sahteVectorRepo({ hata: 'query' }),
      sahteItemRepo([sahteKayit()]),
      {},
    )
    hata = null
    try {
      await sorguHatasi.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    } catch (error) {
      hata = error
    }
    check('Sorgu aşamasındaki hata da 503', hata instanceof ServiceUnavailableError)
  }

  {
    // Vektör deposu askıda kalırsa öneri ekranı SÜRESİZ BEKLEMEMELİ.
    const service = new VectorService(
      sahteVectorRepo({ aski: true }),
      sahteItemRepo([sahteKayit()]),
      {},
    )
    const basladi = Date.now()
    let hata = null
    try {
      await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    } catch (error) {
      hata = error
    }
    const sure = Date.now() - basladi
    check('Askıda kalan vektör deposu zaman aşımına düşüyor', hata instanceof ServiceUnavailableError)
    check(
      `Zaman aşımı sınırı içinde (${COMPANION_TIMEOUT_MS} ms)`,
      sure < COMPANION_TIMEOUT_MS + 1500,
      `${sure} ms`,
    )
  }

  {
    // VECTOR_STORE_ENABLED=false kurulumunda uç açıkça 503 der.
    const onceki = process.env.VECTOR_STORE_ENABLED
    process.env.VECTOR_STORE_ENABLED = 'false'
    const service = new VectorService(sahteVectorRepo(), sahteItemRepo([sahteKayit()]), {})
    let hata = null
    try {
      await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    } catch (error) {
      hata = error
    }
    process.env.VECTOR_STORE_ENABLED = onceki
    check('VECTOR_STORE_ENABLED=false iken 503', hata instanceof ServiceUnavailableError)
  }

  {
    // Gemini HİÇ ÇAĞRILMAMALI: başlangıç parçasının vektörü zaten veritabanında.
    // Aksi hâlde her öneri gerçek para harcardı.
    let embedCagrisi = 0
    const gemini = {
      async createEmbeddings() {
        embedCagrisi += 1
        return { model: 'x', vectors: [[0.1]] }
      },
    }
    const service = new VectorService(
      sahteVectorRepo({ sonuclar: { 2: [komsu('alt-1', 0.1)] } }),
      sahteItemRepo([sahteKayit(), sahteKayit({ id: 'alt-1', category_id: 2 })]),
      gemini,
    )
    await service.findCompanions(SEED_ID, 'user-1', { categoryIds: '2' })
    check('MALİYET: öneri başına Gemini çağrısı YOK', embedCagrisi === 0)
  }
}

// ============================================================
// BÖLÜM 2 — gerçek pgvector + gerçek embedding (kontrollü veri)
// ============================================================

const giyimAnalizi = (veri) => ({
  sema: veri.sema ?? 'giyim',
  model: 'test-sentetik',
  analiz_tarihi: new Date().toISOString(),
  gardirop_kategorisi: veri.gardirop_kategorisi,
  veri: {
    alt_kategori: veri.alt_kategori,
    renk: veri.renk,
    ikincil_renkler: [],
    kumas_deseni: veri.kumas,
    stil: veri.stil,
    mevsim_uygunlugu: veri.mevsim,
    kesim_tipi: veri.kesim,
    uyumluluk: {
      vucut_tipi: ['Kum saati'],
      ten_tonu: ['Tüm ten tonları'],
      uyumlu_parca_turleri: veri.uyumlu ?? [],
      uyumsuz_kombinasyonlar: [],
    },
    genel_aciklama: veri.aciklama,
  },
})

async function gercekTest() {
  console.log('\n5) Gerçek embedding + kombin adayları (kontrollü veri)')

  const pool = require('../src/config/database')
  const ClothingItemRepository = require('../src/repositories/ClothingItemRepository')
  const VectorRepository = require('../src/repositories/VectorRepository')
  const VectorService = require('../src/services/VectorService')
  const GeminiService = require('../src/services/GeminiService')

  const email = `rag-${Date.now()}@example.com`
  const { data: auth } = await call('POST', '/auth/register', {
    body: { name: 'RAG Test', email, password: 'test1234', age: 27 },
  })
  if (!auth?.token) {
    check('Test kullanıcısı oluşturuldu', false)
    return null
  }

  const { data: categories } = await call('GET', '/categories', { token: auth.token })
  const kategoriId = new Map(categories.map((row) => [row.name, row.id]))

  // KONTROLLÜ GARDIROP. Beklenti: siyah tişörte, siyah kumaş pantolon
  // beyaz yazlık şorttan BELİRGİN biçimde daha yakın çıkmalı.
  const tanimlar = [
    {
      anahtar: 'siyah_tisort',
      name: '[test] Siyah basic tişört',
      kategori: 'Üst',
      color: 'Siyah',
      season: 'Tüm Sezon',
      analiz: giyimAnalizi({
        gardirop_kategorisi: 'Üst',
        alt_kategori: 'Tişört',
        renk: 'Siyah',
        kumas: 'Pamuklu düz',
        stil: 'Günlük',
        mevsim: 'Tüm Sezon',
        kesim: 'Standart',
        uyumlu: ['Siyah pantolon', 'Sneaker'],
        aciklama: 'Siyah, sade, her şeyle uyumlu basic tişört.',
      }),
    },
    {
      anahtar: 'siyah_pantolon',
      name: '[test] Siyah kumaş pantolon',
      kategori: 'Alt',
      color: 'Siyah',
      season: 'Tüm Sezon',
      analiz: giyimAnalizi({
        gardirop_kategorisi: 'Alt',
        alt_kategori: 'Kumaş Pantolon',
        renk: 'Siyah',
        kumas: 'Kumaş düz',
        stil: 'Günlük',
        mevsim: 'Tüm Sezon',
        kesim: 'Standart',
        uyumlu: ['Siyah tişört', 'Sneaker'],
        aciklama: 'Siyah, sade, her şeyle uyumlu kumaş pantolon.',
      }),
    },
    {
      anahtar: 'beyaz_sort',
      name: '[test] Beyaz keten şort',
      kategori: 'Alt',
      color: 'Beyaz',
      season: 'Yaz',
      analiz: giyimAnalizi({
        gardirop_kategorisi: 'Alt',
        alt_kategori: 'Keten Şort',
        renk: 'Beyaz',
        kumas: 'Keten düz',
        stil: 'Plaj',
        mevsim: 'Yaz',
        kesim: 'Bol',
        uyumlu: ['Crop top', 'Sandalet'],
        aciklama: 'Yazlık, ferah, açık renk plaj şortu.',
      }),
    },
    {
      anahtar: 'sneaker',
      name: '[test] Beyaz sneaker',
      kategori: 'Ayakkabı',
      color: 'Beyaz',
      season: 'Tüm Sezon',
      analiz: giyimAnalizi({
        sema: 'ayakkabi',
        gardirop_kategorisi: 'Ayakkabı',
        alt_kategori: 'Sneaker',
        renk: 'Beyaz',
        kumas: 'Deri düz',
        stil: 'Spor',
        mevsim: 'Tüm Sezon',
        kesim: 'Standart',
        uyumlu: ['Kot pantolon'],
        aciklama: 'Günlük beyaz spor ayakkabı.',
      }),
    },
    {
      anahtar: 'kirli_canta',
      name: '[test] Kirli siyah çanta',
      kategori: 'Çanta',
      color: 'Siyah',
      season: 'Tüm Sezon',
      isClean: false,
      analiz: giyimAnalizi({
        sema: 'canta',
        gardirop_kategorisi: 'Çanta',
        alt_kategori: 'Omuz Çantası',
        renk: 'Siyah',
        kumas: 'Deri düz',
        stil: 'Günlük',
        mevsim: 'Tüm Sezon',
        kesim: 'Standart',
        uyumlu: ['Siyah tişört'],
        aciklama: 'Siyah deri omuz çantası.',
      }),
    },
  ]

  const repository = new ClothingItemRepository(pool)
  const vectorService = new VectorService(new VectorRepository(pool), repository, new GeminiService())

  const idler = {}
  for (const tanim of tanimlar) {
    const { data: item } = await call('POST', '/clothing-items', {
      token: auth.token,
      body: {
        categoryId: kategoriId.get(tanim.kategori),
        name: tanim.name,
        color: tanim.color,
        season: tanim.season,
        isClean: tanim.isClean ?? true,
      },
    })
    idler[tanim.anahtar] = item.id
    await repository.updateAiAnalysis(item.id, tanim.analiz)
  }
  check('Kontrollü test gardırobu kuruldu', Object.keys(idler).length === tanimlar.length)

  const sonuclar = await vectorService.indexItems(Object.values(idler))
  const basarili = [...sonuclar.values()].filter((r) => r.durum === 'tamamlandi').length
  check('Embedding üretildi', basarili === tanimlar.length, `${basarili}/${tanimlar.length}`)
  if (basarili !== tanimlar.length) {
    console.log('   (Embedding üretilemedi — anahtar/kota kontrol edin; kalan kontroller atlanıyor)')
    return { userId: auth.user.id, token: auth.token, idler }
  }

  const hedefler = ['Alt', 'Ayakkabı', 'Çanta'].map((ad) => kategoriId.get(ad)).join(',')
  const basladi = Date.now()
  const { status, data } = await call(
    'GET',
    `/clothing-items/${idler.siyah_tisort}/companions?categoryIds=${hedefler}&limit=8`,
    { token: auth.token },
  )
  const sure = Date.now() - basladi

  check('Uç 200 döndü', status === 200, `durum: ${status}`)
  check('Başlangıç parçası indeksli', data?.indekslendi === true)
  check('Yanıt hızlı (< 3 sn)', sure < 3000, `${sure} ms`)

  const alt = data?.adaylar?.[kategoriId.get('Alt')] ?? []
  const ayk = data?.adaylar?.[kategoriId.get('Ayakkabı')] ?? []
  const cnt = data?.adaylar?.[kategoriId.get('Çanta')] ?? []

  console.log('      Siyah tişörte en yakın Alt adayları:')
  alt.forEach((row) => console.log(`      - ${row.benzerlik}  ${row.name}`))

  check('Alt kategorisinde iki aday da döndü', alt.length === 2)
  check(
    'ANLAMLI EŞLEŞME: siyah pantolon, beyaz yazlık şorttan daha yakın',
    alt[0]?.id === idler.siyah_pantolon,
    alt.map((r) => `${r.name}=${r.benzerlik}`).join(' > '),
  )
  check(
    'Fark gürültü seviyesinin üstünde (> 0.02)',
    alt.length === 2 && alt[0].benzerlik - alt[1].benzerlik > 0.02,
    `${(alt[0]?.benzerlik - alt[1]?.benzerlik).toFixed(4)}`,
  )
  check('Ayakkabı kategorisi de dolu', ayk.length === 1 && ayk[0].id === idler.sneaker)
  check('Başlangıç parçasının kendi kategorisi yanıtta yok', !(kategoriId.get('Üst') in data.adaylar))

  check(
    'KİRLİ aday backend tarafından ELENMİYOR ama işaretli dönüyor',
    cnt.length === 1 && cnt[0].is_clean === false,
    `is_clean: ${cnt[0]?.is_clean}`,
  )
  check('Sezon bilgisi de yanıtta', alt.every((row) => isNonEmptyString(row.season)))
  check(
    'Fotoğraf/renk alanları var (kart çizilebilsin)',
    alt.every((row) => 'image_url' in row && 'color' in row),
  )

  // --- HTTP kenar durumları ---
  console.log('\n6) HTTP davranışı')

  const { status: tokensiz } = await call(
    'GET',
    `/clothing-items/${idler.siyah_tisort}/companions?categoryIds=${hedefler}`,
  )
  check('Token olmadan 401', tokensiz === 401)

  const { status: kategorisiz, data: kategorisizData } = await call(
    'GET',
    `/clothing-items/${idler.siyah_tisort}/companions`,
    { token: auth.token },
  )
  check('categoryIds olmadan 400', kategorisiz === 400 && isNonEmptyString(kategorisizData?.error))

  const { status: bozukId } = await call(
    'GET',
    `/clothing-items/bozuk-uuid/companions?categoryIds=${hedefler}`,
    { token: auth.token },
  )
  // Bozuk id doğrudan Postgres'e gitseydi 22P02 ile 500'e düşerdi.
  check('Bozuk biçimli id 400 (500 DEĞİL)', bozukId === 400, `durum: ${bozukId}`)

  const { status: limitli, data: limitliData } = await call(
    'GET',
    `/clothing-items/${idler.siyah_tisort}/companions?categoryIds=${hedefler}&limit=1`,
    { token: auth.token },
  )
  check(
    'limit=1 tek aday döndürüyor',
    limitli === 200 && (limitliData.adaylar[kategoriId.get('Alt')] ?? []).length === 1,
  )

  // --- Veri izolasyonu: başka kullanıcının neredeyse aynı parçası ---
  console.log('\n7) Veri izolasyonu')

  const digerEmail = `rag-diger-${Date.now()}@example.com`
  const { data: diger } = await call('POST', '/auth/register', {
    body: { name: 'RAG Diger', email: digerEmail, password: 'test1234', age: 25 },
  })

  const { data: digerItem } = await call('POST', '/clothing-items', {
    token: diger.token,
    body: {
      categoryId: kategoriId.get('Alt'),
      name: '[test] BASKASININ siyah kumaş pantolonu',
      color: 'Siyah',
      season: 'Tüm Sezon',
    },
  })
  await repository.updateAiAnalysis(
    digerItem.id,
    giyimAnalizi({
      gardirop_kategorisi: 'Alt',
      alt_kategori: 'Kumaş Pantolon',
      renk: 'Siyah',
      kumas: 'Kumaş düz',
      stil: 'Günlük',
      mevsim: 'Tüm Sezon',
      kesim: 'Standart',
      uyumlu: ['Siyah tişört', 'Sneaker'],
      aciklama: 'Siyah, sade, her şeyle uyumlu kumaş pantolon.',
    }),
  )
  await vectorService.indexItem(digerItem.id)

  const { data: tekrar } = await call(
    'GET',
    `/clothing-items/${idler.siyah_tisort}/companions?categoryIds=${hedefler}&limit=8`,
    { token: auth.token },
  )
  const altTekrar = tekrar?.adaylar?.[kategoriId.get('Alt')] ?? []
  check(
    'BAŞKA kullanıcının NEREDEYSE AYNI parçası sonuçlara SIZMIYOR',
    !altTekrar.some((row) => row.id === digerItem.id),
    `${altTekrar.length} aday`,
  )

  const { status: baskasininParcasi } = await call(
    'GET',
    `/clothing-items/${digerItem.id}/companions?categoryIds=${hedefler}`,
    { token: auth.token },
  )
  check('Başkasının parçası için 404', baskasininParcasi === 404)

  // --- Analizsiz parça: hata değil, "indekslenmedi" ---
  const { data: analizsiz } = await call('POST', '/clothing-items', {
    token: auth.token,
    body: { categoryId: kategoriId.get('Üst'), name: '[test] Analizsiz üst', color: 'Pembe' },
  })
  idler.analizsiz = analizsiz.id
  const { status: analizsizStatus, data: analizsizData } = await call(
    'GET',
    `/clothing-items/${analizsiz.id}/companions?categoryIds=${hedefler}`,
    { token: auth.token },
  )
  check(
    'Analizi olmayan parça 200 + indekslendi:false (hata DEĞİL)',
    analizsizStatus === 200 && analizsizData?.indekslendi === false,
    analizsizData?.sebep,
  )

  // --- Kıyafet silinince vektörü de gitmeli ---
  await call('DELETE', `/clothing-items/${idler.sneaker}`, { token: auth.token })
  await sleep(1200)
  const { data: silmeSonrasi } = await call(
    'GET',
    `/clothing-items/${idler.siyah_tisort}/companions?categoryIds=${hedefler}&limit=8`,
    { token: auth.token },
  )
  check(
    'Silinen parça adaylardan düşüyor',
    (silmeSonrasi?.adaylar?.[kategoriId.get('Ayakkabı')] ?? []).length === 0,
  )

  return { userId: auth.user.id, token: auth.token, digerUserId: diger.user.id, digerToken: diger.token, idler: { ...idler, diger: digerItem.id } }
}

// ============================================================
// BÖLÜM 3 — KRİTİK: vektör deposu devre dışıyken Kombin Öner ayakta
// ============================================================

async function chromasizTest() {
  console.log('\n8) KRİTİK — vektör deposu devre dışıyken Kombin Öner akışı')

  const brokenBase = `http://localhost:${BROKEN_PORT}/api`
  const child = spawn(process.execPath, [SERVER_FILE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(BROKEN_PORT),
      VECTOR_STORE_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const loglar = []
  child.stdout.on('data', (c) => loglar.push(String(c)))
  child.stderr.on('data', (c) => loglar.push(String(c)))

  try {
    let hazir = false
    for (let i = 0; i < 40 && !hazir; i += 1) {
      await sleep(250)
      try {
        const { status } = await call('GET', '/health', { baseUrl: brokenBase })
        hazir = status === 200 || status === 503
      } catch {
        // henüz dinlemiyor
      }
    }
    check('Vektör deposu devre dışıyken sunucu AÇILIYOR', hazir)
    if (!hazir) return

    const email = `rag-kirik-${Date.now()}@example.com`
    const { data: auth } = await call('POST', '/auth/register', {
      baseUrl: brokenBase,
      body: { name: 'RAG Kirik', email, password: 'test1234', age: 24 },
    })
    check('Kayıt olunabiliyor', isNonEmptyString(auth?.token))
    if (!auth?.token) return

    // Kombin Öner sayfasının açılışta yaptığı ÜÇ çağrı — hiçbiri vektör
    // deposuna bağlı değil ve hepsi çalışmaya devam etmeli.
    const { status: catStatus, data: categories } = await call('GET', '/categories', {
      baseUrl: brokenBase,
      token: auth.token,
    })
    check('Kategoriler okunabiliyor', catStatus === 200 && categories.length > 0)

    const kategoriId = new Map(categories.map((row) => [row.name, row.id]))
    const olustur = async (kategori, name) => {
      const { data } = await call('POST', '/clothing-items', {
        baseUrl: brokenBase,
        token: auth.token,
        body: { categoryId: kategoriId.get(kategori), name, color: 'Siyah', season: 'Tüm Sezon' },
      })
      return data
    }

    const ust = await olustur('Üst', '[test] Vektör deposu kapalıyken üst')
    await olustur('Alt', '[test] Vektör deposu kapalıyken alt')
    await olustur('Ayakkabı', '[test] Vektör deposu kapalıyken ayakkabı')
    check('Kıyafet eklenebiliyor', isNonEmptyString(ust?.id))

    const { status: listeStatus, data: liste } = await call('GET', '/clothing-items', {
      baseUrl: brokenBase,
      token: auth.token,
    })
    check(
      'Gardırop listelenebiliyor (Kombin Öner rastgele seçimi için yeterli)',
      listeStatus === 200 && liste.length === 3,
    )

    const { status: meStatus } = await call('GET', '/auth/me', {
      baseUrl: brokenBase,
      token: auth.token,
    })
    check('Kullanıcı kaydı okunabiliyor', meStatus === 200)

    // Analizi elle yaz: parça "indekslenebilir" hâle gelsin ki 503'ün sebebi
    // eksik analiz değil, gerçekten devre dışı vektör deposu olsun.
    const pool = require('../src/config/database')
    const ClothingItemRepository = require('../src/repositories/ClothingItemRepository')
    await new ClothingItemRepository(pool).updateAiAnalysis(ust.id, {
      sema: 'giyim',
      gardirop_kategorisi: 'Üst',
      veri: { alt_kategori: 'Tişört', renk: 'Siyah', uyumluluk: {}, genel_aciklama: 'Test' },
    })

    const hedefler = ['Alt', 'Ayakkabı'].map((ad) => kategoriId.get(ad)).join(',')
    const basladi = Date.now()
    const { status: compStatus, data: compData } = await call(
      'GET',
      `/clothing-items/${ust.id}/companions?categoryIds=${hedefler}`,
      { baseUrl: brokenBase, token: auth.token },
    )
    const sure = Date.now() - basladi

    check(
      'Aday araması 503 ile AÇIKÇA bildiriyor (boş liste DEĞİL)',
      compStatus === 503 && isNonEmptyString(compData?.error),
      `${compStatus} ${compData?.error ?? ''}`,
    )
    check(
      'Hızlı başarısız oluyor (istemci beklemesin, rastgeleye düşsün)',
      sure < 12000,
      `${sure} ms`,
    )
    check('Ham SDK/bağlantı hatası sızmıyor', !/ECONNREFUSED|stack|at Object/.test(compData?.error ?? ''))

    // Kombin KAYDETME de çalışmalı: rastgele üretilen kombin kaydedilebilmeli.
    const { status: outfitStatus } = await call('POST', '/outfits', {
      baseUrl: brokenBase,
      token: auth.token,
      body: { occasion: 'Üniversite', clothingItemIds: liste.map((row) => row.id) },
    })
    check('Kombin KAYDEDİLEBİLİYOR (vektör deposu kapalıyken de)', outfitStatus === 201, `durum: ${outfitStatus}`)

    const { status: healthStatus } = await call('GET', '/health', { baseUrl: brokenBase })
    check('Sunucu hâlâ ayakta', healthStatus === 200)
    check('Süreç çökmedi', child.exitCode === null)

    await call('DELETE', `/users/${auth.user.id}`, { baseUrl: brokenBase, token: auth.token })
  } finally {
    child.kill()
    await sleep(300)
  }
}

async function temizle(sonuc) {
  if (!sonuc || !CLEANUP) return

  const VectorService = require('../src/services/VectorService')
  const VectorRepository = require('../src/repositories/VectorRepository')
  const ClothingItemRepository = require('../src/repositories/ClothingItemRepository')
  const GeminiService = require('../src/services/GeminiService')
  const pool = require('../src/config/database')

  const service = new VectorService(
    new VectorRepository(pool),
    new ClothingItemRepository(pool),
    new GeminiService(),
  )
  for (const id of Object.values(sonuc.idler)) await service.removeItem(id)
  if (sonuc.digerUserId) {
    await call('DELETE', `/users/${sonuc.digerUserId}`, { token: sonuc.digerToken })
  }
  await call('DELETE', `/users/${sonuc.userId}`, { token: sonuc.token })
  console.log('\nTest verisi silindi.')
}

async function main() {
  console.log('\n=== AŞAMA 4: RAG İLE KOMBİN ÖNER ===\n')

  await birimTestleri()

  let sonuc = null
  if (!ONLY_UNIT) {
    try {
      const { status } = await call('GET', '/health')
      if (status !== 200 && status !== 503) throw new Error('sunucu yok')
    } catch {
      console.log('\n⚠ Sunucu çalışmıyor. Uçtan uca bölümler atlanıyor.')
      console.log('  backend/ klasöründe `npm run dev` çalıştırın.\n')
      ozetYaz()
      process.exit(failed > 0 ? 1 : 0)
    }

    sonuc = await gercekTest()
    await chromasizTest()
    await temizle(sonuc)

    if (sonuc && !CLEANUP) {
      console.log('\nTest verisi BİLEREK silinmedi (DBeaver\'dan gözle doğrulanabilsin).')
      console.log('Silmek için: node test-scripts/test-outfit-rag.js --cleanup')
    }
  } else {
    console.log('\n(--birim: uçtan uca bölümler atlandı)')
  }

  ozetYaz()
  process.exit(failed > 0 ? 1 : 0)
}

function ozetYaz() {
  console.log(`\n${'='.repeat(46)}`)
  console.log(`SONUÇ: ${passed} başarılı, ${failed} başarısız`)
  console.log('='.repeat(46))
}

main().catch((error) => {
  console.error('\nBeklenmeyen hata:', error)
  process.exit(1)
})
