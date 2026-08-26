// Gemini entegrasyonu — AŞAMA 2: otomatik kıyafet analizi testleri.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-ai-analysis.js
//   node test-scripts/test-ai-analysis.js --cleanup     (test verisini sonda siler)
//
// VARSAYILAN OLARAK TEST VERİSİ SİLİNMEZ: ai_analysis kolonunun gerçekten
// dolduğu DBeaver'da gözle doğrulanabilsin diye. Script sonda, çalıştırılacak
// SQL'i ve oluşturulan kayıtların id'lerini yazdırır. Temizlik için --cleanup.
//
// BÖLÜM 1 (birim) GEÇERLİ ANAHTAR VE ÇALIŞAN SUNUCU GEREKTİRMEZ: sahte
// repository/servislerle çalışır ve asıl güvence buradadır — Gemini çökse de
// kıyafet akışının kırılmaması.
// BÖLÜM 2 gerçekten İKİNCİ BİR SUNUCU açar (geçersiz anahtarla) ve kıyafet
// eklemenin hâlâ çalıştığını uçtan uca kanıtlar.
// BÖLÜM 3 gerçek anahtar + KULLANILABİLİR KOTA ister; 3 farklı kategoriden gerçek
// fotoğrafla otomatik analizi doğrular.

const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
const SERVER_FILE = path.join(__dirname, '..', 'server.js')

// Geçersiz anahtarla açılacak ikinci sunucunun portu; asıl sunucuyla çakışmasın.
const BROKEN_PORT = 3199
const CLEANUP = process.argv.includes('--cleanup')
// Yalnızca birim bölümü: sunucu, anahtar ve Gemini kotası harcamadan
// saniyeler içinde koşar. Asıl güvence (Gemini çökse de akış kırılmasın)
// zaten bu bölümdedir.
const ONLY_UNIT = process.argv.includes('--birim')
// Gemini'nin ÜCRETSİZ katmanı günde 20 istekle sınırlıdır (ölçüldü:
// GenerateRequestsPerDayPerProjectPerModel-FreeTier, limit 20). Kota
// dolduğunda gerçek analiz bölümü ister istemez kırmızı yanar; bu bayrak
// o bölümü atlar, hata yolları (Bölüm 4) yine de koşar.
const SKIP_REAL = process.argv.includes('--kotasiz')

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

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

async function uploadPhoto(itemId, imagePath, token, baseUrl = BASE_URL) {
  const buffer = fs.readFileSync(imagePath)
  const mime = MIME_BY_EXT[path.extname(imagePath).toLowerCase()] || 'image/png'

  const form = new FormData()
  form.append('image', new Blob([buffer], { type: mime }), path.basename(imagePath))

  const response = await fetch(
    `${baseUrl}/clothing-items/${encodeURIComponent(itemId)}/image`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
  )
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: response.status, data }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Analiz ARKA PLANDA çalışır: yükleme yanıtı geldiğinde henüz bitmemiştir.
// Frontend de aynı şeyi yapar (ClothingDetail yoklaması).
// timeoutMs, en kötü senaryoyu kapsar: 2 deneme x 30 sn zaman aşımı + bekleme.
async function waitForAnalysis(itemId, token, { timeoutMs = 90000 } = {}) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const { data } = await call('GET', `/clothing-items/${itemId}`, { token })
    if (data?.ai_analysis) return data.ai_analysis
    await sleep(2000)
  }
  return null
}

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

// ---- Sahte katmanlar (Bölüm 1) ----
// Gerçek veritabanı ve gerçek Gemini olmadan servisin davranışını sürer.

function createFakeRepository(item) {
  return {
    item,
    yazmaSayisi: 0,
    async findById() {
      return this.item
    },
    async updateAiAnalysis(id, analysis) {
      this.yazmaSayisi += 1
      this.item = { ...this.item, ai_analysis: analysis }
      return this.item
    },
  }
}

const fakeCategoryRepository = {
  async findById(id) {
    return { id, name: 'Üst' }
  },
}

function createFakeGemini(behaviour) {
  return {
    cagriSayisi: 0,
    esZamanli: 0,
    enYuksekEsZamanli: 0,
    schemaKeyForCategory: () => 'giyim',
    async analyzeClothingItem() {
      this.cagriSayisi += 1
      this.esZamanli += 1
      this.enYuksekEsZamanli = Math.max(this.enYuksekEsZamanli, this.esZamanli)
      try {
        return await behaviour()
      } finally {
        this.esZamanli -= 1
      }
    },
  }
}

const ORNEK_ANALIZ = {
  sema: 'giyim',
  model: 'sahte-model',
  analiz_tarihi: new Date().toISOString(),
  gardirop_kategorisi: 'Üst',
  veri: { stil: 'Günlük', uyumluluk: {}, genel_aciklama: 'Test' },
}

function fotografliParca(extra = {}) {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    user_id: 'user-1',
    category_id: 1,
    image_url: '/uploads/test.png',
    ai_analysis: null,
    is_deleted: false,
    ...extra,
  }
}

// Bölüm 1'de gerçek dosya okunur; geçici bir görsel yazıp sonda siliyoruz.
const SAHTE_DOSYA = path.join(UPLOAD_DIR, 'test.png')

