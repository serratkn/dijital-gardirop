const BaseController = require('./BaseController')

class OutfitController extends BaseController {
  // geminiService yalnızca interpretRequest içindir; outfits CRUD'una hiç
  // karışmaz. OutfitService'ten ayrı tutulması bilinçli: biri veritabanı
  // katmanı, diğeri dış bir çağrı — ClothingItemController'ın
  // vectorService/clothingAnalysisService'i ayrı tutmasıyla aynı desen.
  constructor(outfitService, geminiService) {
    super()
    this.outfitService = outfitService
    this.geminiService = geminiService
  }

  async getAll(req, res) {
    try {
      const outfits = await this.outfitService.getOutfits(
        req.userId,
        req.query.clothingItemId,
      )
      res.status(200).json(outfits)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async getById(req, res) {
    try {
      const outfit = await this.outfitService.getOutfitById(req.params.id, req.userId)
      res.status(200).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async create(req, res) {
    try {
      const outfit = await this.outfitService.createOutfit({ ...req.body, userId: req.userId })
      res.status(201).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async update(req, res) {
    try {
      const outfit = await this.outfitService.updateOutfit(req.params.id, req.body, req.userId)
      res.status(200).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async delete(req, res) {
    try {
      await this.outfitService.deleteOutfit(req.params.id, req.userId)
      res.status(204).send()
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async toggleFavorite(req, res) {
    try {
      const outfit = await this.outfitService.toggleFavorite(req.params.id, req.userId)
      res.status(200).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async markAsWorn(req, res) {
    try {
      const outfit = await this.outfitService.markAsWorn(req.params.id, req.userId)
      res.status(200).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  // Kombin Öner'deki serbest metin kutusunun ucu. Sahiplik/kaynak KAVRAMI
  // YOKTUR — hiçbir şey kaydedilmez, yalnızca metin Gemini'ye gidip
  // yorumlanmış hâliyle döner. Hata (anahtar yok, kota dolu, Gemini
  // erişilemiyor) burada YUTULMAZ — dürüstçe fırlatılır; "sessizce mevcut
  // pill akışına düşme" kararı FRONTEND'e aittir (bu istek başarısız
  // olduğunda ham metni occasion olarak kullanmaya devam eder).
  async interpretRequest(req, res) {
    try {
      const result = await this.geminiService.interpretOutfitRequest(req.body?.text)
      res.status(200).json(result)
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = OutfitController
