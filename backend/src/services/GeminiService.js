const { ValidationError, ServiceUnavailableError } = require('../utils/errors')
const {
  EMBEDDING_TASK_TYPE,
  REQUEST_TIMEOUT_MS,
  getClient,
  getEmbeddingModel,
  getModel,
  isConfigured,
} = require('../config/gemini')

// TEN TONU ANALİZİ — kullanıcının selfie'sinden ten tonu ve ona yakışan
// renkler. Kıyafet analizinden AYRI bir şema: girdi kıyafet değil insan.
//
// `yuz_tespit_edildi` alanı ŞEMANIN PARÇASI ve bilinçli: fotoğraf bulanıksa,
// yüz yoksa ya da ışık ten rengini okumaya elvermiyorsa modelin UYDURMASINI
// değil bunu SÖYLEMESİNİ istiyoruz. Servis bu bayrağı görünce hiçbir şey
// kaydetmeden kullanıcıya "daha net bir fotoğraf dene" der — teknik bir hata
// olarak değil, anlaşılır bir yönlendirme olarak.
const SKIN_TONE_PROMPT = `Bu bir kişinin selfie fotoğrafı. Cilt alt tonunu (undertone) analiz et.

Yalnızca şu JSON'u döndür, başka hiçbir metin ekleme:
{
  "yuz_tespit_edildi": true veya false — fotoğrafta ten rengi güvenilir biçimde okunabilen bir yüz var mı,
  "sorun": yuz_tespit_edildi false ise kısa sebep (örn. "Fotoğraf bulanık", "Yüz görünmüyor", "Işık yetersiz"); değilse null,
  "ten_tonu": "Sıcak" veya "Soğuk" veya "Nötr" — tam olarak bu üç değerden biri,
  "ten_rengi_tanimi": ten renginin kısa tanımı (örn. "Açık buğday teni"),
  "uyumlu_renkler": bu ten tonuna en çok yakışan 6-8 renk adı (kısa, tek-iki kelime),
  "uyumsuz_renkler": kaçınılması gereken 3-4 renk adı,
  "uyumlu_metal_tonlari": "Altın" ve/veya "Gümüş" — hangisi yakışıyorsa,
  "genel_tavsiye": 1-2 cümlelik kısa öneri
}

Kurallar:
- Yüz tespit edilemezse yuz_tespit_edildi false yap ve DİĞER ALANLARI BOŞ BIRAK; tahmin yürütme.
- Renk adları kısa ve gündelik olsun (örn. "Mercan", "Zeytin Yeşili"), açıklama cümlesi yazma.
- Kişinin görünüşü hakkında ten tonu dışında yorum yapma.`

// Ten tonu şeması: geçerli değerler sabit. Model başka bir şey döndürürse
// (örn. "Ilık") alan null'a düşer — arayüzde uydurma bir ton göstermektense
// eksik göstermek doğru.
const TEN_TONLARI = new Set(['Sıcak', 'Soğuk', 'Nötr'])

// Ten tonu listeleri kıyafet şemasından DAHA UZUN olabilir: prompt 6-8 uyumlu
// renk istiyor. Kıyafet şemasının 4'lük sınırı buraya uygulanmamalı.
const MAX_TEN_RENK_SAYISI = 8
const METAL_TONLARI = new Set(['Altın', 'Gümüş'])

// --- AŞAMA 2: kategoriye göre değişen analiz şemaları ---
//
// Alanlar [anahtar, tip, ipucu] üçlüsüdür. Sıra, prompt'taki örnek JSON'ın
// okunabilirliği içindir.
//
// DİKKAT: Bu sıra VERİTABANINDA KORUNMAZ. JSONB anahtarları uzunluğa ve bayt
// sırasına göre yeniden dizer (json tipi korurdu ama indekslenemez ve
// normalize edilmez). Bu yüzden arayüzdeki gösterim sırası ayrıca tanımlanır:
// frontend/src/components/AiAnalysisPanel.jsx > ALAN_ETIKETLERI.
// Yeni bir alan eklerken oraya da eklenmelidir, yoksa listenin sonuna düşer.
//
// tip: 'metin' → kısa etiket (string), 'liste' → kısa etiketlerden dizi.
// "uyumluluk" her şemada ayrı tanımlanır ve daima liste alanlarından oluşur.
// "genel_aciklama" her şemanın SONUNA otomatik eklenir.

