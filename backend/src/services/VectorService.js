const { NotFoundError, ServiceUnavailableError } = require('../utils/errors')
const { isConfigured } = require('../config/gemini')
const { isEnabled } = require('../config/chroma')

// Vektör veritabanı iş mantığı (Gemini Aşama 3).
//
// İKİ AYRI SÖZLEŞME — hangi yolun kullanıldığına bağlı:
//
//   YAZMA (indexItem / removeItem): ASLA FIRLATMAZ. Embedding üretimi, kıyafet
//   ekleme akışının parçası değil üstüne konan bir zenginleştirmedir; Chroma
//   kapalıysa, kota dolduysa veya ağ düştüyse kıyafet kaydı ve analizi yerinde
//   durur, kullanıcı hiçbir şey görmez. (ClothingAnalysisService ile aynı ilke.)
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

// Chroma'da saklanan özet metnin üst sınırı. Embedding modeli çok daha uzununu
// kabul eder ama özet zaten kısa alan etiketlerinden üretiliyor; sınır yalnızca
// bozuk bir analizin devasa bir belgeye dönüşmesini engelliyor.
const MAX_DOCUMENT_LENGTH = 2000

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
  indexItemInBackground(itemId) {
    return this.indexItem(itemId).catch((error) => {
      // Buraya normalde hiç düşülmez (indexItem yutar); son güvenlik ağı.
      console.error('Embedding beklenmedik şekilde hata verdi:', error?.message)
      return { durum: DURUM.BASARISIZ, sebep: 'beklenmeyen-hata' }
    })
  }

  async indexItem(itemId, { force = false } = {}) {
    if (!isEnabled()) return this.#skip(itemId, 'chroma-devre-disi')
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
          // Chroma'ya ulaşılamıyorsa zaten yazma da başarısız olacak.
          console.error(`Embedding kontrolü başarısız (${itemId}):`, error.message)
          return { durum: DURUM.BASARISIZ, sebep: 'chroma-erisilemiyor' }
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
        // is_favorite buraya konsaydı kullanıcı her toggle'da Chroma'yı da
        // güncellemek zorunda kalırdı; kalmasaydı filtre bayat veriyle çalışırdı.
        // Değişken durum her zaman Postgres'ten okunur.
        metadata: {
          user_id: item.user_id,
          category_id: item.category_id,
          sema: item.ai_analysis?.sema ?? 'bilinmiyor',
          embedding_modeli: embeddingModel,
          olusturma: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error(`Embedding ChromaDB'ye yazılamadı (${item.id}):`, error.message)
      return { durum: DURUM.BASARISIZ, sebep: 'chroma-yazma-hatasi' }
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
      itemIds.forEach((id) => sonuclar.set(id, { durum: DURUM.ATLANDI, sebep: 'chroma-devre-disi' }))
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
          sonuclar.set(id, { durum: DURUM.BASARISIZ, sebep: 'chroma-erisilemiyor' }),
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
          console.error(`Embedding ChromaDB'ye yazılamadı (${item.id}):`, error.message)
          sonuclar.set(item.id, { durum: DURUM.BASARISIZ, sebep: 'chroma-yazma-hatasi' })
        }
      }
    }

    return sonuclar
  }

  // Kıyafet silindiğinde vektörü de gitmeli; yoksa benzer aramasında var
  // olmayan bir parça dönerdi. Bu da fırlatmaz: silme işlemi Chroma yüzünden
  // başarısız sayılmamalı.
  async removeItem(itemId) {
    if (!isEnabled()) return { durum: DURUM.ATLANDI, sebep: 'chroma-devre-disi' }

    try {
      await this.vectorRepository.deleteItems([itemId])
      return { durum: DURUM.TAMAMLANDI }
    } catch (error) {
      console.error(`Embedding silinemedi (${itemId}):`, error.message)
      return { durum: DURUM.BASARISIZ, sebep: 'chroma-silme-hatasi' }
    }
  }

  // ---- Okuma yolu (FIRLATIR) ----

  // Bir kıyafetin en yakın komşuları. Sonuçlar Postgres'ten zenginleştirilir:
  // çıplak id + mesafe listesi ne testte ne arayüzde işe yarardı.
  async findSimilar(itemId, userId, { limit = 5, categoryId = null } = {}) {
    const item = await this.clothingItemRepository.findById(itemId)

    // Başkasının parçası için 404 (deponun her yerindeki kalıp): 403 kaydın
    // var olduğunu ele verirdi.
    if (!item || item.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    if (!isEnabled()) {
      throw new ServiceUnavailableError('Vektör veritabanı devre dışı (CHROMA_ENABLED=false)')
    }

    // Parçanın KENDİ vektörü Chroma'da zaten var; yeniden embedding üretmek
    // gereksiz bir Gemini çağrısı (ve para) olurdu.
    let kendiVektor
    try {
      const collection = await this.vectorRepository.getCollection()
      const kayit = await collection.get({ ids: [itemId], include: ['embeddings'] })
      kendiVektor = kayit?.embeddings?.[0] ?? null
    } catch (error) {
      console.error('Benzer arama için vektör okunamadı:', error.message)
      throw new ServiceUnavailableError('Vektör veritabanına şu anda ulaşılamıyor')
    }

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
    // gardıroplarından sonuç döndürürdü.
    const where =
      categoryId === null
        ? { user_id: userId }
        : { $and: [{ user_id: userId }, { category_id: Number(categoryId) }] }

    // Parçanın kendisi daima en yakın komşusudur (mesafe 0); bir fazla isteyip
    // kendisini eliyoruz. Chroma'nın $ne filtresine güvenmek yerine böyle
    // yapmak, filtre söz diziminden bağımsız ve okunması kolay.
    const komsular = await this.vectorRepository.query({
      embedding: kendiVektor,
      limit: Number(limit) + 1,
      where,
    })

    const digerleri = komsular.filter((row) => row.id !== itemId).slice(0, Number(limit))

    // Postgres'ten zenginleştir. Silinmiş parçalar findById'de null döner ve
    // listeden düşer: Chroma'da bayat bir kayıt kalsa bile yanıta sızmaz.
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