async function birimTestleri() {
  console.log('1) GeminiService — kategoriye göre prompt üretimi')

  const GeminiService = require('../src/services/GeminiService')
  const gemini = new GeminiService()

  check('Üst → giyim şeması', gemini.schemaKeyForCategory('Üst') === 'giyim')
  check('Ayakkabı → ayakkabi şeması', gemini.schemaKeyForCategory('Ayakkabı') === 'ayakkabi')
  check('Çanta → canta şeması', gemini.schemaKeyForCategory('Çanta') === 'canta')
  check('Makyaj → makyaj şeması', gemini.schemaKeyForCategory('Makyaj') === 'makyaj')
  check(
    'Dış Giyim → giyim şeması (ayrı bir şema gerekmiyor)',
    gemini.schemaKeyForCategory('Dış Giyim') === 'giyim',
  )
  check(
    'Tanınmayan kategori giyim şemasına düşer',
    gemini.schemaKeyForCategory('Şapka') === 'giyim',
  )
  check('Kategorisiz de patlamaz', gemini.schemaKeyForCategory(null) === 'giyim')

  const ustPrompt = gemini.buildPromptForCategory('Üst')
  const ayakkabiPrompt = gemini.buildPromptForCategory('Ayakkabı')
  const cantaPrompt = gemini.buildPromptForCategory('Çanta')
  const makyajPrompt = gemini.buildPromptForCategory('Makyaj')

  const giyimAlanlari = [
    'kategori',
    'alt_kategori',
    'renk',
    'ikincil_renkler',
    'kumas_deseni',
    'stil',
    'mevsim_uygunlugu',
    'kesim_tipi',
    'uyumluluk',
    'vucut_tipi',
    'ten_tonu',
    'uyumlu_parca_turleri',
    'uyumsuz_kombinasyonlar',
    'genel_aciklama',
  ]
  check(
    'Giyim prompt\'u onaylanmış şemanın TÜM alanlarını içerir',
    giyimAlanlari.every((key) => ustPrompt.includes(`"${key}"`)),
    `${giyimAlanlari.length} alan`,
  )

  check(
    'Ayakkabı prompt\'u giyim şemasına topuk_yuksekligi + ayakkabi_turu EKLER',
    ayakkabiPrompt.includes('"topuk_yuksekligi"') &&
      ayakkabiPrompt.includes('"ayakkabi_turu"') &&
      giyimAlanlari.every((key) => ayakkabiPrompt.includes(`"${key}"`)),
  )
  check(
    'Çanta prompt\'u giyim şemasına boyut + canta_turu EKLER',
    cantaPrompt.includes('"boyut"') &&
      cantaPrompt.includes('"canta_turu"') &&
      giyimAlanlari.every((key) => cantaPrompt.includes(`"${key}"`)),
  )
  check(
    'Makyaj prompt\'u AYRI şema: urun_turu/urun_adi/bitis_efekti + goz_rengi',
    ['urun_turu', 'renk', 'urun_adi', 'bitis_efekti', 'ten_tonu', 'goz_rengi'].every((key) =>
      makyajPrompt.includes(`"${key}"`),
    ),
  )
  check(
    'Makyaj prompt\'unda giyime özgü alanlar YOK',
    !makyajPrompt.includes('"kesim_tipi"') &&
      !makyajPrompt.includes('"kumas_deseni"') &&
      !makyajPrompt.includes('"vucut_tipi"'),
  )
  check('Prompt kategori adını taşır', ayakkabiPrompt.includes('"Ayakkabı"'))
  check('Prompt Türkçe cevap ister', ustPrompt.includes('TÜRKÇE'))
  check('Prompt uydurmayı yasaklar', ustPrompt.includes('UYDURMA'))

  console.log('\n2) ClothingAnalysisService — Gemini çöktüğünde akış korunur')

  const ClothingAnalysisService = require('../src/services/ClothingAnalysisService')
  const { DURUM, MAX_CONCURRENT } = ClothingAnalysisService

  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  fs.writeFileSync(SAHTE_DOSYA, Buffer.from('sahte-gorsel'))

  const gercekAnahtar = process.env.GEMINI_API_KEY
  process.env.GEMINI_API_KEY = 'test-anahtari'

  // KRİTİK: Gemini fırlatınca servis FIRLATMAMALI ve kolona yazmamalı.
  {
    const repo = createFakeRepository(fotografliParca())
    const patlayanGemini = createFakeGemini(() => {
      throw new Error('Gemini servisine şu anda ulaşılamıyor')
    })
    const service = new ClothingAnalysisService(repo, fakeCategoryRepository, patlayanGemini)

    let firlattiMi = false
    let sonuc
    try {
      sonuc = await service.analyzeItem(fotografliParca().id)
    } catch {
      firlattiMi = true
    }

    check('Gemini hata verince servis FIRLATMAZ', !firlattiMi)
    check('Sonuç "basarisiz" olarak bildirilir', sonuc?.durum === DURUM.BASARISIZ, sonuc?.sebep)
    check('Hata durumunda ai_analysis YAZILMAZ', repo.yazmaSayisi === 0)
    check('Kayıt bozulmaz, ai_analysis null kalır', repo.item.ai_analysis === null)
  }

  // Zaman aşımı da aynı yoldan geçer.
  {
    const repo = createFakeRepository(fotografliParca())
    const zamanAsimi = createFakeGemini(() => {
      const error = new Error('Gemini yanıt vermedi (zaman aşımı).')
      error.name = 'TimeoutError'
      throw error
    })
    const service = new ClothingAnalysisService(repo, fakeCategoryRepository, zamanAsimi)
    const sonuc = await service.analyzeItem(fotografliParca().id)

    check('Zaman aşımında da fırlatmaz', sonuc.durum === DURUM.BASARISIZ)
    check('Zaman aşımında kolon boş kalır', repo.item.ai_analysis === null)
  }

  // Kota aşımı: soğuma süresi başlar, arkasından gelen istek Gemini'ye GİTMEZ.
  {
    const repo = createFakeRepository(fotografliParca())
    const kotaGemini = createFakeGemini(() => {
      const error = new Error('Gemini kullanım kotası doldu.')
      error.isRateLimited = true
      throw error
    })
    const service = new ClothingAnalysisService(repo, fakeCategoryRepository, kotaGemini)

    const ilk = await service.analyzeItem(fotografliParca().id)
    check('Kota hatasında sistem ayakta', ilk.durum === DURUM.BASARISIZ && ilk.sebep === 'kota')

    const ikinci = await service.analyzeItem(fotografliParca().id)
    check(
      'Kota sonrası SOĞUMA: yeni analiz Gemini\'ye hiç gitmez',
      ikinci.durum === DURUM.ATLANDI && kotaGemini.cagriSayisi === 1,
      ikinci.sebep,
    )
  }

  // Maliyet koruması: analiz zaten varsa yeniden analiz edilmez.
  {
    const repo = createFakeRepository(fotografliParca({ ai_analysis: ORNEK_ANALIZ }))
    const gemini2 = createFakeGemini(async () => ORNEK_ANALIZ)
    const service = new ClothingAnalysisService(repo, fakeCategoryRepository, gemini2)

    const sonuc = await service.analyzeItem(fotografliParca().id)
    check(
      'MALİYET: dolu ai_analysis tekrar analiz EDİLMEZ',
      sonuc.durum === DURUM.ATLANDI &&
        sonuc.sebep === 'zaten-analiz-edilmis' &&
        gemini2.cagriSayisi === 0,
    )

    const zorla = await service.analyzeItem(fotografliParca().id, { force: true })
    check(
      'force ile yeniden analiz mümkün ("Yeniden Analiz Et" düğmesi bu yoldan geçer)',
      zorla.durum === DURUM.TAMAMLANDI && gemini2.cagriSayisi === 1,
    )
  }

  // YENİDEN ANALİZ — embedding de tazelenmeli.
  //
  // ai_analysis üzerine yazıldığında ondan TÜREYEN embedding de bayatlar.
  // force aktarılmasaydı VectorService'in maliyet koruması ("zaten
  // indekslenmiş") devreye girer ve parça, artık geçersiz olan eski
  // vektörüyle kalırdı — Kombin Öner ve "Buna Benzer Diğer Parçalar" bayat
  // veriyle çalışmaya devam ederdi.
  {
    const indekslemeler = []
    const sahteVektor = {
      indexItemInBackground(itemId, options) {
        indekslemeler.push({ itemId, options })
        return Promise.resolve({ durum: 'tamamlandi' })
      },
    }

    const ilk = new ClothingAnalysisService(
      createFakeRepository(fotografliParca()),
      fakeCategoryRepository,
      createFakeGemini(async () => ORNEK_ANALIZ),
      sahteVektor,
    )
    await ilk.analyzeItem(fotografliParca().id)
    check(
      'Normal analizde embedding force SUZ isteniyor',
      indekslemeler.length === 1 && indekslemeler[0].options?.force === false,
      JSON.stringify(indekslemeler[0]?.options),
    )

    const tekrar = new ClothingAnalysisService(
      createFakeRepository(fotografliParca({ ai_analysis: ORNEK_ANALIZ })),
      fakeCategoryRepository,
      createFakeGemini(async () => ORNEK_ANALIZ),
      sahteVektor,
    )
    await tekrar.analyzeItem(fotografliParca().id, { force: true })
    check(
      'YENİDEN analizde embedding de FORCE ile yenileniyor (bayat vektör kalmaz)',
      indekslemeler.length === 2 && indekslemeler[1].options?.force === true,
      JSON.stringify(indekslemeler[1]?.options),
    )
  }

  // HATA HÂLİNDE MEVCUT ANALİZ KORUNUR — "Yeniden Analiz Et" sözleşmesinin
  // en kritik parçası: kullanıcı düğmeye bastı, Gemini düştü, ekrandaki
  // veri kaybolmamalı.
  {
    const mevcut = { ...ORNEK_ANALIZ, analiz_tarihi: '2020-01-01T00:00:00.000Z' }
    const repo = createFakeRepository(fotografliParca({ ai_analysis: mevcut }))
    const patlayanGemini = createFakeGemini(async () => {
      throw Object.assign(new Error('Gemini yanıt vermedi'), { isRetryable: false })
    })
    const service = new ClothingAnalysisService(repo, fakeCategoryRepository, patlayanGemini)

    const sonuc = await service.analyzeItem(fotografliParca().id, { force: true })
    check('Yeniden analiz başarısız olduğunda durum "basarisiz"', sonuc.durum === DURUM.BASARISIZ)
    check('Kolona HİÇ YAZILMADI (yarım veri yok)', repo.yazmaSayisi === 0)
    check(
      'ESKİ ANALİZ AYNEN YERİNDE',
      repo.item.ai_analysis?.analiz_tarihi === '2020-01-01T00:00:00.000Z',
      repo.item.ai_analysis?.analiz_tarihi,
    )

    // Kota hatası da aynı: eski veri silinmez.
    const kotaRepo = createFakeRepository(fotografliParca({ ai_analysis: mevcut }))
    const kotaService = new ClothingAnalysisService(
      kotaRepo,
      fakeCategoryRepository,
      createFakeGemini(async () => {
        throw Object.assign(new Error('kota doldu'), { isRateLimited: true })
      }),
    )
    const kotaSonuc = await kotaService.analyzeItem(fotografliParca().id, { force: true })
    check(
      'Kota hatasında da eski analiz korunuyor',
      kotaSonuc.sebep === 'kota' && kotaRepo.yazmaSayisi === 0 && kotaRepo.item.ai_analysis !== null,
    )
  }

  // ÇİFT TIKLAMA — aynı parça için ikinci istek Gemini'ye GİTMEZ.
  {
    let cozumle
    const bekleyen = new Promise((resolve) => { cozumle = resolve })
    const gemini = createFakeGemini(async () => { await bekleyen; return ORNEK_ANALIZ })
    const service = new ClothingAnalysisService(
      createFakeRepository(fotografliParca({ ai_analysis: ORNEK_ANALIZ })),
      fakeCategoryRepository,
      gemini,
    )

    const birinci = service.analyzeItem(fotografliParca().id, { force: true })
    // İlk çağrı Gemini'de asılıyken ikinci istek gelir (çift tıklama).
    const ikinci = await service.analyzeItem(fotografliParca().id, { force: true })
    check(
      'MALİYET: eszamanli ikinci yeniden analiz Gemini API cagrisi YAPMAZ',
      ikinci.durum === DURUM.ATLANDI && ikinci.sebep === 'zaten-analiz-ediliyor',
      ikinci.sebep,
    )
    cozumle()
    await birinci
    check('Tek Gemini çağrısı yapıldı', gemini.cagriSayisi === 1, `${gemini.cagriSayisi} çağrı`)
  }

  // Fotoğrafsız / kaydı olmayan / dosyası silinmiş parçalar.
  {
    const gemini3 = createFakeGemini(async () => ORNEK_ANALIZ)

    const fotografsiz = new ClothingAnalysisService(
      createFakeRepository(fotografliParca({ image_url: null })),
      fakeCategoryRepository,
      gemini3,
    )
    check(
      'Fotoğrafsız parça atlanır',
      (await fotografsiz.analyzeItem('x')).sebep === 'fotograf-yok',
    )

    const yok = new ClothingAnalysisService(
      createFakeRepository(null),
      fakeCategoryRepository,
      gemini3,
    )
    check('Kaydı olmayan id atlanır', (await yok.analyzeItem('x')).sebep === 'kayit-yok')

    const eksikDosya = new ClothingAnalysisService(
      createFakeRepository(fotografliParca({ image_url: '/uploads/olmayan-dosya.png' })),
      fakeCategoryRepository,
      gemini3,
    )
    check(
      'Diskte olmayan dosya atlanır (çökmez)',
      (await eksikDosya.analyzeItem('x')).sebep === 'dosya-diskte-yok',
    )

    check('Bu yolların hiçbiri Gemini\'ye gitmez', gemini3.cagriSayisi === 0)
  }

  // Veritabanı yazma hatası da yutulur.
  {
    const repo = createFakeRepository(fotografliParca())
    repo.updateAiAnalysis = async () => {
      throw new Error('veritabanı düştü')
    }
    const service = new ClothingAnalysisService(
      repo,
      fakeCategoryRepository,
      createFakeGemini(async () => ORNEK_ANALIZ),
    )
    const sonuc = await service.analyzeItem('x')
    check(
      'Yazma hatası fırlatmaz, "basarisiz" döner',
      sonuc.durum === DURUM.BASARISIZ && sonuc.sebep === 'yazma-hatasi',
    )
  }

  // Kategori okunamasa bile analiz devam eder (giyim şemasına düşer).
  {
    const repo = createFakeRepository(fotografliParca())
    const gemini4 = createFakeGemini(async () => ORNEK_ANALIZ)
    const service = new ClothingAnalysisService(
      repo,
      {
        async findById() {
          throw new Error('kategori tablosu okunamadı')
        },
      },
      gemini4,
    )
    const sonuc = await service.analyzeItem('x')
    check(
      'Kategori okunamazsa analiz yine de yapılır',
      sonuc.durum === DURUM.TAMAMLANDI && gemini4.cagriSayisi === 1,
    )
  }

  console.log('\n3) ClothingAnalysisService — maliyet ve eşzamanlılık koruması')

  // Aynı parça için eşzamanlı iki tetikleme tek çağrıya iner.
  {
    const repo = createFakeRepository(fotografliParca())
    const yavas = createFakeGemini(async () => {
      await sleep(150)
      return ORNEK_ANALIZ
    })
    const service = new ClothingAnalysisService(repo, fakeCategoryRepository, yavas)

    const [a, b] = await Promise.all([service.analyzeItem('x'), service.analyzeItem('x')])
    check(
      'Aynı parçaya eşzamanlı iki tetikleme → tek Gemini çağrısı',
      yavas.cagriSayisi === 1 &&
        [a.durum, b.durum].includes(DURUM.ATLANDI) &&
        [a.durum, b.durum].includes(DURUM.TAMAMLANDI),
    )
  }

  // Toplu yüklemede eşzamanlılık sınırı aşılmaz.
  {
    const gemini5 = createFakeGemini(async () => {
      await sleep(80)
      return ORNEK_ANALIZ
    })
    const service = new ClothingAnalysisService(
      { async findById(id) { return fotografliParca({ id }) }, async updateAiAnalysis() { return {} } },
      fakeCategoryRepository,
      gemini5,
    )

    await Promise.all(['a', 'b', 'c', 'd', 'e'].map((id) => service.analyzeItem(id)))
    check(
      `Eşzamanlı Gemini çağrısı ${MAX_CONCURRENT} ile sınırlı`,
      gemini5.enYuksekEsZamanli <= MAX_CONCURRENT,
      `en yüksek: ${gemini5.enYuksekEsZamanli}, toplam: ${gemini5.cagriSayisi}`,
    )
    check('Sınırlamaya rağmen hepsi işlenir', gemini5.cagriSayisi === 5)
  }

  // GEÇİCİ hata yeniden denenir; kalıcı hata denenmez.
  {
    const repo = createFakeRepository(fotografliParca())
    let cagri = 0
    const gecici = createFakeGemini(async () => {
      cagri += 1
      if (cagri === 1) {
        const error = new Error('Gemini yanıt vermedi (zaman aşımı).')
        error.isRetryable = true
        throw error
      }
      return ORNEK_ANALIZ
    })
    const service = new ClothingAnalysisService(repo, fakeCategoryRepository, gecici)
    const sonuc = await service.analyzeItem('x')

    check(
      'GEÇİCİ hata (zaman aşımı) yeniden deneniyor ve başarıya ulaşıyor',
      sonuc.durum === DURUM.TAMAMLANDI && cagri === 2,
      `${cagri} deneme`,
    )
  }

  {
    const kalici = createFakeGemini(async () => {
      const error = new Error('Gemini API anahtarı geçersiz.')
      error.isRetryable = false
      throw error
    })
    const service = new ClothingAnalysisService(
      createFakeRepository(fotografliParca()),
      fakeCategoryRepository,
      kalici,
    )
    const sonuc = await service.analyzeItem('x')
    check(
      'KALICI hata (geçersiz anahtar) yeniden DENENMEZ',
      sonuc.durum === DURUM.BASARISIZ && kalici.cagriSayisi === 1,
      `${kalici.cagriSayisi} deneme`,
    )
  }

  {
    const kotali = createFakeGemini(async () => {
      const error = new Error('Gemini kullanım kotası doldu.')
      error.isRateLimited = true
      error.isRetryable = false
      throw error
    })
    const service = new ClothingAnalysisService(
      createFakeRepository(fotografliParca()),
      fakeCategoryRepository,
      kotali,
    )
    await service.analyzeItem('x')
    check('KOTA hatasında da yeniden denenmez', kotali.cagriSayisi === 1)
  }

  {
    const surekliGecici = createFakeGemini(async () => {
      const error = new Error('Gemini yanıt vermedi (zaman aşımı).')
      error.isRetryable = true
      throw error
    })
    const service = new ClothingAnalysisService(
      createFakeRepository(fotografliParca()),
      fakeCategoryRepository,
      surekliGecici,
    )
    const sonuc = await service.analyzeItem('x')
    check(
      `Yeniden deneme ${ClothingAnalysisService.MAX_ATTEMPTS} ile SINIRLI (sonsuz döngü yok)`,
      sonuc.durum === DURUM.BASARISIZ &&
        surekliGecici.cagriSayisi === ClothingAnalysisService.MAX_ATTEMPTS,
      `${surekliGecici.cagriSayisi} deneme`,
    )
  }

  // Kota hatası bir bekleme süresi bildiriyorsa ona uyulur.
  {
    const uzunBekleme = createFakeGemini(async () => {
      const error = new Error('Gemini kullanım kotası doldu.')
      error.isRateLimited = true
      error.retryAfterMs = 5 * 60 * 1000
      throw error
    })
    const service = new ClothingAnalysisService(
      createFakeRepository(fotografliParca()),
      fakeCategoryRepository,
      uzunBekleme,
    )
    const oncesi = Date.now()
    await service.analyzeItem('x')

    check(
      'Gemini daha uzun bekleme istediyse soğuma ona göre uzatılır',
      service.cooldownUntil - oncesi > ClothingAnalysisService.RATE_LIMIT_COOLDOWN_MS,
      `${Math.round((service.cooldownUntil - oncesi) / 1000)} sn`,
    )
  }

  // Anahtar yoksa dış servise HİÇ gidilmez.
  {
    delete process.env.GEMINI_API_KEY
    const gemini6 = createFakeGemini(async () => ORNEK_ANALIZ)
    const service = new ClothingAnalysisService(
      createFakeRepository(fotografliParca()),
      fakeCategoryRepository,
      gemini6,
    )
    const sonuc = await service.analyzeItem('x')
    check(
      'Anahtar yokken atlanır, dış servise gidilmez',
      sonuc.durum === DURUM.ATLANDI && sonuc.sebep === 'anahtar-yok' && gemini6.cagriSayisi === 0,
    )
  }

  // analyzeItemInBackground fırlatan bir servisi bile yutar (son güvenlik ağı).
  {
    process.env.GEMINI_API_KEY = 'test-anahtari'
    const service = new ClothingAnalysisService(
      {
        async findById() {
          throw new Error('beklenmeyen')
        },
      },
      fakeCategoryRepository,
      createFakeGemini(async () => ORNEK_ANALIZ),
    )
    const sonuc = await service.analyzeItemInBackground('x')
    check('analyzeItemInBackground asla reject etmez', sonuc.durum === DURUM.BASARISIZ)
  }

  if (gercekAnahtar === undefined) delete process.env.GEMINI_API_KEY
  else process.env.GEMINI_API_KEY = gercekAnahtar

  fs.rmSync(SAHTE_DOSYA, { force: true })
}