const GIYIM_ALANLARI = [
  ['kategori', 'metin', 'ana kategori (Üst, Alt, Elbise gibi)'],
  ['alt_kategori', 'metin', 'parçanın tam türü (örn. Crop Top, Kot Pantolon, Midi Elbise)'],
  ['renk', 'metin', 'baskın renk, tek kelime (örn. Bordo)'],
  ['ikincil_renkler', 'liste', 'varsa diğer renkler; yoksa boş dizi'],
  ['kumas_deseni', 'metin', 'kumaş ve desen (örn. Pamuklu düz, Çizgili keten)'],
  ['stil', 'metin', 'stil etiketi (örn. Günlük, Klasik, Spor, Bohem)'],
  ['mevsim_uygunlugu', 'metin', 'Yaz, Kış, İlkbahar-Sonbahar veya Tüm Sezon'],
  ['kesim_tipi', 'metin', 'kesim/kalıp (örn. Oversize, Slim Fit, A Kesim)'],
]

const GIYIM_UYUMLULUK = [
  ['vucut_tipi', 'liste', 'bu kesimin yakıştığı vücut tipleri (örn. Elma, Armut, Kum saati)'],
  ['ten_tonu', 'liste', 'bu rengin yakıştığı ten tonları (örn. Sıcak ten, Soğuk ten, Buğday)'],
  ['uyumlu_parca_turleri', 'liste', 'bununla iyi giden parça türleri (örn. Yüksek bel pantolon)'],
  ['uyumsuz_kombinasyonlar', 'liste', 'kaçınılması gereken eşleşmeler (örn. Aynı desende alt parça)'],
]

// Ayakkabı ve çanta giyim şemasını GENİŞLETİR (yeniden yazmaz): ortak alanlar
// tek yerde durur, kategoriye özgü olanlar sona eklenir.
const AYAKKABI_EK_ALANLARI = [
  ['topuk_yuksekligi', 'metin', 'topuk yüksekliği (örn. Düz, 5 cm, Yüksek topuk)'],
  ['ayakkabi_turu', 'metin', 'ayakkabı türü (örn. Sneaker, Bot, Stiletto, Sandalet)'],
]

const CANTA_EK_ALANLARI = [
  ['boyut', 'metin', 'boyut (örn. Mini, Orta, Büyük)'],
  ['canta_turu', 'metin', 'çanta türü (örn. Omuz çantası, Sırt çantası, Clutch)'],
]

// Makyaj TAMAMEN AYRI bir şemadır: kesim, kumaş, vücut tipi gibi alanların bir
// rujda karşılığı yok — giyim şemasını zorlamak modeli uydurmaya iterdi.
const MAKYAJ_ALANLARI = [
  ['urun_turu', 'metin', 'ürün türü (örn. Ruj, Maskara, Fondöten, Allık)'],
  ['renk', 'metin', 'renk, tek kelime veya kısa tanım'],
  ['urun_adi', 'metin', 'ambalajda okunabiliyorsa marka ve ürün adı, okunmuyorsa null'],
  ['bitis_efekti', 'metin', 'bitiş efekti (örn. Mat, Parlak, Saten, Işıltılı)'],
]

const MAKYAJ_UYUMLULUK = [
  ['ten_tonu', 'liste', 'bu rengin yakıştığı ten tonları'],
  ['goz_rengi', 'liste', 'bu rengin öne çıkardığı göz renkleri'],
]

const ACIKLAMA_ALANI = [
  'genel_aciklama',
  'metin',
  'parçayı ve nasıl kombinleneceğini anlatan en fazla iki cümlelik Türkçe açıklama',
]

