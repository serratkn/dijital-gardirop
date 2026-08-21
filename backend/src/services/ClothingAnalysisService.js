const path = require('node:path')
const fs = require('node:fs')
const { UPLOAD_DIR, fileNameFromImageUrl, mimeTypeFromFileName } = require('../config/upload')
const { isConfigured } = require('../config/gemini')

// Otomatik kıyafet analizi (Gemini Aşama 2) orkestrasyonu.
//
// TEMEL SÖZLEŞME: BU SERVİS ASLA FIRLATMAZ.
// Analiz, kıyafet ekleme akışının bir PARÇASI DEĞİL, üstüne konan bir
// zenginleştirmedir. Gemini düşse, kota dolsa, dosya kaybolsa bile kıyafet
// kaydı yerinde durur ve kullanıcı hiçbir hata görmez — kolon NULL kalır.
// (WeatherService'teki "asla fırlatma" kuralının aynısı; farkı, orada
// kullanıcı yanıtı beklerken burada kimse beklemiyor.)
//
// Sonuç bir DURUM nesnesiyle bildirilir; testler ve loglar bunu okur.
const DURUM = {
  TAMAMLANDI: 'tamamlandi',
  ATLANDI: 'atlandi',
  BASARISIZ: 'basarisiz',
}

// Aynı anda kaç Gemini çağrısı yapılabileceği. Toplu bir yükleme (kullanıcı
// arka arkaya 10 parça ekler) tek seferde 10 eşzamanlı isteğe dönüşseydi
// ücretsiz kotanın dakikalık limiti anında dolardı; fazlası kuyrukta bekler.
const MAX_CONCURRENT = 2

// Kota/limit hatasından sonra yeni çağrı yapılmayan süre. Limit dolmuşken
// istek atmaya devam etmek kotayı geri getirmez, yalnızca gürültü üretir.
const RATE_LIMIT_COOLDOWN_MS = 60_000

// GEÇİCİ hatalar için toplam deneme sayısı ve denemeler arası bekleme.
// Ölçümde aynı model aynı fotoğraf için bir koşuda 6 sn, bir koşuda 30 sn'yi
// aşarak zaman aşımına düştü — bu dalgalanma modelin normal davranışı.
// Denemesiz bırakıldığında tek bir sıçrama parçayı KALICI olarak analizsiz
// bırakıyordu (yeniden deneyecek bir mekanizma yok, kolon dolu sayılmıyor
// ama tetikleyici de bir daha çalışmıyor).
//
// 2 ile sınırlı: geçersiz anahtar / kota gibi KALICI hatalarda zaten hiç
// denenmez (isRetryable false), dolayısıyla bu yalnızca gerçekten geçici
// durumlarda ikinci bir çağrı demektir.
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 1500

class ClothingAnalysisService {
  constructor(clothingItemRepository, categoryRepository, geminiService) {
    this.clothingItemRepository = clothingItemRepository
    this.categoryRepository = categoryRepository
    this.geminiService = geminiService

    // Aynı parça için eşzamanlı iki analiz başlamasın: kullanıcı fotoğrafı
    // hızlıca iki kez yüklerse iki Gemini çağrısı ve iki yazma olurdu.
    this.inFlight = new Set()

    this.running = 0
    this.queue = []
    this.cooldownUntil = 0
  }

  // Fotoğraf yüklendikten sonra çağrılır. BEKLENMEZ (await edilmez): HTTP
  // yanıtı çoktan gönderilmiştir, kullanıcı analiz bitene kadar bekletilmez.
  // Yine de dönen sözü test edebilmek için geri veriyoruz.
  analyzeItemInBackground(itemId) {
    return this.analyzeItem(itemId).catch((error) => {
      // Buraya normalde HİÇ düşülmez (analyzeItem yutar); son güvenlik ağı —
      // yakalanmamış bir promise reddi Node sürecini düşürebilirdi.
      console.error('AI analizi beklenmedik şekilde hata verdi:', error?.message)
      return { durum: DURUM.BASARISIZ, sebep: 'beklenmeyen-hata' }
    })
  }

