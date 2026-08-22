// Gemini entegrasyonu — AŞAMA 3: vektör veritabanı (ChromaDB) testleri.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-vector.js
//   node test-scripts/test-vector.js --birim      (yalnızca birim; Chroma/anahtar GEREKMEZ)
//   node test-scripts/test-vector.js --cleanup    (test verisini sonda siler)
//
// VARSAYILAN OLARAK TEST VERİSİ SİLİNMEZ: koleksiyonun gerçekten dolduğu
// Chroma'dan / DBeaver'dan gözle doğrulanabilsin diye.
//
// BÖLÜM 1 (birim) ÇALIŞAN CHROMA VE GEÇERLİ ANAHTAR GEREKTİRMEZ: sahte
// katmanlarla çalışır ve asıl güvence buradadır — Chroma veya embedding API'si
// düşse de kıyafet akışının kırılmaması.
// BÖLÜM 2-4 çalışan Chroma container'ı + geçerli GEMINI_API_KEY ister.
//
// ÖNEMLİ: Bölüm 3 ai_analysis'i ELLE yazar (sentetik), Gemini'ye görsel analizi
// YAPTIRMAZ. Sebep iki türlü: (1) generateContent ücretsiz kotası günde 20
// istekle sınırlı ve testin ona bağlı olmaması gerekiyor, (2) "iki beyaz üst
// birbirine yakın çıkmalı" iddiası ancak girdiyi biz kontrol edersek
// DETERMİNİSTİK olarak sınanabilir. Embedding çağrıları gerçektir.