const SEMALAR = {
  giyim: { alanlar: GIYIM_ALANLARI, uyumluluk: GIYIM_UYUMLULUK },
  ayakkabi: { alanlar: [...GIYIM_ALANLARI, ...AYAKKABI_EK_ALANLARI], uyumluluk: GIYIM_UYUMLULUK },
  canta: { alanlar: [...GIYIM_ALANLARI, ...CANTA_EK_ALANLARI], uyumluluk: GIYIM_UYUMLULUK },
  makyaj: { alanlar: MAKYAJ_ALANLARI, uyumluluk: MAKYAJ_UYUMLULUK },
}

// Veritabanındaki kategori ADI → şema anahtarı.
// Anahtar olarak ad kullanılıyor çünkü categories.id SERIAL'dir ve farklı bir
// kurulumda kayabilir; adlar seed veriyle sabittir (001_initial_schema.sql).
const KATEGORI_SEMASI = {
  Üst: 'giyim',
  Alt: 'giyim',
  Elbise: 'giyim',
  Ayakkabı: 'ayakkabi',
  Çanta: 'canta',
  Makyaj: 'makyaj',
}

// Modelin uzun paragraflar yazmasını engelleyen sınırlar. Değerler arayüzde
// kısa etiket (hap/rozet) olarak gösterilir; bir cümle oraya sığmazdı.
const MAX_LIST_ITEMS = 4
const MAX_TEXT_LENGTH = 120
const MAX_DESCRIPTION_LENGTH = 400

// Gemini bazen JSON'ı markdown çitiyle sarar (```json ... ```).
// responseMimeType ile bunu istemiyoruz ama modelin biçime uymadığı durumlar
// olabiliyor; savunma amaçlı temizlik.
function stripCodeFence(text) {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim()
}

// Model "bilmiyorum" demek yerine bu tür yer tutucular üretebiliyor; hepsi
// NULL'a indirgenir ki arayüz boş alanı hiç göstermesin.
const BOS_DEGERLER = new Set([
  'null',
  'bilinmiyor',
  'belirsiz',
  'yok',
  'n/a',
  'na',
  'bilinmemektedir',
  'tespit edilemedi',
])

function metniNormalize(value, maxLength) {
  if (value === null || value === undefined) return null

  // Model tek bir metin yerine dizi döndürürse virgülle birleştirilir:
  // alanın TİPİNİ değiştirmek arayüzü kırardı.
  const raw = Array.isArray(value) ? value.filter(Boolean).join(', ') : value
  if (typeof raw === 'boolean' || typeof raw === 'number') return String(raw)
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (!trimmed || BOS_DEGERLER.has(trimmed.toLowerCase())) return null

  return trimmed.slice(0, maxLength)
}

// maxItems çağırana bırakıldı: kıyafet şemasının 4 öğelik sınırı orada
// bilinçli (kartlar kısa etiket listesi gösteriyor), ama ten tonu analizi
// 6-8 uyumlu renk istiyor — ortak sabit kullanılsaydı model doğru sayıda
// renk döndürse bile yanıt SESSİZCE 4'e kırpılırdı (bu hata bir kez yaşandı).
function listeyiNormalize(value, maxItems = MAX_LIST_ITEMS) {
  // Tek bir metin geldiyse tek öğeli listeye çevrilir (tersi yukarıda).
  const items = Array.isArray(value) ? value : [value]

  // Boş dizi de geçerli bir cevaptır ("ikincil renk yok"); null'a çevirmiyoruz.
  return items
    .map((item) => metniNormalize(item, MAX_TEXT_LENGTH))
    .filter(Boolean)
    .slice(0, maxItems)
}

class GeminiService {
  // Kategori adından şema anahtarı. Tanınmayan kategori (ileride eklenen bir
  // kategori ya da kategorisi okunamayan kayıt) giyim şemasına düşer: en genel
  // şema odur ve hiç analiz etmemekten iyidir.
  schemaKeyForCategory(categoryName) {
    return KATEGORI_SEMASI[String(categoryName ?? '').trim()] || 'giyim'
  }

