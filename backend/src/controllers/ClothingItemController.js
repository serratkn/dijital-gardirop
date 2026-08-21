const BaseController = require('./BaseController')
const { removeUploadedFile } = require('../config/upload')

class ClothingItemController extends BaseController {
  // clothingAnalysisService OPSİYONELDİR: verilmezse fotoğraf yükleme eskisi
  // gibi çalışır, yalnızca otomatik analiz devreye girmez. Testlerin ve
  // ileride bu davranışı kapatmak isteyen bir kurulumun işini kolaylaştırır.
  constructor(clothingItemService, clothingAnalysisService = null) {
    super()
    this.clothingItemService = clothingItemService
    this.clothingAnalysisService = clothingAnalysisService
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
