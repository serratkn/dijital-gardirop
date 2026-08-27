const { NotFoundError, ServiceUnavailableError, ValidationError } = require('../utils/errors')
const { assertUuid } = require('../utils/validators')
const { isConfigured } = require('../config/gemini')
const { isEnabled } = require('../config/vectorStore')

// Vektör veritabanı iş mantığı (Gemini Aşama 3).
//
// İKİ AYRI SÖZLEŞME — hangi yolun kullanıldığına bağlı:
//
//   YAZMA (indexItem / removeItem): ASLA FIRLATMAZ. Embedding üretimi, kıyafet
//   ekleme akışının parçası değil üstüne konan bir zenginleştirmedir; vektör
//   deposu kapalıysa, kota dolduysa veya Gemini'ye ulaşılamıyorsa kıyafet
//   kaydı ve analizi yerinde durur, kullanıcı hiçbir şey görmez.
//   (ClothingAnalysisService ile aynı ilke.)
//
//   OKUMA (findSimilar): FIRLATIR. Burada kullanıcı doğrudan "benzerleri göster"
//   demiştir; sessizce boş liste dönmek "benzer parça yok" gibi YANLIŞ bir cevap
//   olurdu. Erişilemeyen servis 503 ile bildirilir.
//
// (Aynı ayrım GeminiService ↔ WeatherService arasında da var ve aynı gerekçeye
// dayanıyor: bekleyen bir kullanıcı var mı, yok mu.)

const DURUM = {
  TAMAMLANDI: 'tamamlandi',
  ATLANDI: 'atlandi',
  BASARISIZ: 'basarisiz',
}

// Kota hatasından sonra yeni embedding istenmeyen süre. Embedding çağrıları
// analiz çağrılarıyla AYNI Gemini kotasını harcar; limit dolmuşken istek
// atmaya devam etmek kotayı geri getirmez.
const RATE_LIMIT_COOLDOWN_MS = 60_000

// Geçici hatalar için toplam deneme sayısı (ClothingAnalysisService ile aynı
// gerekçe ve aynı sınır). Kalıcı hatalar hiç denenmez.
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 1500

// Veritabanında saklanan özet metnin üst sınırı. Embedding modeli çok daha
// uzununu kabul eder ama özet zaten kısa alan etiketlerinden üretiliyor;
// sınır yalnızca bozuk bir analizin devasa bir belgeye dönüşmesini engelliyor.
const MAX_DOCUMENT_LENGTH = 2000

// Kombin Öner (Aşama 4) için üst süre sınırı. pgvector sorguları AYNI Postgres
// bağlantı havuzu üzerinden gittiği için normalde birkaç milisaniye sürer
// (kullanıcı başına birkaç yüz satırlık bir tablo, index'li WHERE); bu sınır
// artık "ayrı bir servise ağ turu" değil, genel bir güvenlik ağıdır — sorgu
// beklenmedik şekilde asılı kalırsa (ör. veritabanı o an aşırı yüklüyse)
// öneri ekranı süresiz beklemesin diye. 3 sn aşıldıysa beklemek yerine
// rastgele seçime düşmek (çağıranın işi) her zaman daha iyi.
const COMPANION_TIMEOUT_MS = 3000

// Kategori başına döndürülen aday sayısı. "Başka Öneri Göster" bu havuzun
// içinde ilerlediği için 1 değil N alınır (bkz. findCompanions).
const COMPANION_DEFAULT_LIMIT = 5
const COMPANION_MAX_LIMIT = 20

// Serbest metin araması (findByText) TEK bir kategoriye değil, kullanıcının
// TÜM indekslenmiş gardırobuna bakar (seed parça herhangi bir kombin
// kategorisinden gelebilir) — bu yüzden companion'lardan daha geniş bir
// varsayılan sınır makul.
const TEXT_SEARCH_DEFAULT_LIMIT = 30
const TEXT_SEARCH_MAX_LIMIT = 50

// Toplu embedding isteğinde bir partide kaç metin gönderileceği. Tek bir
// devasa istek hem zaman aşımına yaklaşır hem de tek hatada TÜM partiyi
// düşürürdü; 20 makul bir orta yol.
const BATCH_SIZE = 20