  // ---- Kategoriye göre farklı prompt üreten metod ----
  //
  // Prompt, beklenen JSON'ı ALAN AÇIKLAMALARIYLA BİRLİKTE örnekler. Yalnızca
  // anahtar listesi verildiğinde model "stil" alanına paragraf, "renk" alanına
  // "açık pembeye çalan bir ton" gibi cümleler yazıyordu.
  buildPromptForCategory(categoryName) {
    const schemaKey = this.schemaKeyForCategory(categoryName)
    const { alanlar, uyumluluk } = SEMALAR[schemaKey]

    const alanSatiri = ([key, type, hint]) =>
      type === 'liste' ? `  "${key}": ["${hint}"]` : `  "${key}": "${hint}"`

    const uyumlulukBlogu = [
      '  "uyumluluk": {',
      uyumluluk.map(([key, , hint]) => `    "${key}": ["${hint}"]`).join(',\n'),
      '  }',
    ].join('\n')

    // uyumluluk bloğu daima genel_aciklama'dan hemen önce gelir.
    const govde = [...alanlar.map(alanSatiri), uyumlulukBlogu, alanSatiri(ACIKLAMA_ALANI)].join(
      ',\n',
    )

    const kategoriNotu = categoryName
      ? `Bu parça kullanıcının gardırobunda "${categoryName}" kategorisinde kayıtlı.`
      : 'Parçanın kategorisi kullanıcı tarafından belirtilmemiş.'

    return [
      'Bu bir kıyafet/aksesuar fotoğrafıdır.',
      kategoriNotu,
      'Fotoğraftaki parçayı bir moda editörü gözüyle analiz et ve SADECE aşağıdaki',
      'şemaya birebir uyan bir JSON döndür. Açıklama, selamlama veya markdown ekleme.',
      '',
      'KURALLAR:',
      '- Tüm değerler TÜRKÇE olsun.',
      '- Metin alanları kısa ETİKET olsun (cümle değil, en fazla birkaç kelime).',
      '  Yalnızca "genel_aciklama" en fazla iki cümle olabilir.',
      `- Dizi alanlarına en fazla ${MAX_LIST_ITEMS} öğe yaz.`,
      '- Fotoğraftan emin olamadığın alana null yaz; TAHMİN UYDURMA.',
      '- Şemadaki anahtarların hepsi bulunsun, fazladan anahtar ekleme.',
      '',
      'Şema:',
      '{',
      govde,
      '}',
    ].join('\n')
  }

  // AŞAMA 2 — otomatik analiz. Kategoriye özgü prompt kullanır ve sonucu
  // şemaya OTURTUR: eksik alanlar null/[] ile tamamlanır, fazlalıklar atılır.
  // Böylece arayüz her alanın var olduğuna güvenebilir ve modelin biçimden
  // sapması sayfayı kırmaz.
  async analyzeClothingItem(file, categoryName) {
    const schemaKey = this.schemaKeyForCategory(categoryName)
    const prompt = this.buildPromptForCategory(categoryName)

    const { text, model } = await this.#generate(file, prompt)

    return {
      sema: schemaKey,
      model,
      analiz_tarihi: new Date().toISOString(),
      gardirop_kategorisi: categoryName ?? null,
      veri: this.#normalizeToSchema(this.#parseJson(text), schemaKey),
    }
  }

  // TEN TONU ANALİZİ. Kıyafet analiziyle aynı altyapıyı kullanır (#generate:
  // zaman aşımı, hata çevirisi, anahtar kontrolü) ama TAMAMEN AYRI bir şemaya
  // oturur — girdi bir kıyafet değil, kullanıcının kendisi.
  //
  // FIRLATIR (analyzeClothingItem gibi): burada kullanıcı ekrana bakıp
  // bekliyor, sessizce boş dönmek yanlış olurdu. Çağıran (SkinToneService)
  // hatayı HTTP durumuna çevirir.
  //
  // Yüz tespit edilemediğinde HATA FIRLATILMAZ: `yuz_tespit_edildi: false`
  // ile döner. Bu bir sistem arızası değil, kullanıcının daha iyi bir
  // fotoğraf çekmesi gereken normal bir durum.
  async analyzeSkinTone(file) {
    const { text, model } = await this.#generate(file, SKIN_TONE_PROMPT)
    const parsed = this.#parseJson(text)
    const kaynak = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}