// ---- BÖLÜM 2: Gemini erişilemezken kıyafet ekleme (uçtan uca) ----
// Gerçekten ikinci bir sunucu açar; GEMINI_API_KEY geçersizdir, yani
// analiz her seferinde başarısız olur. Kıyafet akışı bundan etkilenmemeli.
async function geminisizSunucuTesti(imagePath) {
  console.log('\n4) KRİTİK — Gemini erişilemezken kıyafet ekleme (ayrı sunucu)')

  const brokenBase = `http://localhost:${BROKEN_PORT}/api`
  const child = spawn(process.execPath, [SERVER_FILE], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(BROKEN_PORT),
      // Biçimi doğru ama GEÇERSİZ anahtar: istemci kurulur, çağrı 400 ile
      // reddedilir. "Anahtar yok" yolundan farklı bir senaryo.
      GEMINI_API_KEY: 'AIzaSyGECERSIZ-TEST-ANAHTARI-000000000000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const sunucuLoglari = []
  child.stdout.on('data', (chunk) => sunucuLoglari.push(String(chunk)))
  child.stderr.on('data', (chunk) => sunucuLoglari.push(String(chunk)))

  try {
    // Sunucunun ayağa kalkmasını bekle.
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
    check('Geçersiz Gemini anahtarıyla sunucu AÇILIYOR (patlamıyor)', hazir)
    if (!hazir) return

    const email = `ai-kirik-${Date.now()}@example.com`
    const { data: auth } = await call('POST', '/auth/register', {
      baseUrl: brokenBase,
      body: { name: 'AI Kırık Test', email, password: 'test1234', age: 25 },
    })
    const token = auth?.token
    check('Kayıt olunabiliyor', isNonEmptyString(token))
    if (!token) return

    const { status: createStatus, data: item } = await call('POST', '/clothing-items', {
      baseUrl: brokenBase,
      token,
      body: { categoryId: 1, name: 'Gemini yokken eklenen parça', color: 'Siyah' },
    })
    check('Kıyafet eklenebiliyor (201)', createStatus === 201, `durum: ${createStatus}`)

    const { status: uploadStatus, data: uploaded } = await uploadPhoto(
      item.id,
      imagePath,
      token,
      brokenBase,
    )
    check('Fotoğraf yüklenebiliyor (200)', uploadStatus === 200, `durum: ${uploadStatus}`)
    check('Yanıt kıyafeti döndürüyor', uploaded?.id === item.id)
    check('Yanıtta ai_analysis null', uploaded?.ai_analysis === null)

    // Analiz arka planda denenip başarısız olacak; sunucu ayakta kalmalı.
    await sleep(6000)

    const { status: healthStatus } = await call('GET', '/health', { baseUrl: brokenBase })
    check('Başarısız analizden SONRA sunucu hâlâ ayakta', healthStatus === 200)
    check('Süreç çökmedi', child.exitCode === null)

    const { status: getStatus, data: after } = await call('GET', `/clothing-items/${item.id}`, {
      baseUrl: brokenBase,
      token,
    })
    check('Kıyafet okunabiliyor', getStatus === 200)
    check('Kıyafet kaydı yerinde (analiz başarısız olsa da)', after?.name === item.name)
    check('ai_analysis NULL kaldı (yarım/bozuk veri yazılmadı)', after?.ai_analysis === null)
    check('Fotoğraf kaydı duruyor', isNonEmptyString(after?.image_url))

    // --- YENİDEN ANALİZ, GEMİNİ ERİŞİLEMEZKEN ---
    // Asıl güvence: kullanıcı düğmeye bastı, Gemini düştü, EKRANDAKİ VERİ
    // KAYBOLMAMALI. Önce kolona elle bir analiz yazıp "mevcut analiz" kuruyoruz.
    const ClothingItemRepository = require('../src/repositories/ClothingItemRepository')
    const pool = require('../src/config/database')
    const mevcutAnaliz = {
      sema: 'giyim',
      model: 'onceki-model',
      analiz_tarihi: '2020-01-01T00:00:00.000Z',
      gardirop_kategorisi: 'Üst',
      veri: { alt_kategori: 'Tişört', renk: 'Siyah', uyumluluk: {}, genel_aciklama: 'Eski analiz' },
    }
    await new ClothingItemRepository(pool).updateAiAnalysis(item.id, mevcutAnaliz)

    const { status: yenidenStatus, data: yenidenData } = await call(
      'POST',
      `/clothing-items/${item.id}/analyze`,
      { baseUrl: brokenBase, token },
    )
    check(
      'Yeniden analiz Gemini erişilemezken 503 döndürüyor',
      yenidenStatus === 503 && isNonEmptyString(yenidenData?.error),
      `${yenidenStatus} ${yenidenData?.error ?? ''}`,
    )
    check(
      'Mesaj kullanıcıya gösterilebilir (ham sebep kodu SIZMIYOR)',
      !/gemini-hatasi|hazirlik-hatasi|yazma-hatasi|undefined/.test(yenidenData?.error ?? ''),
      yenidenData?.error,
    )

    const { data: yenidenSonrasi } = await call('GET', `/clothing-items/${item.id}`, {
      baseUrl: brokenBase,
      token,
    })
    check(
      'ESKİ ANALİZ KORUNDU (üzerine yazılmadı, silinmedi)',
      yenidenSonrasi?.ai_analysis?.analiz_tarihi === '2020-01-01T00:00:00.000Z' &&
        yenidenSonrasi?.ai_analysis?.model === 'onceki-model',
      yenidenSonrasi?.ai_analysis?.analiz_tarihi,
    )
    check(
      'Başarısız yeniden analizden sonra sunucu hâlâ ayakta',
      (await call('GET', '/health', { baseUrl: brokenBase })).status === 200 &&
        child.exitCode === null,
    )

    // Sahiplik: başka bir kullanıcı bu parçayı yeniden analiz EDEMEZ.
    const { data: digerAuth } = await call('POST', '/auth/register', {
      baseUrl: brokenBase,
      body: {
        name: 'AI Kırık Diger',
        email: `ai-kirik-diger-${Date.now()}@example.com`,
        password: 'test1234',
        age: 25,
      },
    })
    const { status: yabanci } = await call('POST', `/clothing-items/${item.id}/analyze`, {
      baseUrl: brokenBase,
      token: digerAuth.token,
    })
    check('Başkasının parçası yeniden analiz edilemiyor (404)', yabanci === 404, `${yabanci}`)
    const { status: tokensizYeniden } = await call(
      'POST',
      `/clothing-items/${item.id}/analyze`,
      { baseUrl: brokenBase },
    )
    check('Token olmadan 401', tokensizYeniden === 401)
    await call('DELETE', `/users/${digerAuth.user.id}`, {
      baseUrl: brokenBase,
      token: digerAuth.token,
    })

    const loglar = sunucuLoglari.join('')
    check(
      'Hata sessizce LOGLANDI (kullanıcıya yansımadı)',
      /AI analizi başarısız/.test(loglar),
      loglar.match(/AI analizi başarısız[^\n]*/)?.[0]?.slice(0, 90) ?? 'log bulunamadı',
    )

    // Temizlik: bu kullanıcı ayrı sunucuda ama AYNI veritabanında.
    await call('DELETE', `/users/${auth.user.id}`, { baseUrl: brokenBase, token })
  } finally {
    child.kill()
    await sleep(300)
  }
}

// ---- BÖLÜM 3: Gerçek fotoğraflarla otomatik analiz ----
async function gercekAnalizTesti(fotograflar) {
  console.log('\n5) Gerçek fotoğraflarla otomatik analiz (3 kategori)')

  const email = `ai-analiz-${Date.now()}@example.com`
  const { data: auth } = await call('POST', '/auth/register', {
    body: { name: 'AI Analiz Test', email, password: 'test1234', age: 27 },
  })
  const token = auth?.token
  if (!token) {
    check('Test kullanıcısı oluşturuldu', false, 'kayıt başarısız')
    return null
  }

  const { data: categories } = await call('GET', '/categories', { token })
  const categoryByName = new Map(categories.map((row) => [row.name, row.id]))

  const olusturulan = []

  for (const { kategori, dosya, ad, beklenenSema, zorunluAlanlar } of fotograflar) {
    console.log(`\n   — ${kategori} (${path.basename(dosya)})`)

    const { data: item } = await call('POST', '/clothing-items', {
      token,
      body: { categoryId: categoryByName.get(kategori), name: ad, color: 'Siyah' },
    })

    const { status: uploadStatus } = await uploadPhoto(item.id, dosya, token)
    check('Fotoğraf yüklendi', uploadStatus === 200)

    const analiz = await waitForAnalysis(item.id, token)
    olusturulan.push({ id: item.id, kategori, analiz: Boolean(analiz) })

    if (!analiz) {
      check(`${kategori}: otomatik analiz tamamlandı`, false, '90 sn içinde gelmedi')
      continue
    }

    check(`${kategori}: ai_analysis KOLONA YAZILDI`, true)
    check(
      'Üst düzey alanlar tam (sema/model/analiz_tarihi/gardirop_kategorisi/veri)',
      isNonEmptyString(analiz.sema) &&
        isNonEmptyString(analiz.model) &&
        isNonEmptyString(analiz.analiz_tarihi) &&
        analiz.gardirop_kategorisi === kategori &&
        analiz.veri !== null &&
        typeof analiz.veri === 'object',
    )
    check(`Şema kategoriye göre seçildi (${beklenenSema})`, analiz.sema === beklenenSema, analiz.sema)
    check(
      'Kategoriye ÖZGÜ alanlar şemada var',
      zorunluAlanlar.every((key) => key in analiz.veri),
      zorunluAlanlar.join(', '),
    )
    check(
      'uyumluluk bloğu dizilerden oluşuyor',
      analiz.veri.uyumluluk !== undefined &&
        Object.values(analiz.veri.uyumluluk).every((value) => Array.isArray(value)),
    )

    const doluAlanlar = Object.entries(analiz.veri).filter(
      ([key, value]) =>
        key !== 'uyumluluk' && (Array.isArray(value) ? value.length > 0 : Boolean(value)),
    )
    check('Model alanların çoğunu doldurdu', doluAlanlar.length >= 4, `${doluAlanlar.length} dolu alan`)

    const metinAlanlari = doluAlanlar
      .filter(([key, value]) => key !== 'genel_aciklama' && typeof value === 'string')
      .map(([, value]) => value)
    check(
      'Metin alanları PARAGRAF değil kısa etiket',
      metinAlanlari.every((value) => value.length <= 120 && !value.includes('. ')),
      metinAlanlari.slice(0, 3).join(' | '),
    )
    check(
      'Listeler 4 öğeyi aşmıyor',
      Object.values(analiz.veri)
        .concat(Object.values(analiz.veri.uyumluluk ?? {}))
        .filter(Array.isArray)
        .every((liste) => liste.length <= 4),
    )
    check(
      'genel_aciklama Türkçe ve dolu',
      isNonEmptyString(analiz.veri.genel_aciklama),
      analiz.veri.genel_aciklama?.slice(0, 70),
    )
    check('Ham JSON metni değil, ÇÖZÜLMÜŞ nesne saklanıyor', typeof analiz.veri === 'object')
    check(
      'Markdown çiti sızmamış',
      !JSON.stringify(analiz).includes('```'),
    )

    const ozet = Object.entries(analiz.veri)
      .filter(([key, value]) => key !== 'uyumluluk' && key !== 'genel_aciklama' && value)
      .slice(0, 4)
      .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join('/') : value}`)
      .join(', ')
    console.log(`     → ${ozet}`)
  }

  // MALİYET KORUMASI uçtan uca: aynı parçaya tekrar fotoğraf yüklemek
  // yeni bir Gemini çağrısı DOĞURMAMALI (analiz zaten var).
  const analizli = olusturulan.find((row) => row.analiz)
  if (analizli) {
    console.log('\n   — Maliyet koruması (aynı parça tekrar yüklenirse)')
    const { data: once } = await call('GET', `/clothing-items/${analizli.id}`, { token })
    await uploadPhoto(analizli.id, fotograflar[0].dosya, token)
    await sleep(8000)
    const { data: sonra } = await call('GET', `/clothing-items/${analizli.id}`, { token })

    check(
      'Tekrar yüklemede YENİDEN ANALİZ EDİLMEDİ (analiz_tarihi değişmedi)',
      sonra?.ai_analysis?.analiz_tarihi === once?.ai_analysis?.analiz_tarihi,
      sonra?.ai_analysis?.analiz_tarihi,
    )
  }

  return { userId: auth.user.id, email, token, olusturulan }
}

async function main() {
  console.log(`Hedef: ${BASE_URL}\n`)

  await birimTestleri()

  if (ONLY_UNIT) {
    console.log('(--birim) HTTP bölümleri atlandı.')
    return ozet(null)
  }

  // Gerçek fotoğraflar: uploads/ içindeki mevcut kullanıcı fotoğrafları.
  // 3 FARKLI KATEGORİ (üç ayrı şema yolu) bilinçli olarak seçildi.
  const FOTOGRAFLAR = [
    {
      kategori: 'Üst',
      dosya: path.join(UPLOAD_DIR, '67fe7f3e-471b-4544-9d91-2718e0c18a55.png'),
      ad: '[test] Üst parça',
      beklenenSema: 'giyim',
      zorunluAlanlar: ['alt_kategori', 'kumas_deseni', 'kesim_tipi'],
    },
    {
      kategori: 'Ayakkabı',
      dosya: path.join(UPLOAD_DIR, '96e6bc1e-a9a6-4de0-9a07-6f060a146848.png'),
      ad: '[test] Ayakkabı',
      beklenenSema: 'ayakkabi',
      zorunluAlanlar: ['topuk_yuksekligi', 'ayakkabi_turu'],
    },
    {
      kategori: 'Makyaj',
      dosya: path.join(UPLOAD_DIR, '39e5eb0d-becb-4985-a351-90cd79cba788.png'),
      ad: '[test] Makyaj ürünü',
      beklenenSema: 'makyaj',
      zorunluAlanlar: ['urun_turu', 'urun_adi', 'bitis_efekti'],
    },
  ]

  const eksik = FOTOGRAFLAR.filter((row) => !fs.existsSync(row.dosya))
  const yedek = fs
    .readdirSync(UPLOAD_DIR)
    .filter((name) => MIME_BY_EXT[path.extname(name).toLowerCase()])
    .map((name) => path.join(UPLOAD_DIR, name))[0]

  if (eksik.length > 0) {
    console.log(
      `\n! Beklenen test fotoğrafları bulunamadı (${eksik.length} adet). ` +
        'Bölüm 4-5 için uploads/ altında gerçek fotoğraf gerekir.',
    )
  }

  if (!yedek) {
    console.log('\n! uploads/ boş — HTTP bölümleri atlanıyor.')
    return ozet(null)
  }

  // Sunucu ayakta mı?
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

  await geminisizSunucuTesti(eksik.length ? yedek : FOTOGRAFLAR[0].dosya)

  if (eksik.length > 0) {
    console.log('\n! Gerçek analiz bölümü atlandı (test fotoğrafları eksik).')
    return ozet(null)
  }

  if (SKIP_REAL) {
    console.log('(--kotasiz) Gerçek analiz bölümü atlandı.')
    return ozet(null)
  }

  const sonuc = await gercekAnalizTesti(FOTOGRAFLAR)
  await ozet(sonuc)
}

async function ozet(sonuc) {
  if (sonuc && CLEANUP) {
    await call('DELETE', `/users/${sonuc.userId}`, { token: sonuc.token })
    console.log('\nTest verisi silindi (--cleanup).')
  } else if (sonuc) {
    console.log('\n─────────────────────────────────────────────')
    console.log('DBeaver ile gözle doğrulama — test verisi BIRAKILDI:')
    console.log(`  kullanıcı: ${sonuc.email}`)
    console.log('\n  SELECT ci.name, c.name AS kategori,')
    console.log('         ci.ai_analysis->>\'sema\'   AS sema,')
    console.log('         ci.ai_analysis->\'veri\'->>\'stil\' AS stil,')
    console.log('         jsonb_pretty(ci.ai_analysis) AS analiz')
    console.log('    FROM clothing_items ci')
    console.log('    JOIN categories c ON c.id = ci.category_id')
    console.log('   WHERE ci.ai_analysis IS NOT NULL')
    console.log('   ORDER BY ci.created_at DESC;')
    console.log('\n  Silmek için: node test-scripts/cleanup.js  (@example.com test hesaplari)')
    console.log('─────────────────────────────────────────────')
  }

  console.log(`\nSonuç: ${passed} başarılı, ${failed} başarısız`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('\nTest çalıştırılamadı:', error.message)
  process.exit(1)
})
