const fs = require('node:fs')
const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors')
const { removeUploadedFile, fileNameFromImageUrl } = require('../config/upload')

// Ten tonu analizi orkestrasyonu.
//
// SÖZLEŞME: FIRLATIR. ClothingAnalysisService'in tam TERSİ ve gerekçesi de
// tersi: orada analiz, kıyafet ekleme akışının üstüne konan bir zenginleştirme
// ve kimse beklemiyor; burada kullanıcı selfie'sini yükleyip ekrana bakıyor,
// tek beklediği şey bu sonuç. Sessizce boş dönmek yanlış olurdu.
// (Aynı ölçüt GeminiService ↔ WeatherService arasında da geçerli.)
//
// GEÇİCİ hatalar için sınırlı yeniden deneme (ClothingAnalysisService ile
// aynı gerekçe ve aynı sınır): ölçümde aynı model aynı görsel için bir koşuda
// 7 sn, bir koşuda 30 sn'yi aşarak zaman aşımına düştü — bu dalgalanma modelin
// normal davranışı ve testin ilk gerçek denemesinde de yaşandı. Kullanıcı
// ekranda beklediği için sınır 2: geçersiz anahtar / kota gibi KALICI
// hatalarda zaten hiç denenmez (isRetryable false).
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 1000

// ÖZELLİK TAMAMEN İSTEĞE BAĞLIDIR: kullanıcı hiç selfie yüklemeden
// uygulamanın her yerini kullanabilir. Bu servis hiçbir başka akışa bağlı
// değildir; kolonlar NULL kalır ve hiçbir yerde eksiklik doğurmaz.
class SkinToneService {
  constructor(userRepository, geminiService) {
    this.userRepository = userRepository
    this.geminiService = geminiService

    // MALİYET KORUMASI: aynı kullanıcı için eşzamanlı iki analiz (çift
    // tıklama, iki sekme) iki Gemini çağrısı demekti. İşaret İLK await'TEN
    // ÖNCE konur — sonra konsaydı iki istek de muhafızı geçerdi
    // (bu hata Aşama 2'de bir kez yaşandı, aynısını tekrarlamıyoruz).
    this.inFlight = new Set()
  }

  // Mevcut analiz. Yoksa alanlar null döner — bu bir HATA DEĞİLDİR,
  // "kullanıcı henüz yapmadı" demektir.
  async getAnalysis(userId) {
    const row = await this.userRepository.findSkinTone(userId)
    if (!row) throw new NotFoundError('Kullanıcı bulunamadı')

    return {
      analiz: row.skin_tone_analysis ?? null,
      foto_url: row.skin_tone_photo_url ?? null,
    }
  }