  // Tek bir parçayı analiz eder. Fırlatmaz; her yolun sonunda bir durum döner.
  // force: mevcut analizin üzerine yazar (şu an arayüzde bir tetikleyicisi yok,
  // yeniden analiz ihtiyacı doğduğunda bağlanacak tek nokta burasıdır).
  async analyzeItem(itemId, { force = false } = {}) {
    if (!isConfigured()) {
      // Anahtar yoksa dış servise HİÇ gidilmez ve bu bir hata değildir:
      // anahtarsız kurulumda uygulamanın geri kalanı tam çalışır.
      return this.#skip(itemId, 'anahtar-yok')
    }

    if (Date.now() < this.cooldownUntil) {
      return this.#skip(itemId, 'kota-soğuma-suresi')
    }

    if (this.inFlight.has(itemId)) {
      return this.#skip(itemId, 'zaten-analiz-ediliyor')
    }

    // İşaretleme İLK await'TEN ÖNCE yapılmalıdır. Aşağıdaki #prepare
    // asenkron olduğu için, işaret ondan sonra konsaydı iki eşzamanlı
    // tetikleme de muhafızı geçer ve İKİ Gemini çağrısı yapılırdı.
    this.inFlight.add(itemId)
    try {
      let hazirlik
      try {
        hazirlik = await this.#prepare(itemId, force)
      } catch (error) {
        // Veritabanı/dosya sistemi hatası. Loglanır, yutulur.
        console.error(`AI analizi hazırlanamadı (${itemId}):`, error.message)
        return { durum: DURUM.BASARISIZ, sebep: 'hazirlik-hatasi' }
      }

      if (hazirlik.skip) return this.#skip(itemId, hazirlik.skip)

      // Eşzamanlılık sınırı: sıra gelene kadar bekle.
      return await this.#withSlot(() => this.#run(itemId, hazirlik))
    } finally {
      this.inFlight.delete(itemId)
    }
  }

  // Analiz için gereken her şeyi toplar ve atlanması gereken durumları saptar.
  async #prepare(itemId, force) {
    const item = await this.clothingItemRepository.findById(itemId)

    // Kayıt yoksa ya da bu arada silinmişse yapacak bir şey yok.
    if (!item) return { skip: 'kayit-yok' }

    // MALİYET KORUMASI: analiz zaten varsa Gemini'ye TEKRAR GİDİLMEZ.
    // Aynı parçanın her görüntülenmesinde/güncellenmesinde yeniden analiz
    // etmek, hiçbir yeni bilgi vermeden faturayı katlardı.
    if (item.ai_analysis && !force) return { skip: 'zaten-analiz-edilmis' }

    if (!item.image_url) return { skip: 'fotograf-yok' }

    const fileName = fileNameFromImageUrl(item.image_url)
    const mimetype = mimeTypeFromFileName(fileName)
    if (!mimetype) return { skip: 'desteklenmeyen-dosya-turu' }

    let buffer
    try {
      buffer = await fs.promises.readFile(path.join(UPLOAD_DIR, path.basename(fileName)))
    } catch (error) {
      // Dosya diskte yoksa (elle silinmiş, taşınmış) analiz yapılamaz.
      if (error.code === 'ENOENT') return { skip: 'dosya-diskte-yok' }
      throw error
    }

    // Kategori adı prompt'u belirler. Okunamazsa analiz iptal EDİLMEZ:
    // GeminiService tanımadığı kategoriyi en genel şemaya (giyim) düşürür.
    let categoryName = null
    try {
      const category = await this.categoryRepository.findById(item.category_id)
      categoryName = category?.name ?? null
    } catch (error) {
      console.error('AI analizi için kategori okunamadı:', error.message)
    }