const path = require('node:path')
const { spawn } = require('node:child_process')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`
const SERVER_FILE = path.join(__dirname, '..', 'server.js')

// Chroma'sı ölü bir porta bakan ikinci sunucunun portu.
const BROKEN_PORT = 3198
const DEAD_CHROMA_PORT = 9

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

// ---- Sahte katmanlar (Bölüm 1) ----

function sahteParca(extra = {}) {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    user_id: 'user-1',
    category_id: 1,
    name: 'Koton beyaz keten şort',
    color: 'Beyaz',
    brand: 'Koton',
    season: 'Yaz',
    is_deleted: false,
    ai_analysis: {
      sema: 'giyim',
      model: 'sahte-model',
      gardirop_kategorisi: 'Alt',
      veri: {
        alt_kategori: 'Keten Şort',
        renk: 'Beyaz',
        ikincil_renkler: ['Bej'],
        kumas_deseni: 'Keten düz',
        stil: 'Günlük',
        mevsim_uygunlugu: 'Yaz',
        kesim_tipi: 'Bol',
        uyumluluk: {
          vucut_tipi: ['Kum saati', 'Dikdörtgen'],
          ten_tonu: ['Sıcak ten'],
          uyumlu_parca_turleri: ['Crop top', 'Sandalet'],
          uyumsuz_kombinasyonlar: ['Kışlık mont'],
        },
        genel_aciklama: 'Yazlık, ferah bir şort.',
      },
    },
    ...extra,
  }
}

function sahteItemRepo(item) {
  return {
    item,
    async findById() {
      return this.item
    },
  }
}

function sahteVectorRepo(overrides = {}) {
  return {
    yazilanlar: [],
    sorgular: [],
    async getExistingIds() {
      return new Set()
    },
    async upsertItem(args) {
      this.yazilanlar.push(args)
      return true
    },
    async query(args) {
      this.sorgular.push(args)
      return []
    },
    async deleteItems() {
      return true
    },
    async getCollection() {
      return { async get() { return { ids: [], embeddings: [] } } }
    },
    ...overrides,
  }
}

function sahteGemini(behaviour) {
  return {
    cagriSayisi: 0,
    async createEmbeddings(texts) {
      this.cagriSayisi += 1
      this.sonMetinler = texts
      if (behaviour) return behaviour(texts)
      return { model: 'sahte-embed', vectors: texts.map(() => [0.1, 0.2, 0.3]) }
    },
  }
}

async function birimTestleri() {
  const VectorService = require('../src/services/VectorService')
  const { DURUM } = VectorService

  console.log('1) VectorService — embedding metni (ai_analysis → anlamlı cümle)')

  const service = new VectorService(sahteVectorRepo(), sahteItemRepo(sahteParca()), sahteGemini())
  const ozet = service.buildSummaryText(sahteParca())
  console.log(`      → "${ozet}"`)

  check('Kullanıcının verdiği ad metinde', ozet.includes('Koton beyaz keten şort'))
  check('Modelin bulduğu tür metinde', ozet.includes('Keten Şort'))
  check('Gardırop kategorisi metinde', ozet.includes('Alt kategorisinde'))
  check('Renk metinde', ozet.includes('Beyaz'))
  check('İkincil renk metinde', ozet.includes('Bej'))
  check('Kumaş/desen metinde', ozet.includes('Keten düz'))
  check('Stil metinde', ozet.includes('Günlük stilinde'))
  check('Mevsim metinde', ozet.includes('Yaz mevsimine'))
  check('Kesim metinde', ozet.includes('Bol'))
  check('Marka metinde', ozet.includes('Koton'))
  check(
    'Vücut tipi doğal dille birleştirildi ("a ve b")',
    ozet.includes('Kum saati ve Dikdörtgen vücut tipine'),
  )
  check('Uyumlu parçalar metinde', ozet.includes('Crop top ve Sandalet ile iyi gider'))
  check('Uyumsuz kombinasyonlar metinde', ozet.includes('Kışlık mont ile uyumsuzdur'))
  check('Genel açıklama metinde', ozet.includes('Yazlık, ferah bir şort.'))
  check(
    'HAM JSON anahtarları metne SIZMIYOR',
    !/alt_kategori|kumas_deseni|uyumluluk|vucut_tipi|genel_aciklama/.test(ozet),
  )
  check('Metin cümlelerden oluşuyor (JSON parantezi yok)', !/[{}[\]"]/.test(ozet))

  // Makyaj şeması giyimden farklı alanlar taşır; metin yine kurulmalı.
  const makyaj = sahteParca({
    name: 'Maybelline Lifter Gloss',
    ai_analysis: {
      sema: 'makyaj',
      gardirop_kategorisi: 'Makyaj',
      veri: {
        urun_turu: 'Dudak Parlatıcısı',
        renk: 'Işıltılı Pembe',
        bitis_efekti: 'Işıltılı',
        uyumluluk: { ten_tonu: ['Açık Ten'], goz_rengi: ['Kahverengi', 'Yeşil'] },
        genel_aciklama: 'Dudaklara dolgunluk verir.',
      },
    },
  })
  const makyajOzet = service.buildSummaryText(makyaj)
  check(
    'Makyaj şeması için de metin kuruluyor',
    makyajOzet.includes('Dudak Parlatıcısı') &&
      makyajOzet.includes('Işıltılı') &&
      makyajOzet.includes('Kahverengi ve Yeşil göz rengini'),
  )

  // Alanların çoğu boş olan bozuk bir analiz sayfayı/servisi kırmamalı.
  const eksik = sahteParca({
    name: 'Adsız parça',
    ai_analysis: { sema: 'giyim', veri: { uyumluluk: {} } },
  })
  check('Eksik alanlı analizde de metin üretilir', service.buildSummaryText(eksik).length > 0)
  check(
    'Tamamen boş analizde metin boş kalır (yazma atlanır)',
    service.buildSummaryText({ ai_analysis: { veri: {} } }).trim() === '',
  )

  console.log('\n2) VectorService — YAZMA yolu Chroma/Gemini çökse de FIRLATMAZ')

  const originalEnabled = process.env.CHROMA_ENABLED
  const originalKey = process.env.GEMINI_API_KEY
  process.env.CHROMA_ENABLED = 'true'
  process.env.GEMINI_API_KEY = 'test-anahtari'

  {
    const gemini = sahteGemini(() => {
      throw new Error('Gemini servisine ulaşılamıyor')
    })
    const repo = sahteVectorRepo()
    const s = new VectorService(repo, sahteItemRepo(sahteParca()), gemini)

    let firlattiMi = false
    let sonuc
    try {
      sonuc = await s.indexItem(sahteParca().id)
    } catch {
      firlattiMi = true
    }
    check('Embedding API hata verince FIRLATMAZ', !firlattiMi)
    check('Sonuç "basarisiz" bildirilir', sonuc?.durum === DURUM.BASARISIZ, sonuc?.sebep)
    check('Hata durumunda Chroma\'ya YAZILMAZ', repo.yazilanlar.length === 0)
  }

  {
    const repo = sahteVectorRepo({
      async upsertItem() {
        throw new Error('ChromaDB yanıt vermiyor')
      },
    })
    const s = new VectorService(repo, sahteItemRepo(sahteParca()), sahteGemini())
    const sonuc = await s.indexItem(sahteParca().id)
    check(
      'ChromaDB yazma hatası da FIRLATMAZ',
      sonuc.durum === DURUM.BASARISIZ && sonuc.sebep === 'chroma-yazma-hatasi',
    )
  }

  {
    const repo = sahteVectorRepo({
      async getExistingIds() {
        throw new Error('ChromaDB kapalı')
      },
    })
    const gemini = sahteGemini()
    const s = new VectorService(repo, sahteItemRepo(sahteParca()), gemini)
    const sonuc = await s.indexItem(sahteParca().id)
    check(
      'Chroma erişilemezken embedding HİÇ üretilmez (boşa para harcanmaz)',
      sonuc.durum === DURUM.BASARISIZ && gemini.cagriSayisi === 0,
      sonuc.sebep,
    )
  }

  {
    const s = new VectorService(
      sahteVectorRepo(),
      { async findById() { throw new Error('veritabanı düştü') } },
      sahteGemini(),
    )
    const sonuc = await s.indexItem('x')
    check(
      'Veritabanı okuma hatası da FIRLATMAZ',
      sonuc.durum === DURUM.BASARISIZ && sonuc.sebep === 'kayit-okunamadi',
    )
  }

  {
    const gemini = sahteGemini()
    const analizsiz = new VectorService(
      sahteVectorRepo(),
      sahteItemRepo(sahteParca({ ai_analysis: null })),
      gemini,
    )
    check(
      'Analizi olmayan parça atlanır (embedding istenmez)',
      (await analizsiz.indexItem('x')).sebep === 'analiz-yok' && gemini.cagriSayisi === 0,
    )

    const yok = new VectorService(sahteVectorRepo(), sahteItemRepo(null), gemini)
    check('Kaydı olmayan id atlanır', (await yok.indexItem('x')).sebep === 'kayit-yok')
  }

  {
    const gemini = sahteGemini()
    const repo = sahteVectorRepo({
      async getExistingIds(ids) {
        return new Set(ids)
      },
    })
    const s = new VectorService(repo, sahteItemRepo(sahteParca()), gemini)
    const sonuc = await s.indexItem(sahteParca().id)
    check(
      'MALİYET: zaten indekslenmiş parça tekrar embed EDİLMEZ',
      sonuc.durum === DURUM.ATLANDI &&
        sonuc.sebep === 'zaten-indekslenmis' &&
        gemini.cagriSayisi === 0,
    )

    const zorla = await s.indexItem(sahteParca().id, { force: true })
    check('force ile yeniden üretilebilir', zorla.durum === DURUM.TAMAMLANDI && gemini.cagriSayisi === 1)
  }

  {
    const gemini = sahteGemini(async (texts) => {
      await sleep(120)
      return { model: 'sahte-embed', vectors: texts.map(() => [1, 2, 3]) }
    })
    const s = new VectorService(sahteVectorRepo(), sahteItemRepo(sahteParca()), gemini)
    const [a, b] = await Promise.all([s.indexItem('x'), s.indexItem('x')])
    check(
      'Aynı parçaya eşzamanlı iki tetikleme → tek embedding çağrısı',
      gemini.cagriSayisi === 1 &&
        [a.durum, b.durum].includes(DURUM.ATLANDI) &&
        [a.durum, b.durum].includes(DURUM.TAMAMLANDI),
    )
  }

  {
    const gemini = sahteGemini(() => {
      const error = new Error('Kota doldu')
      error.isRateLimited = true
      throw error
    })
    const s = new VectorService(sahteVectorRepo(), sahteItemRepo(sahteParca()), gemini)
    const ilk = await s.indexItem('x')
    check('Kota hatasında sistem ayakta', ilk.durum === DURUM.BASARISIZ && ilk.sebep === 'kota')

    const ikinci = await s.indexItem('y')
    check(
      'Kota sonrası SOĞUMA: yeni istek gönderilmez',
      ikinci.durum === DURUM.ATLANDI && gemini.cagriSayisi === 1,
      ikinci.sebep,
    )
  }

  {
    let cagri = 0
    const gemini = sahteGemini((texts) => {
      cagri += 1
      if (cagri === 1) {
        const error = new Error('zaman aşımı')
        error.isRetryable = true
        throw error
      }
      return { model: 'sahte-embed', vectors: texts.map(() => [1, 2, 3]) }
    })
    const s = new VectorService(sahteVectorRepo(), sahteItemRepo(sahteParca()), gemini)
    const sonuc = await s.indexItem('x')
    check('GEÇİCİ hata yeniden deneniyor', sonuc.durum === DURUM.TAMAMLANDI && cagri === 2)
  }

  {
    const gemini = sahteGemini(() => {
      const error = new Error('anahtar geçersiz')
      error.isRetryable = false
      throw error
    })
    const s = new VectorService(sahteVectorRepo(), sahteItemRepo(sahteParca()), gemini)
    await s.indexItem('x')
    check('KALICI hata yeniden DENENMEZ', gemini.cagriSayisi === 1)
  }

  {
    process.env.CHROMA_ENABLED = 'false'
    const gemini = sahteGemini()
    const s = new VectorService(sahteVectorRepo(), sahteItemRepo(sahteParca()), gemini)
    const sonuc = await s.indexItem('x')
    check(
      'CHROMA_ENABLED=false iken hiçbir şey yapılmaz',
      sonuc.durum === DURUM.ATLANDI &&
        sonuc.sebep === 'chroma-devre-disi' &&
        gemini.cagriSayisi === 0,
    )
    process.env.CHROMA_ENABLED = 'true'
  }

  {
    delete process.env.GEMINI_API_KEY
    const gemini = sahteGemini()
    const s = new VectorService(sahteVectorRepo(), sahteItemRepo(sahteParca()), gemini)
    const sonuc = await s.indexItem('x')
    check(
      'Anahtar yokken dış servise gidilmez',
      sonuc.sebep === 'anahtar-yok' && gemini.cagriSayisi === 0,
    )
    process.env.GEMINI_API_KEY = 'test-anahtari'
  }

  {
    const s = new VectorService(
      { async getExistingIds() { throw new Error('patladı') } },
      { async findById() { throw new Error('patladı') } },
      sahteGemini(),
    )
    const sonuc = await s.indexItemInBackground('x')
    check('indexItemInBackground asla reject etmez', sonuc.durum === DURUM.BASARISIZ)
  }

  {
    const s = new VectorService(
      sahteVectorRepo({ async deleteItems() { throw new Error('Chroma kapalı') } }),
      sahteItemRepo(sahteParca()),
      sahteGemini(),
    )
    const sonuc = await s.removeItem('x')
    check('removeItem hata durumunda da FIRLATMAZ', sonuc.durum === DURUM.BASARISIZ)
  }

  console.log('\n3) VectorService — OKUMA yolu (findSimilar) ve veri izolasyonu')

  {
    const s = new VectorService(
      sahteVectorRepo(),
      sahteItemRepo(sahteParca({ user_id: 'baskasi' })),
      sahteGemini(),
    )
    let hata = null
    try {
      await s.findSimilar(sahteParca().id, 'user-1')
    } catch (error) {
      hata = error
    }
    check(
      'Başkasının parçası için 404 (403 DEĞİL — varlığı ele vermez)',
      hata?.statusCode === 404,
      hata?.message,
    )

    // Bozuk biçimli id Postgres'e HİÇ gitmemeli: 22P02 ile 500 dönerdi.
    hata = null
    try {
      await s.findSimilar('bozuk-id', 'user-1')
    } catch (error) {
      hata = error
    }
    check(
      'Bozuk biçimli id 400 (Postgres 22P02 yüzünden 500 DEĞİL)',
      hata?.statusCode === 400,
      hata?.message,
    )
  }

  {
    const s = new VectorService(
      sahteVectorRepo({
        async getCollection() {
          throw new Error('ChromaDB yanıt vermiyor')
        },
      }),
      sahteItemRepo(sahteParca()),
      sahteGemini(),
    )
    let hata = null
    try {
      await s.findSimilar(sahteParca().id, 'user-1')
    } catch (error) {
      hata = error
    }
    check(
      'OKUMA yolu Chroma düştüğünde 503 FIRLATIR (sessizce boş dönmez)',
      hata?.statusCode === 503,
      hata?.message,
    )
  }

  {
    const s = new VectorService(
      sahteVectorRepo(),
      sahteItemRepo(sahteParca()),
      sahteGemini(),
    )
    const sonuc = await s.findSimilar(sahteParca().id, 'user-1')
    check(
      'Henüz indekslenmemiş parça hata değil, açık bir cevap',
      sonuc.indekslendi === false && Array.isArray(sonuc.benzerler) && sonuc.benzerler.length === 0,
      sonuc.sebep,
    )
  }

  {
    // KRİTİK GÜVENLİK: sorgu daima user_id ile filtrelenmeli.
    const repo = sahteVectorRepo({
      async getCollection() {
        return { async get() { return { ids: ['x'], embeddings: [[1, 2, 3]] } } }
      },
    })
    const s = new VectorService(repo, sahteItemRepo(sahteParca()), sahteGemini())

    await s.findSimilar(sahteParca().id, 'user-1')
    check(
      'Sorguda KULLANICI FİLTRESİ var (başkasının gardırobu sızmaz)',
      JSON.stringify(repo.sorgular[0]?.where ?? {}).includes('user-1'),
      JSON.stringify(repo.sorgular[0]?.where),
    )
    check(
      'Kendi vektörü yeniden ÜRETİLMEZ (Chroma\'dan okunur)',
      repo.sorgular[0]?.embedding?.length === 3,
    )

    await s.findSimilar(sahteParca().id, 'user-1', { categoryId: 3 })
    const where = JSON.stringify(repo.sorgular[1]?.where ?? {})
    check(
      'Kategori filtresi kullanıcı filtresine EK olarak uygulanır',
      where.includes('user-1') && where.includes('category_id') && where.includes('3'),
      where,
    )

    await s.findSimilar(sahteParca().id, 'user-1', { limit: 5 })
    check(
      'Parçanın kendisini elemek için bir fazla komşu istenir',
      repo.sorgular[2]?.limit === 6,
      String(repo.sorgular[2]?.limit),
    )
  }

  if (originalEnabled === undefined) delete process.env.CHROMA_ENABLED
  else process.env.CHROMA_ENABLED = originalEnabled
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY
  else process.env.GEMINI_API_KEY = originalKey
}

// ---- BÖLÜM 2: ChromaDB container'ı ----
async function chromaBaglantiTesti() {
  console.log('\n4) ChromaDB container bağlantısı')

  const VectorRepository = require('../src/repositories/VectorRepository')
  const { getHost, getPort, getCollectionName } = require('../src/config/chroma')
  const repo = new VectorRepository()

  let heartbeat = null
  try {
    heartbeat = await repo.heartbeat()
  } catch {
    heartbeat = null
  }
  check(
    `ChromaDB ayakta (${getHost()}:${getPort()})`,
    typeof heartbeat === 'number' || typeof heartbeat === 'bigint',
    'docker compose up -d ile başlar',
  )
  if (heartbeat === null) return false

  // Docker Compose'un iki servisi de ayağa kaldırdığını doğrula: Postgres'e
  // giden asıl uygulama yolu zaten çalışıyorsa /health 200 döner.
  const { status, data } = await call('GET', '/health')
  check('Postgres ile birlikte çalışıyor (/health 200)', status === 200, data?.status)

  let collection = null
  try {
    collection = await repo.getCollection()
  } catch {
    collection = null
  }
  check(`Koleksiyon açılabiliyor ("${getCollectionName()}")`, collection !== null)

  let sayi = null
  try {
    sayi = await repo.count()
  } catch {
    sayi = null
  }
  check('Koleksiyon sayılabiliyor', typeof sayi === 'number', `${sayi} vektör`)

  return true
}

// ---- BÖLÜM 3: gerçek embedding + benzerlik ----
//
// ai_analysis SENTETİK olarak yazılır (bkz. dosya başı): "iki beyaz üst
// birbirine yakın çıkmalı" iddiası ancak girdiyi kontrol edersek sınanabilir.
async function benzerlikTesti() {
  console.log('\n5) Gerçek embedding + benzerlik (kontrollü veri)')

  const pool = require('../src/config/database')
  const ClothingItemRepository = require('../src/repositories/ClothingItemRepository')
  const VectorRepository = require('../src/repositories/VectorRepository')
  const VectorService = require('../src/services/VectorService')
  const GeminiService = require('../src/services/GeminiService')

  const email = `vektor-${Date.now()}@example.com`
  const { data: auth } = await call('POST', '/auth/register', {
    body: { name: 'Vektör Test', email, password: 'test1234', age: 26 },
  })
  if (!auth?.token) {
    check('Test kullanıcısı oluşturuldu', false)
    return null
  }

  const { data: categories } = await call('GET', '/categories', { token: auth.token })
  const kategoriId = new Map(categories.map((row) => [row.name, row.id]))

  const giyimAnalizi = (veri) => ({
    sema: 'giyim',
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
        uyumlu_parca_turleri: veri.uyumlu,
        uyumsuz_kombinasyonlar: [],
      },
      genel_aciklama: veri.aciklama,
    },
  })

  // İKİ BEYAZ ÜST + bir siyah bot + bir ruj. Beklenti: beyaz üstler
  // birbirine, bot ve ruj uzağa düşsün.
  const tanimlar = [
    {
      anahtar: 'beyaz_gomlek',
      name: '[test] Beyaz keten gömlek',
      kategori: 'Üst',
      color: 'Beyaz',
      analiz: giyimAnalizi({
        gardirop_kategorisi: 'Üst',
        alt_kategori: 'Gömlek',
        renk: 'Beyaz',
        kumas: 'Keten düz',
        stil: 'Günlük',
        mevsim: 'Yaz',
        kesim: 'Oversize',
        uyumlu: ['Kot pantolon', 'Şort'],
        aciklama: 'Yazlık beyaz keten gömlek, ferah ve sade.',
      }),
    },
    {
      anahtar: 'beyaz_bluz',
      name: '[test] Beyaz pamuklu bluz',
      kategori: 'Üst',
      color: 'Beyaz',
      analiz: giyimAnalizi({
        gardirop_kategorisi: 'Üst',
        alt_kategori: 'Bluz',
        renk: 'Beyaz',
        kumas: 'Pamuklu düz',
        stil: 'Günlük',
        mevsim: 'Yaz',
        kesim: 'Bol',
        uyumlu: ['Kot pantolon', 'Etek'],
        aciklama: 'Yazlık beyaz pamuklu bluz, günlük kullanıma uygun.',
      }),
    },
    {
      anahtar: 'siyah_bot',
      name: '[test] Siyah deri bot',
      kategori: 'Ayakkabı',
      color: 'Siyah',
      analiz: {
        sema: 'ayakkabi',
        model: 'test-sentetik',
        analiz_tarihi: new Date().toISOString(),
        gardirop_kategorisi: 'Ayakkabı',
        veri: {
          alt_kategori: 'Bot',
          renk: 'Siyah',
          ikincil_renkler: [],
          kumas_deseni: 'Deri düz',
          stil: 'Klasik',
          mevsim_uygunlugu: 'Kış',
          kesim_tipi: 'Standart',
          topuk_yuksekligi: 'Kalın topuk',
          ayakkabi_turu: 'Bot',
          uyumluluk: {
            vucut_tipi: [],
            ten_tonu: [],
            uyumlu_parca_turleri: ['Kalın çorap', 'Kaban'],
            uyumsuz_kombinasyonlar: [],
          },
          genel_aciklama: 'Kışlık siyah deri bot.',
        },
      },
    },
    {
      anahtar: 'ruj',
      name: '[test] Mat ruj',
      kategori: 'Makyaj',
      color: 'Kırmızı',
      analiz: {
        sema: 'makyaj',
        model: 'test-sentetik',
        analiz_tarihi: new Date().toISOString(),
        gardirop_kategorisi: 'Makyaj',
        veri: {
          urun_turu: 'Ruj',
          renk: 'Kırmızı',
          urun_adi: null,
          bitis_efekti: 'Mat',
          uyumluluk: { ten_tonu: ['Açık Ten'], goz_rengi: ['Kahverengi'] },
          genel_aciklama: 'Mat kırmızı ruj.',
        },
      },
    },
  ]

  const clothingItemRepository = new ClothingItemRepository(pool)
  const vectorRepository = new VectorRepository()
  const service = new VectorService(
    vectorRepository,
    clothingItemRepository,
    new GeminiService(),
  )

  const idler = {}
  for (const tanim of tanimlar) {
    const { data: item } = await call('POST', '/clothing-items', {
      token: auth.token,
      body: { categoryId: kategoriId.get(tanim.kategori), name: tanim.name, color: tanim.color },
    })
    // ai_analysis ELLE yazılır: Gemini'nin görsel analizi (ve günlük kotası)
    // bu testin konusu değil.
    await clothingItemRepository.updateAiAnalysis(item.id, tanim.analiz)
    idler[tanim.anahtar] = item.id
  }
  check('4 test parçası oluşturuldu ve analizleri yazıldı', Object.keys(idler).length === 4)

  const sonuclar = await service.indexItems(Object.values(idler))
  const basarili = [...sonuclar.values()].filter((r) => r.durum === 'tamamlandi').length
  check('Embeddingler ÜRETİLDİ ve ChromaDB\'ye yazıldı', basarili === 4, `${basarili}/4`)
  if (basarili !== 4) {
    console.log('      (embedding üretilemedi — kota veya bağlantı; sonraki kontroller atlanıyor)')
    return { userId: auth.user.id, token: auth.token, email, idler }
  }

  const boyut = [...sonuclar.values()][0]?.boyut
  check('Vektör boyutu makul', typeof boyut === 'number' && boyut > 100, `${boyut} boyut`)

  // --- ASIL İDDİA ---
  const { data: benzer } = await call(
    'GET',
    `/clothing-items/${idler.beyaz_gomlek}/similar`,
    { token: auth.token },
  )
  check('Benzer araması 200 döndü', Array.isArray(benzer?.benzerler), benzer?.sebep)
  check('Parça indekslenmiş olarak işaretli', benzer?.indekslendi === true)

  const sira = (benzer?.benzerler ?? []).map((row) => row.name)
  console.log(
    `      → sıralama: ${(benzer?.benzerler ?? [])
      .map((r) => `${r.name.replace('[test] ', '')} (${r.benzerlik})`)
      .join(' > ')}`,
  )

  check('Kaynak parçanın KENDİSİ sonuçta yok', !sira.includes('[test] Beyaz keten gömlek'))
  check(
    'İKİ BEYAZ ÜST birbirine EN YAKIN çıktı',
    sira[0] === '[test] Beyaz pamuklu bluz',
    `en yakın: ${sira[0]}`,
  )

  const puan = new Map((benzer?.benzerler ?? []).map((row) => [row.name, row.benzerlik]))
  check(
    'Beyaz bluz, siyah bottan DAHA YAKIN',
    puan.get('[test] Beyaz pamuklu bluz') > puan.get('[test] Siyah deri bot'),
    `${puan.get('[test] Beyaz pamuklu bluz')} > ${puan.get('[test] Siyah deri bot')}`,
  )
  // NOT: "makyaj en uzak olmalı" DİYE BİR KURAL YOK ve ilk koşuda bu varsayım
  // kırıldı: ruj 0.7977, bot 0.7973 çıktı — aradaki fark gürültü seviyesinde.
  // Anlamlı ve kararlı olan iddia şu: ilgisiz parçaların HEPSİ, benzer parçadan
  // BELİRGİN biçimde uzak. Ölçülen ayrım ~0.16, eşik güvenli tarafta tutuldu.
  const enYakinPuan = puan.get('[test] Beyaz pamuklu bluz')
  const ilgisizler = ['[test] Siyah deri bot', '[test] Mat ruj']
  check(
    'İlgisiz parçalar (bot, ruj) beyaz bluzdan BELİRGİN biçimde uzak',
    ilgisizler.every((ad) => enYakinPuan - puan.get(ad) > 0.1),
    ilgisizler.map((ad) => `${ad.replace('[test] ', '')}: ${puan.get(ad)}`).join(', '),
  )
  check(
    'Benzerlik puanları 0–1 aralığında ve azalan sırada',
    (benzer?.benzerler ?? []).every((r) => r.benzerlik >= 0 && r.benzerlik <= 1) &&
      (benzer?.benzerler ?? []).every(
        (r, i, a) => i === 0 || a[i - 1].benzerlik >= r.benzerlik,
      ),
  )
  check(
    'Sonuçlar Postgres\'ten zenginleştirilmiş (ad/kategori/özet var)',
    (benzer?.benzerler ?? []).every(
      (r) => isNonEmptyString(r.name) && typeof r.category_id === 'number' && isNonEmptyString(r.ozet),
    ),
  )

  // Kategori filtresi
  const { data: filtreli } = await call(
    'GET',
    `/clothing-items/${idler.beyaz_gomlek}/similar?categoryId=${kategoriId.get('Üst')}`,
    { token: auth.token },
  )
  check(
    'Kategori filtresi çalışıyor (yalnızca Üst döndü)',
    (filtreli?.benzerler ?? []).length === 1 &&
      filtreli.benzerler[0].name === '[test] Beyaz pamuklu bluz',
    `${filtreli?.benzerler?.length} sonuç`,
  )

  // AYNI KATEGORİ AKIŞI — Kıyafet Detay'daki "Buna Benzer Diğer Parçalar"
  // bölümünü besleyen çağrı tam olarak budur (categoryId = parçanın kendi
  // kategorisi). Bölüm paylaşılan kıyafet kartını kullandığı için satırlar
  // kartın çizdiği alanları da taşımalı; eksik olsalardı favorilenmiş bir
  // parça boş kalple, kirli bir parça rozetsiz görünürdü.
  const kartAlanlari = filtreli?.benzerler?.[0] ?? {}
  check(
    'Kart alanları yanıtta: is_favorite / is_clean / season',
    'is_favorite' in kartAlanlari && 'is_clean' in kartAlanlari && 'season' in kartAlanlari,
    Object.keys(kartAlanlari).join(', '),
  )
  check(
    'is_favorite ve is_clean gerçek boolean (kart bunlarla çiziyor)',
    typeof kartAlanlari.is_favorite === 'boolean' && typeof kartAlanlari.is_clean === 'boolean',
  )
  check(
    'Fotoğraf alanı da var (kart görseli)',
    'image_url' in kartAlanlari && 'color' in kartAlanlari,
  )

  // Kategoride başka parça YOKSA boş liste döner — hata değil. Arayüz bunu
  // "bölümü hiç gösterme" olarak yorumlar.
  const { status: yalnizStatus, data: yalniz } = await call(
    'GET',
    `/clothing-items/${idler.siyah_bot}/similar?categoryId=${kategoriId.get('Ayakkabı')}`,
    { token: auth.token },
  )
  check(
    'Aynı kategoride başka parça yoksa BOŞ LİSTE (hata değil, 200)',
    yalnizStatus === 200 && yalniz?.indekslendi === true && (yalniz?.benzerler ?? []).length === 0,
    `${yalnizStatus}, ${yalniz?.benzerler?.length} sonuç`,
  )
  check(
    'Parçanın kendisi kendi kategorisinde bile dönmüyor',
    !(yalniz?.benzerler ?? []).some((row) => row.id === idler.siyah_bot),
  )

  // limit
  const { data: limitli } = await call(
    'GET',
    `/clothing-items/${idler.beyaz_gomlek}/similar?limit=1`,
    { token: auth.token },
  )
  check('limit parametresi uygulanıyor', (limitli?.benzerler ?? []).length === 1)

  const { data: bozukLimit } = await call(
    'GET',
    `/clothing-items/${idler.beyaz_gomlek}/similar?limit=abc`,
    { token: auth.token },
  )
  check(
    'Geçersiz limit varsayılana düşer (500 değil)',
    Array.isArray(bozukLimit?.benzerler),
  )

  // --- Veri izolasyonu ---
  const { data: digerAuth } = await call('POST', '/auth/register', {
    body: {
      name: 'Baska Kullanici',
      email: `vektor-diger-${Date.now()}@example.com`,
      password: 'test1234',
      age: 30,
    },
  })

  const { status: yabanciStatus } = await call(
    'GET',
    `/clothing-items/${idler.beyaz_gomlek}/similar`,
    { token: digerAuth.token },
  )
  check('Başkasının parçası için 404', yabanciStatus === 404, `durum: ${yabanciStatus}`)

  const { data: digerItem } = await call('POST', '/clothing-items', {
    token: digerAuth.token,
    body: { categoryId: kategoriId.get('Üst'), name: '[test] Diğer kullanıcı beyaz gömlek', color: 'Beyaz' },
  })
  await clothingItemRepository.updateAiAnalysis(digerItem.id, tanimlar[0].analiz)
  await service.indexItem(digerItem.id)

  const { data: izolasyon } = await call(
    'GET',
    `/clothing-items/${idler.beyaz_gomlek}/similar`,
    { token: auth.token },
  )
  check(
    'BAŞKA KULLANICININ neredeyse aynı parçası sonuçlarda YOK',
    !(izolasyon?.benzerler ?? []).some((r) => r.name.includes('Diğer kullanıcı')),
  )

  const { status: tokensiz } = await call('GET', `/clothing-items/${idler.beyaz_gomlek}/similar`)
  check('Token\'sız istek 401', tokensiz === 401)

  // Silinen parçanın vektörü de gitmeli.
  await call('DELETE', `/clothing-items/${idler.ruj}`, { token: auth.token })
  await sleep(1500)
  const kalanlar = await vectorRepository.getExistingIds([idler.ruj])
  check('Kıyafet silinince vektörü de silindi', !kalanlar.has(idler.ruj))

  await call('DELETE', `/users/${digerAuth.user.id}`, { token: digerAuth.token })
  await service.removeItem(digerItem.id)

  return { userId: auth.user.id, token: auth.token, email, idler }
}

// ---- BÖLÜM 4: ChromaDB erişilemezken uygulama ayakta ----
async function chromasizSunucuTesti() {
  console.log('\n6) KRİTİK — ChromaDB erişilemezken kıyafet akışı')

  const brokenBase = `http://localhost:${BROKEN_PORT}/api`
  const child = spawn(process.execPath, [SERVER_FILE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(BROKEN_PORT),
      // Hiçbir şeyin dinlemediği bir port: her Chroma çağrısı bağlantı hatası.
      CHROMA_PORT: String(DEAD_CHROMA_PORT),
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
    check('ChromaDB erişilemezken sunucu AÇILIYOR', hazir)
    if (!hazir) return

    const email = `vektor-kirik-${Date.now()}@example.com`
    const { data: auth } = await call('POST', '/auth/register', {
      baseUrl: brokenBase,
      body: { name: 'Vektor Kirik', email, password: 'test1234', age: 24 },
    })
    check('Kayıt olunabiliyor', isNonEmptyString(auth?.token))
    if (!auth?.token) return

    const { status: createStatus, data: item } = await call('POST', '/clothing-items', {
      baseUrl: brokenBase,
      token: auth.token,
      body: { categoryId: 1, name: '[test] Chroma yokken eklenen parça', color: 'Siyah' },
    })
    check('Kıyafet eklenebiliyor (201)', createStatus === 201, `durum: ${createStatus}`)

    // Analizi elle yaz ve indekslemeyi tetikle: Chroma ölü olduğu için
    // başarısız olmalı ama HİÇBİR ŞEYİ KIRMAMALI.
    const pool = require('../src/config/database')
    const ClothingItemRepository = require('../src/repositories/ClothingItemRepository')
    await new ClothingItemRepository(pool).updateAiAnalysis(item.id, {
      sema: 'giyim',
      gardirop_kategorisi: 'Üst',
      veri: { alt_kategori: 'Tişört', renk: 'Siyah', uyumluluk: {}, genel_aciklama: 'Test' },
    })

    const { status: readStatus, data: after } = await call('GET', `/clothing-items/${item.id}`, {
      baseUrl: brokenBase,
      token: auth.token,
    })
    check('Kıyafet okunabiliyor', readStatus === 200)
    check('Kayıt yerinde (Chroma yokken de)', after?.name === item.name)
    check('Analiz kolonu etkilenmemiş', after?.ai_analysis !== null)

    // /similar bu durumda SESSİZ KALMAMALI: kullanıcı bir cevap bekliyor.
    const { status: similarStatus, data: similar } = await call(
      'GET',
      `/clothing-items/${item.id}/similar`,
      { baseUrl: brokenBase, token: auth.token },
    )
    check(
      'Benzer araması 503 ile açıkça bildiriyor (boş liste DEĞİL)',
      similarStatus === 503 && isNonEmptyString(similar?.error),
      `${similarStatus} ${similar?.error ?? ''}`,
    )

    const { status: healthStatus } = await call('GET', '/health', { baseUrl: brokenBase })
    check('Sunucu hâlâ ayakta', healthStatus === 200)
    check('Süreç çökmedi', child.exitCode === null)

    await call('DELETE', `/users/${auth.user.id}`, { baseUrl: brokenBase, token: auth.token })
  } finally {
    child.kill()
    await sleep(300)
  }
}