// Bir alanın listesini "a, b ve c" biçiminde birleştirir: embedding metni
// doğal dil olmalı, JSON dökümü değil — model anlamı cümleden çıkarır.
function listele(values) {
  const items = (Array.isArray(values) ? values : []).filter(Boolean)
  if (items.length === 0) return null
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

class VectorService {
  constructor(vectorRepository, clothingItemRepository, geminiService) {
    this.vectorRepository = vectorRepository
    this.clothingItemRepository = clothingItemRepository
    this.geminiService = geminiService

    // Aynı parça için eşzamanlı iki indeksleme olmasın (ClothingAnalysisService
    // ile aynı tuzak: işaret İLK await'ten ÖNCE konur).
    this.inFlight = new Set()
    this.cooldownUntil = 0

    // Eşzamanlılık sınırı BİLEREK YOK: bu servisin iki çağıranı da zaten
    // sınırlı. Analiz akışından geldiğinde ClothingAnalysisService'in
    // MAX_CONCURRENT=2 semaforu içindedir; toplu script ise N metni TEK
    // embedding isteğinde gönderir. İkinci bir semafor koymak yalnızca
    // gereksiz karmaşıklık olurdu.
  }

  // ---- Embedding metni ----
  //
  // ai_analysis JSON'unu ANLAMLI BİR CÜMLEYE çevirir. Ham JSON'ı embed etmek
  // yerine cümle kurmamızın sebebi: embedding modeli doğal dilde eğitilmiştir;
  // `{"kesim_tipi":"Oversize"}` ile "Kesimi oversize" aynı vektöre gitmez ve
  // anahtar adları (kesim_tipi, alt_kategori) anlam taşımayan gürültü ekler.
  //
  // Kullanıcının kendi girdiği ad ve renk de metne KATILIR: marka bilgisi
  // ("Bershka crop top") yalnızca orada var ve gerçek bir benzerlik sinyali.
  buildSummaryText(item, analysis = null) {
    const veri = analysis?.veri ?? item?.ai_analysis?.veri ?? {}
    const kategori = analysis?.gardirop_kategorisi ?? item?.ai_analysis?.gardirop_kategorisi

    const cumleler = []

    // 1) Kimlik: kullanıcının verdiği ad + modelin bulduğu tür.
    const tur = veri.alt_kategori || veri.urun_turu
    const baslik = [item?.name, tur && tur !== item?.name ? `(${tur})` : null]
      .filter(Boolean)
      .join(' ')
    if (baslik) cumleler.push(`${baslik}.`)
    if (kategori) cumleler.push(`${kategori} kategorisinde bir parça.`)

    // 2) Görünüş.
    const renk = veri.renk || item?.color
    if (renk) cumleler.push(`Baskın rengi ${renk}.`)
    const ikincil = listele(veri.ikincil_renkler)
    if (ikincil) cumleler.push(`İkincil renkleri ${ikincil}.`)
    if (veri.kumas_deseni) cumleler.push(`Kumaşı ve deseni ${veri.kumas_deseni}.`)
    if (veri.bitis_efekti) cumleler.push(`Bitiş efekti ${veri.bitis_efekti}.`)
    if (veri.kesim_tipi) cumleler.push(`Kesimi ${veri.kesim_tipi}.`)
    if (veri.topuk_yuksekligi) cumleler.push(`Topuk yüksekliği ${veri.topuk_yuksekligi}.`)
    if (veri.boyut) cumleler.push(`Boyutu ${veri.boyut}.`)
    if (item?.brand) cumleler.push(`Markası ${item.brand}.`)

    // 3) Kullanım bağlamı — benzerlik aramasının asıl işe yarayan kısmı.
    if (veri.stil) cumleler.push(`${veri.stil} stilinde.`)
    const mevsim = veri.mevsim_uygunlugu || item?.season
    if (mevsim) cumleler.push(`${mevsim} mevsimine uygun.`)

    const uyumluluk = veri.uyumluluk ?? {}
    const vucut = listele(uyumluluk.vucut_tipi)
    if (vucut) cumleler.push(`${vucut} vücut tipine yakışır.`)
    const ten = listele(uyumluluk.ten_tonu)
    // "ten tonuna" değil "tonuna": modelin değerleri zaten "Sıcak ten",
    // "Açık Ten" gibi geliyor ve "Sıcak ten ten tonuna" diye tekrarlıyordu.
    if (ten) cumleler.push(`${ten} tonuna uygun.`)
    const goz = listele(uyumluluk.goz_rengi)
    if (goz) cumleler.push(`${goz} göz rengini öne çıkarır.`)
    const uyumlu = listele(uyumluluk.uyumlu_parca_turleri)
    if (uyumlu) cumleler.push(`${uyumlu} ile iyi gider.`)
    const uyumsuz = listele(uyumluluk.uyumsuz_kombinasyonlar)
    if (uyumsuz) cumleler.push(`${uyumsuz} ile uyumsuzdur.`)

    // 4) Modelin kendi editöryal cümlesi en sona.
    if (veri.genel_aciklama) cumleler.push(veri.genel_aciklama)

    return cumleler.join(' ').slice(0, MAX_DOCUMENT_LENGTH)
  }

  // ---- Yazma yolu (asla fırlatmaz) ----

  // Analiz tamamlandıktan sonra çağrılır; await EDİLMEZ.
  //
  // `options` doğrudan indexItem'a geçer. YENİDEN ANALİZDE `force: true`
  // gelmesi ŞART: ai_analysis üzerine yazıldıysa ondan türeyen embedding de
  // bayatlamıştır ve maliyet koruması ("zaten indekslenmiş") aksi hâlde
  // eski vektörü olduğu gibi bırakırdı.
  indexItemInBackground(itemId, options = {}) {
    return this.indexItem(itemId, options).catch((error) => {
      // Buraya normalde hiç düşülmez (indexItem yutar); son güvenlik ağı.
      console.error('Embedding beklenmedik şekilde hata verdi:', error?.message)
      return { durum: DURUM.BASARISIZ, sebep: 'beklenmeyen-hata' }
    })
  }

  async indexItem(itemId, { force = false } = {}) {
    if (!isEnabled()) return this.#skip(itemId, 'vektor-devre-disi')
    if (!isConfigured()) return this.#skip(itemId, 'anahtar-yok')
    if (Date.now() < this.cooldownUntil) return this.#skip(itemId, 'kota-soguma-suresi')
    if (this.inFlight.has(itemId)) return this.#skip(itemId, 'zaten-indeksleniyor')

    // İşaret İLK await'TEN ÖNCE (aşağıdaki findById asenkron).
    this.inFlight.add(itemId)
    try {
      let item
      try {
        item = await this.clothingItemRepository.findById(itemId)
      } catch (error) {
        console.error(`Embedding için kayıt okunamadı (${itemId}):`, error.message)
        return { durum: DURUM.BASARISIZ, sebep: 'kayit-okunamadi' }
      }

      if (!item) return this.#skip(itemId, 'kayit-yok')

      // Analizi olmayan parçanın embedding'i de olmaz: özet metin ai_analysis'ten
      // üretiliyor, o yoksa geriye yalnızca kullanıcının yazdığı ad kalırdı ve
      // bu, benzerlik için anlamlı bir vektör vermezdi.
      if (!item.ai_analysis) return this.#skip(itemId, 'analiz-yok')

      // MALİYET KORUMASI: vektörü zaten varsa yeniden üretilmez.
      if (!force) {
        try {
          const mevcut = await this.vectorRepository.getExistingIds([itemId])
          if (mevcut.has(itemId)) return this.#skip(itemId, 'zaten-indekslenmis')
        } catch (error) {
          // Veritabanına ulaşılamıyorsa zaten yazma da başarısız olacak.
          console.error(`Embedding kontrolü başarısız (${itemId}):`, error.message)
          return { durum: DURUM.BASARISIZ, sebep: 'vektor-erisilemiyor' }
        }
      }

      const document = this.buildSummaryText(item)
      if (!document.trim()) return this.#skip(itemId, 'ozet-metin-bos')

      return await this.#embedAndStore(item, document)
    } finally {
      this.inFlight.delete(itemId)
    }
  }

  async #embedAndStore(item, document) {
    const startedAt = Date.now()

    let vector
    let embeddingModel
    let sonHata

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const { model, vectors } = await this.geminiService.createEmbeddings([document])
        vector = vectors[0]
        embeddingModel = model
        sonHata = null
        break
      } catch (error) {
        sonHata = error

        if (error?.isRateLimited) {
          const bekleme = Math.max(RATE_LIMIT_COOLDOWN_MS, error?.retryAfterMs ?? 0)
          this.cooldownUntil = Date.now() + bekleme
          console.warn(
            `Embedding kota sınırına takıldı; ${Math.round(bekleme / 1000)} sn boyunca yeni embedding üretilmeyecek.`,
          )
          break
        }

        if (!error?.isRetryable || attempt === MAX_ATTEMPTS) break

        console.warn(
          `Embedding geçici hata verdi (${item.id}), yeniden deneniyor ` +
            `(${attempt}/${MAX_ATTEMPTS}): ${error.message}`,
        )
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }

    if (sonHata) {
      console.error(`Embedding üretilemedi (${item.id}): ${sonHata.message}`)
      return { durum: DURUM.BASARISIZ, sebep: sonHata?.isRateLimited ? 'kota' : 'embedding-hatasi' }
    }

    try {
      await this.vectorRepository.upsertItem({
        id: item.id,
        embedding: vector,
        document,
        // METADATA yalnızca DEĞİŞMEYEN alanlardan seçildi. is_clean veya
        // is_favorite buraya konsaydı kullanıcı her toggle'da bu tabloyu da
        // güncellemek zorunda kalırdı; kalmasaydı filtre bayat veriyle çalışırdı.
        // Değişken durum her zaman clothing_items'tan (ana tablo) okunur.
        metadata: {
          user_id: item.user_id,
          category_id: item.category_id,
          sema: item.ai_analysis?.sema ?? 'bilinmiyor',
          embedding_modeli: embeddingModel,
          olusturma: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error(`Embedding veritabanına yazılamadı (${item.id}):`, error.message)
      return { durum: DURUM.BASARISIZ, sebep: 'vektor-yazma-hatasi' }
    }

    console.log(
      `Embedding kaydedildi: ${item.id} (${document.length} karakter, ` +
        `${vector.length} boyut, ${Date.now() - startedAt} ms)`,
    )
    return { durum: DURUM.TAMAMLANDI, boyut: vector.length, ozet: document }
  }

  // ---- Toplu indeksleme (asla fırlatmaz) ----
  //
  // N parçayı TEK Gemini isteğinde embed eder. Tek tek indexItem çağırmak da
  // çalışırdı ama N ayrı istek demekti; embedding ucu toplu çağrıyı destekliyor
  // ve bu, toplu doldurmada (create-embeddings.js) belirgin fark yaratıyor.
  //
  // Parça başına sonuç döner: biri başarısız olduğunda diğerleri etkilenmez.
  async indexItems(itemIds, { force = false } = {}) {
    const sonuclar = new Map(itemIds.map((id) => [id, { durum: DURUM.ATLANDI, sebep: 'islenmedi' }]))

    if (!isEnabled()) {
      itemIds.forEach((id) => sonuclar.set(id, { durum: DURUM.ATLANDI, sebep: 'vektor-devre-disi' }))
      return sonuclar
    }
    if (!isConfigured()) {
      itemIds.forEach((id) => sonuclar.set(id, { durum: DURUM.ATLANDI, sebep: 'anahtar-yok' }))
      return sonuclar
    }

    // Hangileri gerçekten işlenecek: kaydı olan, analizi olan, (force değilse)
    // henüz indekslenmemiş olanlar.
    let mevcutIds = new Set()
    if (!force) {
      try {
        mevcutIds = await this.vectorRepository.getExistingIds(itemIds)
      } catch (error) {
        console.error('Toplu embedding kontrolü başarısız:', error.message)
        itemIds.forEach((id) =>
          sonuclar.set(id, { durum: DURUM.BASARISIZ, sebep: 'vektor-erisilemiyor' }),
        )
        return sonuclar
      }
    }

    const islenecek = []
    for (const id of itemIds) {
      if (mevcutIds.has(id)) {
        sonuclar.set(id, { durum: DURUM.ATLANDI, sebep: 'zaten-indekslenmis' })
        continue
      }

      let item
      try {
        item = await this.clothingItemRepository.findById(id)
      } catch (error) {
        console.error(`Toplu embedding için kayıt okunamadı (${id}):`, error.message)
        sonuclar.set(id, { durum: DURUM.BASARISIZ, sebep: 'kayit-okunamadi' })
        continue
      }

      if (!item) {
        sonuclar.set(id, { durum: DURUM.ATLANDI, sebep: 'kayit-yok' })
        continue
      }
      if (!item.ai_analysis) {
        sonuclar.set(id, { durum: DURUM.ATLANDI, sebep: 'analiz-yok' })
        continue
      }

      const document = this.buildSummaryText(item)
      if (!document.trim()) {
        sonuclar.set(id, { durum: DURUM.ATLANDI, sebep: 'ozet-metin-bos' })
        continue
      }

      islenecek.push({ item, document })
    }

    // Tek bir devasa istek yerine parçalara bölünür: çok uzun bir toplu istek
    // hem zaman aşımına yakın durur hem de tek bir hata TÜM partiyi düşürürdü.
    for (let i = 0; i < islenecek.length; i += BATCH_SIZE) {
      const parti = islenecek.slice(i, i + BATCH_SIZE)

      if (Date.now() < this.cooldownUntil) {
        parti.forEach(({ item }) =>
          sonuclar.set(item.id, { durum: DURUM.ATLANDI, sebep: 'kota-soguma-suresi' }),
        )
        continue
      }

      let vectors
      let embeddingModel
      try {
        const cevap = await this.geminiService.createEmbeddings(parti.map((row) => row.document))
        vectors = cevap.vectors
        embeddingModel = cevap.model
      } catch (error) {
        if (error?.isRateLimited) {
          const bekleme = Math.max(RATE_LIMIT_COOLDOWN_MS, error?.retryAfterMs ?? 0)
          this.cooldownUntil = Date.now() + bekleme
          console.warn(
            `Toplu embedding kota sınırına takıldı; ${Math.round(bekleme / 1000)} sn beklenecek.`,
          )
        }
        console.error('Toplu embedding üretilemedi:', error.message)
        parti.forEach(({ item }) =>
          sonuclar.set(item.id, {
            durum: DURUM.BASARISIZ,
            sebep: error?.isRateLimited ? 'kota' : 'embedding-hatasi',
          }),
        )
        continue
      }

      for (let j = 0; j < parti.length; j += 1) {
        const { item, document } = parti[j]
        try {
          await this.vectorRepository.upsertItem({
            id: item.id,
            embedding: vectors[j],
            document,
            metadata: {
              user_id: item.user_id,
              category_id: item.category_id,
              sema: item.ai_analysis?.sema ?? 'bilinmiyor',
              embedding_modeli: embeddingModel,
              olusturma: new Date().toISOString(),
            },
          })
          sonuclar.set(item.id, { durum: DURUM.TAMAMLANDI, boyut: vectors[j].length })
        } catch (error) {
          console.error(`Embedding veritabanına yazılamadı (${item.id}):`, error.message)
          sonuclar.set(item.id, { durum: DURUM.BASARISIZ, sebep: 'vektor-yazma-hatasi' })
        }
      }
    }

    return sonuclar
  }

  // Kıyafet silindiğinde vektörü de gitmeli; yoksa benzer aramasında var
  // olmayan bir parça dönerdi. Bu da fırlatmaz: silme işlemi vektör deposu
  // yüzünden başarısız sayılmamalı.
  async removeItem(itemId) {
    if (!isEnabled()) return { durum: DURUM.ATLANDI, sebep: 'vektor-devre-disi' }

    try {
      await this.vectorRepository.deleteItems([itemId])
      return { durum: DURUM.TAMAMLANDI }
    } catch (error) {
      console.error(`Embedding silinemedi (${itemId}):`, error.message)
      return { durum: DURUM.BASARISIZ, sebep: 'vektor-silme-hatasi' }
    }
  }

  // ---- Okuma yolu (FIRLATIR) ----

  // Bir kıyafetin en yakın komşuları. Sonuçlar Postgres'ten zenginleştirilir:
  // çıplak id + mesafe listesi ne testte ne arayüzde işe yarardı.
  async findSimilar(itemId, userId, { limit = 5, categoryId = null } = {}) {
    // Bozuk biçimli bir id doğrudan Postgres'e gitseydi 22P02 ile 500'e
    // düşerdi (aynı tuzak GET /outfits?clothingItemId= filtresinde yaşandı).
    assertUuid(itemId, 'Kıyafet id')

    const item = await this.clothingItemRepository.findById(itemId)

    // Başkasının parçası için 404 (deponun her yerindeki kalıp): 403 kaydın
    // var olduğunu ele verirdi.
    if (!item || item.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    if (!isEnabled()) {
      throw new ServiceUnavailableError('Vektör veritabanı devre dışı (VECTOR_STORE_ENABLED=false)')
    }

    // Parçanın KENDİ vektörü veritabanında zaten var; yeniden embedding
    // üretmek gereksiz bir Gemini çağrısı (ve para) olurdu.
    const kendiVektor = await this.#readOwnVector(itemId)

    // Henüz indekslenmemiş parça bir HATA DEĞİLDİR: analizi yeni bitmiş ya da
    // hiç fotoğrafı olmayabilir. Çağıran bunu ayırt edebilsin diye açıkça
    // bildiriliyor.
    if (!kendiVektor) {
      return {
        id: itemId,
        indekslendi: false,
        sebep: item.ai_analysis ? 'embedding-henuz-olusturulmadi' : 'analiz-yok',
        benzerler: [],
      }
    }

    // KULLANICI FİLTRESİ ZORUNLU: filtresiz sorgu başka kullanıcıların
    // gardıroplarından sonuç döndürürdü — `userId` bu yüzden VectorRepository.
    // query()'e ayrı bir parametre olarak geçer, opsiyonel bir filtre değil.
    //
    // Parçanın kendisi daima en yakın komşusudur (mesafe 0); bir fazla isteyip
    // kendisini SQL sonucundan eliyoruz (aşağıdaki filter) — sorgunun kendisine
    // "kendini hariç tut" koşulu eklemek yerine böylesi filtre mantığından
    // bağımsız ve okunması kolay.
    const komsular = await this.vectorRepository.query({
      embedding: kendiVektor,
      limit: Number(limit) + 1,
      userId,
      categoryId: categoryId === null ? null : Number(categoryId),
    })

    const digerleri = komsular.filter((row) => row.id !== itemId).slice(0, Number(limit))

    // Postgres'ten zenginleştir. Silinmiş parçalar findById'de null döner ve
    // listeden düşer: vektör tablosunda bayat bir kayıt kalsa bile yanıta sızmaz.
    const zenginlestirilmis = await Promise.all(
      digerleri.map(async (row) => {
        const komsu = await this.clothingItemRepository.findById(row.id)
        if (!komsu || komsu.user_id !== userId) return null

        return {
          id: komsu.id,
          name: komsu.name,
          category_id: komsu.category_id,
          color: komsu.color,
          image_url: komsu.image_url,
          // season / is_clean / is_favorite, findCompanions ile AYNI gerekçeyle
          // dönüyor: bu satırlar arayüzde paylaşılan kıyafet kartına besleniyor
          // ve kart, favori kalbini ve "Kirli" rozetini bu alanlardan çiziyor.
          // Eksik olsalardı favorilenmiş bir parça boş kalple görünürdü.
          // DEĞİŞKEN DURUM DAİMA clothing_items'tan gelir, embedding tablosundan değil.
          season: komsu.season,
          is_clean: komsu.is_clean,
          is_favorite: komsu.is_favorite,
          // Kosinüs mesafesi 0 = birebir aynı. Benzerlik puanı okunabilir olsun
          // diye 1'den çıkarılıyor; ikisi de dönüyor çünkü mesafe ham ölçüdür.
          mesafe: row.distance,
          benzerlik: row.distance === null ? null : Number((1 - row.distance).toFixed(4)),
          ozet: row.document,
        }
      }),
    )

    return {
      id: itemId,
      indekslendi: true,
      benzerler: zenginlestirilmis.filter(Boolean),
    }
  }

  // AŞAMA 4 — RAG ile Kombin Öner'in RETRIEVAL adımı.
  //
  // Bir "başlangıç parçası" verilir, istenen DİĞER kategorilerin her birinden
  // o parçaya en yakın adaylar döner. Kombin kurma kuralları (temiz/kirli,
  // hava durumu, hangi slot hangi kategoriden) BURADA DEĞİL çağıranda kalır:
  // bu metot yalnızca "vektör uzayında bunlar yakın" der.
  //
  // NEDEN KATEGORİ BAŞINA AYRI SORGU? Tek bir büyük sorgu (ör. LIMIT 50)
  // istatistiksel olarak çok parçalı bir kategoriyi öne alır ve az parçalı
  // kategoriden hiç sonuç döndürmeyebilirdi — kombin ise her slotu doldurmak
  // zorunda. Sorgular paralel gider; aynı Postgres bağlantı havuzu üzerinden.
  //
  // SÖZLEŞME findSimilar ile aynı: FIRLATIR. Vektör deposuna ulaşılamazsa 503
  // döner, boş liste değil. "Sessizce rastgeleye düş" kararı ÇAĞIRANIN işidir
  // (Kombin Öner sayfası tam olarak bunu yapar) — API'nin kendisi yalan
  // söylememeli, yoksa arayüz akıllı olmayan bir öneriyi akıllı sanardı.
  async findCompanions(itemId, userId, { categoryIds, limit = COMPANION_DEFAULT_LIMIT } = {}) {
    assertUuid(itemId, 'Kıyafet id')

    const seed = await this.clothingItemRepository.findById(itemId)

    // Başkasının parçası için 404 (deponun her yerindeki kalıp).
    if (!seed || seed.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    const hedefKategoriler = this.#parseCategoryIds(categoryIds).filter(
      (categoryId) => categoryId !== seed.category_id,
    )
    if (hedefKategoriler.length === 0) {
      throw new ValidationError('En az bir hedef kategori belirtilmelidir (categoryIds)')
    }

    if (!isEnabled()) {
      throw new ServiceUnavailableError('Vektör veritabanı devre dışı (VECTOR_STORE_ENABLED=false)')
    }

    const sinir = Math.min(Math.max(Math.floor(Number(limit)) || COMPANION_DEFAULT_LIMIT, 1),
      COMPANION_MAX_LIMIT)

    const kendiVektor = await this.#withDeadline(this.#readOwnVector(itemId), 'vektör okuma')

    // Henüz indekslenmemiş başlangıç parçası HATA DEĞİLDİR: fotoğrafı yeni
    // yüklenmiş ya da hiç yüklenmemiş olabilir. Çağıran bunu görüp rastgele
    // seçime düşer.
    if (!kendiVektor) {
      return {
        id: itemId,
        indekslendi: false,
        sebep: seed.ai_analysis ? 'embedding-henuz-olusturulmadi' : 'analiz-yok',
        adaylar: {},
      }
    }

    // KULLANICI FİLTRESİ ZORUNLU (findSimilar ile aynı gerekçe): filtresiz bir
    // vektör sorgusu başka kullanıcıların gardıroplarından sonuç döndürürdü.
    const sorgular = hedefKategoriler.map(async (categoryId) => {
      const komsular = await this.vectorRepository.query({
        embedding: kendiVektor,
        // Başlangıç parçası teoride aynı kategoriye düşemez (yukarıda elendi)
        // ama bir fazla istemek bedava bir güvenlik payı.
        limit: sinir + 1,
        userId,
        categoryId,
      })
      return [categoryId, komsular.filter((row) => row.id !== itemId).slice(0, sinir)]
    })

    let gruplar
    try {
      gruplar = await this.#withDeadline(Promise.all(sorgular), 'benzerlik sorgusu')
    } catch (error) {
      if (error instanceof ServiceUnavailableError) throw error
      console.error('Kombin adayları sorgulanamadı:', error.message)
      throw new ServiceUnavailableError('Vektör veritabanına şu anda ulaşılamıyor')
    }

    // Postgres'ten TEK sorguda zenginleştir. Silinmiş parçalar findByIds'te
    // hiç dönmez: embedding tablosunda bayat bir kayıt kalsa bile yanıta sızmaz.
    const tumIds = gruplar.flatMap(([, komsular]) => komsular.map((row) => row.id))
    const kayitlar = new Map(
      (await this.clothingItemRepository.findByIds([...new Set(tumIds)]))
        .filter((row) => row.user_id === userId)
        .map((row) => [row.id, row]),
    )

    const adaylar = {}
    for (const [categoryId, komsular] of gruplar) {
      adaylar[categoryId] = komsular
        .map((row) => {
          const kayit = kayitlar.get(row.id)
          if (!kayit) return null

          return {
            id: kayit.id,
            name: kayit.name,
            category_id: kayit.category_id,
            color: kayit.color,
            image_url: kayit.image_url,
            // DEĞİŞKEN DURUM POSTGRES'TEN (clothing_items) GELİR, embedding
            // tablosundan değil (bkz. §8: is_clean/season orada saklansaydı
            // her toggle'da o tabloyu da güncellemek gerekirdi). Çağıran
            // temiz/kirli ve hava durumu filtrelerini bu iki alanla uygular —
            // vektör benzerliği filtreleri ATLAMAZ.
            season: kayit.season,
            is_clean: kayit.is_clean,
            mesafe: row.distance,
            benzerlik: row.distance === null ? null : Number((1 - row.distance).toFixed(4)),
          }
        })
        .filter(Boolean)
    }

    return { id: itemId, indekslendi: true, adaylar }
  }

  // AŞAMA 5 — Kombin Öner'in serbest metin (mood) yorumlamasını besleyen ikinci
  // RETRIEVAL yolu. findCompanions/findSimilar'dan TEMEL bir farkı var: onlar
  // VAR OLAN bir parçanın veritabanında zaten duran vektörünü OKUR; bu metod
  // kullanıcının serbest metnini (arama_metni) YENİ bir embedding'e çevirir ve
  // kullanıcının TÜM indekslenmiş gardırobunu bu embedding'e yakınlığa göre
  // sıralar. Bu yüzden HER ÇAĞRIDA gerçek bir Gemini embedding isteği atar —
  // findSimilar/findCompanions ise hiç Gemini çağırmaz (yalnızca var olan
  // vektörü okur).
  //
  // Kategoriye göre GRUPLANMAZ (findCompanions'ın aksine): çağıran (seed parça
  // seçimi) "hangi kategoriden" değil "genel olarak en yakın hangi parça"
  // sorusuna cevap arıyor — düz, mesafeye göre sıralı bir liste yeterli.
  //
  // SÖZLEŞME aynı aile: FIRLATIR (okuma yolu). "Sessizce ham/rastgele seçime
  // düş" kararı yine ÇAĞIRANINDIR (OutfitSuggestion.jsx) — API dürüst kalır.
  async findByText(userId, text, { limit = TEXT_SEARCH_DEFAULT_LIMIT } = {}) {
    const trimmed = String(text ?? '').trim()
    if (!trimmed) {
      throw new ValidationError('Aranacak bir metin gönderilmedi')
    }

    if (!isEnabled()) {
      throw new ServiceUnavailableError('Vektör veritabanı devre dışı (VECTOR_STORE_ENABLED=false)')
    }
    if (!isConfigured()) {
      throw new ServiceUnavailableError(
        'Gemini API anahtarı tanımlı değil. backend/.env içine GEMINI_API_KEY ekleyin.',
      )
    }

    const sinir = Math.min(
      Math.max(Math.floor(Number(limit)) || TEXT_SEARCH_DEFAULT_LIMIT, 1),
      TEXT_SEARCH_MAX_LIMIT,
    )

    let vektor
    try {
      const { vectors } = await this.#withDeadline(
        this.geminiService.createEmbeddings([trimmed]),
        'metin embedding',
      )
      vektor = vectors[0]
    } catch (error) {
      if (error instanceof ServiceUnavailableError) throw error
      console.error('Serbest metin embedding\'i üretilemedi:', error.message)
      throw new ServiceUnavailableError('Vektör araması şu anda yapılamıyor')
    }

    // KULLANICI FİLTRESİ ZORUNLU (findSimilar/findCompanions ile aynı gerekçe):
    // filtresiz bir vektör sorgusu başka kullanıcıların gardıroplarından
    // sonuç döndürürdü.
    let komsular
    try {
      komsular = await this.#withDeadline(
        this.vectorRepository.query({ embedding: vektor, limit: sinir, userId }),
        'benzerlik sorgusu',
      )
    } catch (error) {
      if (error instanceof ServiceUnavailableError) throw error
      console.error('Serbest metin araması başarısız:', error.message)
      throw new ServiceUnavailableError('Vektör veritabanına şu anda ulaşılamıyor')
    }

    // Postgres zenginleştirmesi YOK: çağıran (OutfitSuggestion.jsx) gardırobu
    // zaten tamamen belleğinde tutuyor — yalnızca id + benzerlik skoru yeterli,
    // ekstra bir veritabanı turu gereksiz olurdu.
    return {
      indekslendi: true,
      sonuclar: komsular.map((row) => ({
        id: row.id,
        category_id: row.categoryId ?? null,
        mesafe: row.distance,
        benzerlik: row.distance === null ? null : Number((1 - row.distance).toFixed(4)),
      })),
    }
  }

  // "1,2,4" ya da [1, 2, 4] → [1, 2, 4]. Geçersiz/yinelenen değerler düşer.
  #parseCategoryIds(raw) {
    const parcalar = Array.isArray(raw) ? raw : String(raw ?? '').split(',')
    const ids = parcalar
      .map((value) => Number(String(value).trim()))
      .filter((value) => Number.isInteger(value) && value > 0)
    return [...new Set(ids)]
  }

  // Parçanın kendi vektörünü okur. Veritabanına ulaşılamıyorsa 503 (findSimilar
  // ve findCompanions aynı yolu kullanır).
  async #readOwnVector(itemId) {
    try {
      return await this.vectorRepository.getEmbedding(itemId)
    } catch (error) {
      console.error('Benzer arama için vektör okunamadı:', error.message)
      throw new ServiceUnavailableError('Vektör veritabanına şu anda ulaşılamıyor')
    }
  }

  // Sorgu beklenmedik şekilde asılı kalırsa (ör. veritabanı o an aşırı
  // yüklüyse) öneri ekranı süresiz beklememeli — bu sınır genel bir güvenlik
  // ağıdır (bkz. COMPANION_TIMEOUT_MS tanımındaki not).
  #withDeadline(promise, label) {
    let zamanlayici
    const sinir = new Promise((_, reject) => {
      zamanlayici = setTimeout(
        () =>
          reject(
            new ServiceUnavailableError(
              `Vektör veritabanı zamanında yanıt vermedi (${label}, ${COMPANION_TIMEOUT_MS} ms)`,
            ),
          ),
        COMPANION_TIMEOUT_MS,
      )
    })

    return Promise.race([promise, sinir]).finally(() => clearTimeout(zamanlayici))
  }

  #skip(itemId, sebep) {
    console.log(`Embedding atlandı (${itemId}): ${sebep}`)
    return { durum: DURUM.ATLANDI, sebep }
  }
}

module.exports = VectorService
module.exports.DURUM = DURUM
module.exports.RATE_LIMIT_COOLDOWN_MS = RATE_LIMIT_COOLDOWN_MS
module.exports.MAX_ATTEMPTS = MAX_ATTEMPTS
module.exports.MAX_DOCUMENT_LENGTH = MAX_DOCUMENT_LENGTH
module.exports.BATCH_SIZE = BATCH_SIZE
module.exports.COMPANION_TIMEOUT_MS = COMPANION_TIMEOUT_MS
module.exports.COMPANION_DEFAULT_LIMIT = COMPANION_DEFAULT_LIMIT
module.exports.COMPANION_MAX_LIMIT = COMPANION_MAX_LIMIT
module.exports.TEXT_SEARCH_DEFAULT_LIMIT = TEXT_SEARCH_DEFAULT_LIMIT
module.exports.TEXT_SEARCH_MAX_LIMIT = TEXT_SEARCH_MAX_LIMIT