    return { file: { buffer, mimetype }, categoryName }
  }

  async #run(itemId, { file, categoryName }) {
    const startedAt = Date.now()

    let analysis
    let sonHata

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        analysis = await this.geminiService.analyzeClothingItem(file, categoryName)
        sonHata = null
        break
      } catch (error) {
        sonHata = error

        // Kota hatası: soğuma başlat ve TEKRAR DENEME — limit dolmuşken
        // ikinci istek de reddedilir.
        if (error?.isRateLimited) {
          // Gemini kaç saniye beklenmesi gerektiğini söylüyorsa ona uyulur;
          // söylemiyorsa (ya da daha kısa bir süre veriyorsa) varsayılan
          // soğuma kullanılır. Servisin istediğinden ERKEN dönmek yeni bir
          // 429'dan başka bir şey getirmezdi.
          const bekleme = Math.max(RATE_LIMIT_COOLDOWN_MS, error?.retryAfterMs ?? 0)
          this.cooldownUntil = Date.now() + bekleme
          console.warn(
            `AI analizi kota sınırına takıldı; ${Math.round(bekleme / 1000)} sn boyunca yeni analiz yapılmayacak.`,
          )
          break
        }

        // Kalıcı hata (geçersiz anahtar, bulunamayan model): tekrar denemek
        // yalnızca kotayı harcardı.
        if (!error?.isRetryable || attempt === MAX_ATTEMPTS) break

        console.warn(
          `AI analizi geçici hata verdi (${itemId}), yeniden deneniyor ` +
            `(${attempt}/${MAX_ATTEMPTS}): ${error.message}`,
        )
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }

    if (sonHata) {
      // Gemini hatası (kota, zaman aşımı, geçersiz anahtar, bozuk JSON).
      // ai_analysis NULL kalır; kıyafet kaydı etkilenmez.
      console.error(`AI analizi başarısız (${itemId}): ${sonHata.message}`)
      return { durum: DURUM.BASARISIZ, sebep: sonHata?.isRateLimited ? 'kota' : 'gemini-hatasi' }
    }

    try {
      const updated = await this.clothingItemRepository.updateAiAnalysis(itemId, analysis)
      if (!updated) {
        // Analiz sürerken parça silinmiş olabilir; sonucu yazacak satır yok.
        return this.#skip(itemId, 'kayit-analiz-sirasinda-silindi')
      }
    } catch (error) {
      console.error(`AI analizi kaydedilemedi (${itemId}):`, error.message)
      return { durum: DURUM.BASARISIZ, sebep: 'yazma-hatasi' }
    }

    console.log(
      `AI analizi tamamlandı: ${itemId} (${categoryName ?? 'kategorisiz'}, ` +
        `şema=${analysis.sema}, ${Date.now() - startedAt} ms)`,
    )
    return { durum: DURUM.TAMAMLANDI, analiz: analysis }
  }

  // Basit semafor: aynı anda en fazla MAX_CONCURRENT iş çalışır, gerisi
  // kuyrukta bekler. Harici bir kuyruk kütüphanesi eklemeye değmeyecek kadar
  // küçük bir ihtiyaç.
  async #withSlot(task) {
    if (this.running >= MAX_CONCURRENT) {
      await new Promise((resolve) => this.queue.push(resolve))
    }

    this.running += 1
    try {
      return await task()
    } finally {
      this.running -= 1
      this.queue.shift()?.()
    }
  }

  #skip(itemId, sebep) {
    // Atlama normal bir sonuçtur, hata değil — bu yüzden console.error değil.
    console.log(`AI analizi atlandı (${itemId}): ${sebep}`)
    return { durum: DURUM.ATLANDI, sebep }
  }
}

module.exports = ClothingAnalysisService
module.exports.DURUM = DURUM
module.exports.MAX_CONCURRENT = MAX_CONCURRENT
module.exports.RATE_LIMIT_COOLDOWN_MS = RATE_LIMIT_COOLDOWN_MS
module.exports.MAX_ATTEMPTS = MAX_ATTEMPTS