async function ozet(sonuc) {
  if (sonuc && CLEANUP) {
    const VectorService = require('../src/services/VectorService')
    const VectorRepository = require('../src/repositories/VectorRepository')
    const ClothingItemRepository = require('../src/repositories/ClothingItemRepository')
    const pool = require('../src/config/database')
    const GeminiService = require('../src/services/GeminiService')
    const service = new VectorService(
      new VectorRepository(),
      new ClothingItemRepository(pool),
      new GeminiService(),
    )
    for (const id of Object.values(sonuc.idler)) await service.removeItem(id)
    await call('DELETE', `/users/${sonuc.userId}`, { token: sonuc.token })
    console.log('\nTest verisi silindi (--cleanup).')
  } else if (sonuc) {
    const { getCollectionName } = require('../src/config/chroma')
    console.log('\n─────────────────────────────────────────────')
    console.log('Test verisi BIRAKILDI (gözle doğrulama için):')
    console.log(`  kullanıcı  : ${sonuc.email}`)
    console.log(`  koleksiyon : ${getCollectionName()}`)
    console.log('\n  Vektör sayısı:')
    console.log("    node -e \"const R=require('./src/repositories/VectorRepository');new R().count().then(console.log)\"")
    console.log('\n  Silmek için: node test-scripts/test-vector.js --cleanup')
    console.log('─────────────────────────────────────────────')
  }

  console.log(`\nSonuç: ${passed} başarılı, ${failed} başarısız`)
  process.exit(failed > 0 ? 1 : 0)
}

async function main() {
  console.log(`Hedef: ${BASE_URL}\n`)

  await birimTestleri()

  if (ONLY_UNIT) {
    console.log('(--birim) Chroma ve HTTP bölümleri atlandı.')
    return ozet(null)
  }

  let sunucuVar = false
  try {
    const { status } = await call('GET', '/health')
    sunucuVar = status === 200 || status === 503
  } catch {
    sunucuVar = false
  }

  if (!sunucuVar) {
    console.log(`\n! Sunucu ${BASE_URL} adresinde yanıt vermiyor — HTTP bölümleri atlanıyor.`)
    console.log('  Başlatmak için: backend/ içinde npm run dev')
    return ozet(null)
  }

  const chromaVar = await chromaBaglantiTesti()
  if (!chromaVar) {
    console.log('\n! ChromaDB yanıt vermiyor — kalan bölümler atlanıyor.')
    console.log('  Başlatmak için: docker compose up -d')
    return ozet(null)
  }

  const sonuc = await benzerlikTesti()
  await chromasizSunucuTesti()
  await ozet(sonuc)
}

main().catch((error) => {
  console.error('\nTest çalıştırılamadı:', error.message)
  process.exit(1)
})