    // Model bayrağı hiç döndürmediyse (alanı unuttuysa) ten tonunun okunup
    // okunmadığına VERİYE BAKARAK karar veriyoruz: ten_tonu geçerliyse yüz
    // tespit edilmiş sayılır. Aksi hâlde tek eksik alan yüzünden geçerli bir
    // analizi çöpe atardık.
    const tenTonu = metniNormalize(kaynak.ten_tonu, MAX_TEXT_LENGTH)
    const gecerliTon = tenTonu && TEN_TONLARI.has(tenTonu) ? tenTonu : null
    const yuzTespitEdildi =
      typeof kaynak.yuz_tespit_edildi === 'boolean'
        ? kaynak.yuz_tespit_edildi && Boolean(gecerliTon)
        : Boolean(gecerliTon)

    if (!yuzTespitEdildi) {
      return {
        model,
        yuz_tespit_edildi: false,
        sorun: metniNormalize(kaynak.sorun, MAX_TEXT_LENGTH),
        veri: null,
      }
    }

    return {
      model,
      yuz_tespit_edildi: true,
      sorun: null,
      analiz_tarihi: new Date().toISOString(),
      // Anahtar sırası burada tanımlıdır ama JSONB bunu KORUMAZ; gösterim
      // sırası arayüzde ayrıca belirlenir (SkinTonePanel > ALAN_SIRASI).
      veri: {
        ten_tonu: gecerliTon,
        ten_rengi_tanimi: metniNormalize(kaynak.ten_rengi_tanimi, MAX_TEXT_LENGTH),
        uyumlu_renkler: listeyiNormalize(kaynak.uyumlu_renkler, MAX_TEN_RENK_SAYISI),
        uyumsuz_renkler: listeyiNormalize(kaynak.uyumsuz_renkler, MAX_TEN_RENK_SAYISI),
        // Yalnızca bilinen iki metal tonu kabul edilir.
        uyumlu_metal_tonlari: listeyiNormalize(kaynak.uyumlu_metal_tonlari, 2).filter((deger) =>
          METAL_TONLARI.has(deger),
        ),
        genel_tavsiye: metniNormalize(kaynak.genel_tavsiye, MAX_DESCRIPTION_LENGTH),
      },
    }
  }

  // AŞAMA 3 — metinleri embedding vektörlerine çevirir (vektör veritabanı için).
  // Analiz metodlarından farklı olarak GÖRSEL DEĞİL METİN alır ve farklı bir
  // model kullanır; ortak olan tek şey istemci ve hata çevirisidir.
  //
  // TOPLU çağrı destekleniyor: bir dizi metin tek istekte gönderilir. Toplu
  // embedding üretiminde (create-embeddings.js) bu, N ayrı istek yerine tek
  // istek demektir.
  async createEmbeddings(texts) {
    const list = Array.isArray(texts) ? texts : [texts]
    const temizler = list.map((text) => String(text ?? '').trim()).filter(Boolean)

    if (temizler.length === 0) {
      throw new ValidationError('Embedding için metin gönderilmedi')
    }

    if (!isConfigured()) {
      throw new ServiceUnavailableError(
        'Gemini API anahtarı tanımlı değil. backend/.env içine GEMINI_API_KEY ekleyin.',
      )
    }

    const client = getClient()
    const model = getEmbeddingModel()

    let response
    try {
      response = await client.models.embedContent({
        model,
        contents: temizler,
        config: {
          // Yazma ve sorgu tarafı AYNI görev tipini kullanmalıdır.
          taskType: EMBEDDING_TASK_TYPE,
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      })
    } catch (error) {
      console.error('Gemini embedding isteği başarısız:', error.message)

      const friendly = new ServiceUnavailableError(this.#toFriendlyMessage(error))
      friendly.isRateLimited = this.#isRateLimited(error)
      friendly.isRetryable = this.#isRetryable(error)
      friendly.retryAfterMs = this.#retryAfterMs(error)
      throw friendly
    }

    const vectors = (response?.embeddings ?? []).map((item) => item?.values)

    // Eksik/bozuk vektör sessizce geçilmemeli: Chroma'ya yarım veri yazmak,
    // sonradan teşhisi zor bir "benzerlik hep saçma" hatasına dönerdi.
    if (vectors.length !== temizler.length || vectors.some((v) => !Array.isArray(v) || !v.length)) {
      throw new ServiceUnavailableError('Gemini beklenen sayıda embedding döndürmedi')
    }

    return { model, vectors }
  }

  // Modelin çıktısını şemaya oturtur. Anahtar SIRASI şemadan gelir.
  #normalizeToSchema(parsed, schemaKey) {
    const { alanlar, uyumluluk } = SEMALAR[schemaKey]
    const kaynak = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}

    const veri = {}
    for (const [key, type] of alanlar) {
      veri[key] =
        type === 'liste'
          ? listeyiNormalize(kaynak[key])
          : metniNormalize(kaynak[key], MAX_TEXT_LENGTH)
    }

    // Model uyumluluk bloğunu düzleştirmiş olabilir (alanları en üst seviyeye
    // koyarak); veriyi kaybetmemek için iki yere birden bakılır.
    const uyumlulukKaynak =
      kaynak.uyumluluk && typeof kaynak.uyumluluk === 'object' ? kaynak.uyumluluk : kaynak

    veri.uyumluluk = {}
    for (const [key] of uyumluluk) {
      veri.uyumluluk[key] = listeyiNormalize(uyumlulukKaynak[key])
    }

    veri.genel_aciklama = metniNormalize(kaynak.genel_aciklama, MAX_DESCRIPTION_LENGTH)

    return veri
  }

  #parseJson(text) {
    try {
      return JSON.parse(stripCodeFence(text))
    } catch {
      // Model JSON üretemediyse bu bizim hatamız değil; ham metnin başı
      // loglanır ki teşhis edilebilsin.
      console.error('Gemini JSON olarak çözülemedi:', text.slice(0, 200))
      const error = new ServiceUnavailableError('Gemini yanıtı JSON olarak çözümlenemedi')
      // Biçim hatası modelin o koşuya özgü sapmasıdır; ikinci deneme
      // genellikle şemaya uyar.
      error.isRetryable = true
      throw error
    }
  }

  // Görseli modele gönderen ortak yol. İki analiz metodu da bunu kullanır:
  // hata çevirisi ve zaman aşımı kuralı tek yerde kalsın diye.
  async #generate(file, prompt) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new ValidationError('Analiz edilecek bir görsel gönderilmedi')
    }

    // Anahtar yoksa dış servise HİÇ GİDİLMEZ (WeatherService ile aynı kural).
    if (!isConfigured()) {
      throw new ServiceUnavailableError(
        'Gemini API anahtarı tanımlı değil. backend/.env içine GEMINI_API_KEY ekleyin.',
      )
    }

    const client = getClient()
    const model = getModel()

    let response
    try {
      response = await client.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              // Görsel diskte tutulmaz; tampon doğrudan base64'e çevrilip gönderilir.
              {
                inlineData: {
                  mimeType: file.mimetype,
                  data: file.buffer.toString('base64'),
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          // Modelden DOĞRUDAN JSON istiyoruz: aksi hâlde açıklama cümleleri ve
          // markdown çitleri arasından ayıklamak gerekirdi.
          responseMimeType: 'application/json',
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      })
    } catch (error) {
      // SDK hatası ASLA olduğu gibi dışarı sızmamalı: yığın izi ve anahtar
      // parçaları içerebilir. Anlaşılır Türkçe mesaja çevriliyor.
      console.error('Gemini isteği başarısız:', error.message)

      const friendly = new ServiceUnavailableError(this.#toFriendlyMessage(error))
      // Kota/limit hatası, çağıranın SOĞUMA süresi başlatabilmesi için
      // işaretlenir (bkz. ClothingAnalysisService): arka arkaya istek atıp
      // kalan kotayı büsbütün tüketmenin önüne geçer.
      friendly.isRateLimited = this.#isRateLimited(error)
      // GEÇİCİ hatalar (zaman aşımı, 503, ağ kopması) yeniden denenebilir.
      // Geçersiz anahtar veya bulunamayan model tekrar denemekle düzelmez —
      // onlarda ikinci çağrı yalnızca kotayı harcardı.
      friendly.isRetryable = this.#isRetryable(error)
      // Gemini kota hatasında ne kadar beklenmesi gerektiğini söyler
      // (RetryInfo / "Please retry in 24.5s"). Bunu çağırana taşıyoruz ki
      // soğuma süresi tahminle değil servisin verdiği bilgiyle belirlensin.
      friendly.retryAfterMs = this.#retryAfterMs(error)
      throw friendly
    }

    const text = typeof response?.text === 'string' ? response.text : ''
    if (!text.trim()) {
      throw new ServiceUnavailableError('Gemini boş bir yanıt döndürdü')
    }

    return { text, model }
  }

  // Ölçümde aynı model aynı fotoğraf için bir kez 6 sn, bir kez 30 sn'yi
  // aşarak zaman aşımına düştü; bu dalgalanma modelin normal davranışı.
  // Bu yüzden geçici hatalar yeniden denenebilir sayılır.
  #isRetryable(error) {
    const message = String(error?.message || '')
    const status = error?.status ?? error?.code

    if (this.#isRateLimited(error)) return false
    if (error?.name === 'TimeoutError' || /abort|timeout/i.test(message)) return true
    if (status === 500 || status === 502 || status === 503 || status === 504) return true
    return /UNAVAILABLE|overloaded|high demand|fetch failed|ECONNRESET|ETIMEDOUT/i.test(message)
  }

  // Hata gövdesindeki bekleme süresini milisaniye olarak çıkarır.
  // SDK hatayı düz metin olarak taşıdığı için yapılandırılmış alan yerine
  // metinden okunuyor; okunamazsa null döner ve çağıran varsayılanı kullanır.
  #retryAfterMs(error) {
    const message = String(error?.message || '')
    const match =
      message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ||
      message.match(/retry in (\d+(?:\.\d+)?)s/i)

    if (!match) return null
    return Math.round(Number(match[1]) * 1000)
  }

  #isRateLimited(error) {
    const status = error?.status ?? error?.code
    const message = String(error?.message || '')
    return status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)
  }

  // Gemini'nin sık karşılaşılan hatalarını kullanıcının anlayacağı dile çevirir.
  #toFriendlyMessage(error) {
    const message = String(error?.message || '')
    const status = error?.status ?? error?.code

    if (error?.name === 'TimeoutError' || /abort|timeout/i.test(message)) {
      return 'Gemini yanıt vermedi (zaman aşımı). Lütfen tekrar deneyin.'
    }
    if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(message)) {
      return 'Gemini API anahtarı geçersiz. backend/.env içindeki GEMINI_API_KEY değerini kontrol edin.'
    }
    if (status === 401 || status === 403 || /PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
      return 'Gemini API anahtarı reddedildi (yetki hatası). Anahtarın geçerli olduğunu doğrulayın.'
    }
    if (this.#isRateLimited(error)) {
      return 'Gemini kullanım kotası doldu. Bir süre sonra tekrar deneyin.'
    }
    if (status === 404 || /not found|NOT_FOUND/i.test(message)) {
      return `Gemini modeli bulunamadı (${getModel()}). GEMINI_MODEL değerini kontrol edin.`
    }
    return 'Gemini servisine şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.'
  }
}

// Sınıf varsayılan dışa aktarımdır (mevcut çağrı yerleri değişmez); şema
// tabloları testlerin ve ileriki aşamaların okuyabilmesi için ekli.
module.exports = GeminiService
module.exports.SEMALAR = SEMALAR
module.exports.KATEGORI_SEMASI = KATEGORI_SEMASI
module.exports.SKIN_TONE_PROMPT = SKIN_TONE_PROMPT
module.exports.TEN_TONLARI = TEN_TONLARI
module.exports.MAX_TEN_RENK_SAYISI = MAX_TEN_RENK_SAYISI
