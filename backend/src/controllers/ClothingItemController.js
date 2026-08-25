const BaseController = require('./BaseController')
const { removeUploadedFile } = require('../config/upload')

class ClothingItemController extends BaseController {
  // clothingAnalysisService ve vectorService OPSİYONELDİR: verilmezse fotoğraf
  // yükleme eskisi gibi çalışır, yalnızca otomatik analiz / embedding devreye
  // girmez. Testlerin ve bu davranışı kapatmak isteyen bir kurulumun işini
  // kolaylaştırır.
  constructor(clothingItemService, clothingAnalysisService = null, vectorService = null) {
    super()
    this.clothingItemService = clothingItemService
    this.clothingAnalysisService = clothingAnalysisService
    this.vectorService = vectorService
  }

  async getAll(req, res) {
    try {
      const { categoryId } = req.query
      const items = await this.clothingItemService.getItems(req.userId, categoryId)
      res.status(200).json(items)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async getById(req, res) {
    try {
      const item = await this.clothingItemService.getItemById(req.params.id, req.userId)
      res.status(200).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async create(req, res) {
    try {
      const item = await this.clothingItemService.createItem({ ...req.body, userId: req.userId })
      res.status(201).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async update(req, res) {
    try {
      const item = await this.clothingItemService.updateItem(req.params.id, req.body, req.userId)
      res.status(200).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async delete(req, res) {
    try {
      await this.clothingItemService.deleteItem(req.params.id, req.userId)
      res.status(204).send()

      // Kıyafet gidince vektörü de gitmeli; kalsaydı benzer aramasında artık
      // var olmayan bir parça dönerdi. Yanıttan SONRA ve await EDİLMEDEN:
      // silme işlemi ChromaDB yüzünden yavaşlamamalı ya da başarısız olmamalı.
      this.vectorService?.removeItem(req.params.id)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  // AŞAMA 3 — DOĞRULAMA UCU. Bir kıyafetin vektör uzayındaki en yakın
  // komşularını döndürür. Henüz hiçbir ürün akışına (Kombin Öner dahil)
  // bağlı DEĞİLDİR; embedding'lerin gerçekten anlamlı olup olmadığını
  // gözle görmek için var.
  async getSimilar(req, res) {
    try {
      if (!this.vectorService) {
        return res.status(503).json({ error: 'Vektör veritabanı bu kurulumda etkin değil' })
      }

      const result = await this.vectorService.findSimilar(req.params.id, req.userId, {
        limit: this.#parseLimit(req.query.limit),
        categoryId: req.query.categoryId ?? null,
      })
      res.status(200).json(result)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  // "Yeniden Analiz Et" — mevcut analizin ÜZERİNE yazar (force).
  //
  // BU UÇ, deponun "önce cevapla, sonra çalış" kuralından BİLİNÇLİ SAPMADIR.
  // Fotoğraf yüklemede analiz arka planda çalışır çünkü kullanıcı fotoğrafı
  // bırakıp işine bakar; burada ise düğmeye basıp ekrana bakıyor ve sonucu
  // bekliyor. 202 + yoklama yolu, arayüze "yeni analiz geldi mi" sorusunu
  // çözdürmek zorunda bırakırdı (kolon zaten dolu, null kontrolü işe yaramaz).
  //
  // ClothingAnalysisService ASLA FIRLATMAZ; sonucu `durum` nesnesiyle bildirir.
  // Çeviri burada yapılır çünkü HTTP anlamı bir sınır kararıdır.
  async reanalyze(req, res) {
    try {
      if (!this.clothingAnalysisService) {
        return res.status(503).json({ error: 'Yapay zekâ analizi bu kurulumda etkin değil' })
      }

      // SAHİPLİK: analyzeItem yalnızca id ile çalışır, kullanıcıya bakmaz.
      // Kontrol burada yapılmazsa bir kullanıcı başkasının parçası için
      // Gemini çağrısı tetikleyebilirdi. Başkasının kaydı 404 döner.
      await this.clothingItemService.getItemById(req.params.id, req.userId)

      const sonuc = await this.clothingAnalysisService.analyzeItem(req.params.id, { force: true })

      if (sonuc.durum === 'tamamlandi') {
        // Kayıt YENİDEN OKUNUR: yanıt, JSONB'nin sakladığı hâli taşımalı
        // (kolon anahtar sırasını korumaz) ve arayüz doğrudan bunu basar.
        const item = await this.clothingItemService.getItemById(req.params.id, req.userId)
        return res.status(200).json(item)
      }

      const { statusCode, error } = this.#reanalyzeError(sonuc.sebep)
      res.status(statusCode).json({ error })
    } catch (error) {
      this.handleError(error, res)
    }
  }

  // Servisin `sebep` kodlarını kullanıcıya gösterilebilir Türkçe mesajlara
  // çevirir. HAM SEBEP KODU DIŞARI SIZMAZ.
  //
  // Hepsinin ortak yanı: BU YOLLARIN HİÇBİRİ mevcut analizi silmez. #run
  // yalnızca başarıda yazar, dolayısıyla hata hâlinde eski analiz yerinde
  // kalır — arayüz de bu yüzden eski veriyi ekranda tutabiliyor.
  #reanalyzeError(sebep) {
    switch (sebep) {
      case 'zaten-analiz-ediliyor':
        // Çift tıklama / iki sekme. 409, "boşuna deneme" demenin doğru yolu.
        return { statusCode: 409, error: 'Bu parça şu anda analiz ediliyor, lütfen bekleyin' }
      case 'fotograf-yok':
        return { statusCode: 400, error: 'Analiz için önce bir fotoğraf eklemelisiniz' }
      case 'dosya-diskte-yok':
      case 'desteklenmeyen-dosya-turu':
        return { statusCode: 400, error: 'Fotoğraf okunamadı, yeniden yüklemeyi deneyin' }
      case 'kayit-yok':
      case 'kayit-analiz-sirasinda-silindi':
        return { statusCode: 404, error: 'Kıyafet bulunamadı' }
      case 'anahtar-yok':
        return { statusCode: 503, error: 'Yapay zekâ servisi bu kurulumda tanımlı değil' }
      case 'kota':
      case 'kota-soğuma-suresi':
        return {
          statusCode: 503,
          error: 'Yapay zekâ kotası şu anda dolu, biraz sonra tekrar deneyin',
        }
      default:
        // gemini-hatasi, yazma-hatasi, hazirlik-hatasi ve beklenmeyenler.
        return {
          statusCode: 503,
          error: 'Analiz şu anda yapılamadı, mevcut analiz korundu',
        }
    }
  }

  // AŞAMA 4 — Kombin Öner'in RETRIEVAL ucu. Bir başlangıç parçası verilir,
  // istenen diğer kategorilerin her birinden en yakın adaylar döner.
  //
  // Bu uç KASITLI OLARAK "dürüst"tür: Chroma erişilemezse 503 döner, boş liste
  // değil. Rastgele seçime düşme kararı istemcinindir (Kombin Öner sayfası
  // hatayı yutup mevcut rastgele mantığa döner ve "akıllı seçim" rozetini
  // GÖSTERMEZ). Uç sessizce boş dönseydi arayüz aradaki farkı bilemezdi.
  async getCompanions(req, res) {
    try {
      if (!this.vectorService) {
        return res.status(503).json({ error: 'Vektör veritabanı bu kurulumda etkin değil' })
      }

      const result = await this.vectorService.findCompanions(req.params.id, req.userId, {
        categoryIds: req.query.categoryIds,
        limit: this.#parseLimit(req.query.limit),
      })
      res.status(200).json(result)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  // Sınır makul bir aralığa çekilir: `?limit=100000` Chroma'yı gereksiz
  // yere zorlar, `?limit=abc` ise NaN olarak sorguya gidip patlardı.
  #parseLimit(raw) {
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 1) return 5
    return Math.min(Math.floor(value), 20)
  }

  // AŞAMA 5 — Kombin Öner'in serbest metin yorumlamasını besleyen ikinci
  // RETRIEVAL ucu. getCompanions'tan farkı: bir başlangıç PARÇASI değil,
  // kullanıcının serbest metnini (arama_metni) alır ve kullanıcının TÜM
  // indekslenmiş gardırobunu bu metne yakınlığa göre sıralar — HER ÇAĞRIDA
  // gerçek bir Gemini embedding isteği atar (getSimilar/getCompanions atmaz).
  // Bu yüzden geminiLimiter'ın ARKASINDA mount edilir (bkz. clothingItemRoutes.js).
  async searchByText(req, res) {
    try {
      if (!this.vectorService) {
        return res.status(503).json({ error: 'Vektör veritabanı bu kurulumda etkin değil' })
      }

      const result = await this.vectorService.findByText(req.userId, req.body?.text, {
        limit: req.body?.limit,
      })
      res.status(200).json(result)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async toggleFavorite(req, res) {
    try {
      const item = await this.clothingItemService.toggleFavorite(req.params.id, req.userId)
      res.status(200).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async toggleCleanStatus(req, res) {
    try {
      const item = await this.clothingItemService.toggleCleanStatus(req.params.id, req.userId)
      res.status(200).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async uploadImage(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'Fotoğraf dosyası zorunludur' })
    }

    // Tam URL değil GÖRELİ yol saklanır: web localhost'tan, Android
    // 10.0.2.2'den erişir; host'u istemci kendi tarafında ekler.
    const imageUrl = `/uploads/${req.file.filename}`

    try {
      const item = await this.clothingItemService.setImage(req.params.id, req.userId, imageUrl)

      // Yanıt ÖNCE gönderilir: analiz saniyeler sürebilir, kullanıcı onu
      // beklememelidir. Bu "önce cevapla, sonra çalış" kararı HTTP sınırına
      // aittir; servis katmanı isteğin ne zaman bittiğini bilmez.
      res.status(200).json(item)

      // BİLEREK await EDİLMEZ. Servis asla fırlatmaz, ama yine de çağrı
      // buradaki try/catch'in DIŞINDA sayılmalı: hata olsa bile yanıt çoktan
      // gönderilmiştir ve fotoğraf yükleme başarılıdır.
      this.clothingAnalysisService?.analyzeItemInBackground(req.params.id)
    } catch (error) {
      // Kayıt güncellenemediyse (yetki/doğrulama hatası) diske yazılmış dosya
      // öksüz kalmamalı.
      await removeUploadedFile(req.file.filename)
      this.handleError(error, res)
    }
  }

  async deleteImage(req, res) {
    try {
      const item = await this.clothingItemService.removeImage(req.params.id, req.userId)
      res.status(200).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = ClothingItemController