  // Selfie'yi analiz eder ve sonucu kaydeder. Mevcut analizin ÜZERİNE yazar
  // (bu ucun tek modu zaten "yeniden analiz"dir: kullanıcı her seferinde yeni
  // bir fotoğraf yüklüyor).
  async analyze(userId, file) {
    if (!file) throw new ValidationError('Selfie fotoğrafı gönderilmedi')

    if (this.inFlight.has(userId)) {
      // Yüklenen dosya çöp olmasın.
      await removeUploadedFile(file.filename)
      throw new ConflictError('Ten tonu analiziniz şu anda sürüyor, lütfen bekleyin')
    }

    this.inFlight.add(userId)
    try {
      const mevcut = await this.userRepository.findSkinTone(userId)
      if (!mevcut) {
        await removeUploadedFile(file.filename)
        throw new NotFoundError('Kullanıcı bulunamadı')
      }

      let sonuc
      try {
        // multer diskStorage dosyayı zaten yazdı; Gemini'ye göndermek için
        // geri okuyoruz. (Bellekten okuyup başarıda yazmak da olurdu ama
        // depodaki fotoğraf deseni diskStorage + HATA HÂLİNDE GERİ ALMA'dır;
        // aynı disiplini izliyoruz.)
        const buffer = await fs.promises.readFile(file.path)
        sonuc = await this.#analyzeWithRetry({ buffer, mimetype: file.mimetype })
      } catch (error) {
        // Gemini hatası, kota, zaman aşımı, dosya okunamadı… Hepsinde YENİ
        // DOSYA GERİ ALINIR: öksüz selfie diskte kalmaz.
        await removeUploadedFile(file.filename)
        throw error
      }

      // Yüz okunamadı: bu bir SİSTEM HATASI DEĞİL, kullanıcının daha iyi bir
      // fotoğraf çekmesi gereken normal bir durum. 400 + yönlendirici mesaj.
      if (!sonuc.yuz_tespit_edildi) {
        await removeUploadedFile(file.filename)
        throw new ValidationError(
          sonuc.sorun
            ? `${sonuc.sorun}. Yüzünüzün net göründüğü, iyi aydınlatılmış bir fotoğrafla tekrar deneyin.`
            : 'Fotoğrafta ten tonu okunabilecek bir yüz bulunamadı. Yüzünüzün net göründüğü, iyi aydınlatılmış bir fotoğrafla tekrar deneyin.',
        )
      }

      const analiz = {
        model: sonuc.model,
        analiz_tarihi: sonuc.analiz_tarihi,
        veri: sonuc.veri,
      }
      // Göreli yol saklanır (kıyafet fotoğraflarıyla aynı kural): web
      // localhost'tan, Android 10.0.2.2'den erişir; host'u istemci ekler.
      const photoUrl = `/uploads/${file.filename}`

      let guncel
      try {
        guncel = await this.userRepository.updateSkinTone(userId, { analysis: analiz, photoUrl })
      } catch (error) {
        await removeUploadedFile(file.filename)
        throw error
      }

      // Yazma başarılı: ARTIK eski selfie'yi silebiliriz. Sıra önemli —
      // önce silseydik ve yazma patlasaydı kullanıcı hem eski hem yeni
      // fotoğrafını kaybederdi.
      if (mevcut.skin_tone_photo_url) {
        await removeUploadedFile(fileNameFromImageUrl(mevcut.skin_tone_photo_url))
      }

      return {
        analiz: guncel.skin_tone_analysis,
        foto_url: guncel.skin_tone_photo_url,
      }
    } finally {
      this.inFlight.delete(userId)
    }
  }

  // Yalnızca GEÇİCİ hatalar yeniden denenir (zaman aşımı, 5xx, çözülemeyen
  // JSON). Kota ve geçersiz anahtar tekrar denemekle düzelmez; ikinci çağrı
  // yalnızca kalan kotayı harcardı.
  async #analyzeWithRetry(file) {
    let sonHata
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.geminiService.analyzeSkinTone(file)
      } catch (error) {
        sonHata = error
        if (error?.isRateLimited || !error?.isRetryable || attempt === MAX_ATTEMPTS) break

        console.warn(
          `Ten tonu analizi geçici hata verdi, yeniden deneniyor ` +
            `(${attempt}/${MAX_ATTEMPTS}): ${error.message}`,
        )
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
    throw sonHata
  }

  // Analizi ve selfie'yi tamamen kaldırır. Hassas veri için "silebilmek"
  // pazarlık konusu değil.
  async remove(userId) {
    const mevcut = await this.userRepository.findSkinTone(userId)
    if (!mevcut) throw new NotFoundError('Kullanıcı bulunamadı')

    await this.userRepository.updateSkinTone(userId, { analysis: null, photoUrl: null })

    if (mevcut.skin_tone_photo_url) {
      await removeUploadedFile(fileNameFromImageUrl(mevcut.skin_tone_photo_url))
    }

    return { analiz: null, foto_url: null }
  }
}

module.exports = SkinToneService
module.exports.MAX_ATTEMPTS = MAX_ATTEMPTS
