const BaseController = require('./BaseController')

// Ten tonu analizi — ince HTTP adaptörü.
//
// Kimlik DAİMA req.userId'den okunur; bu uçlarda ":id" parametresi YOKTUR.
// Bilinçli: selfie hassas veri ve "başkasının analizine bakma" ihtimalini
// yol seviyesinde tamamen ortadan kaldırmak, her seferinde sahiplik
// karşılaştırmasından daha güvenli.
class SkinToneController extends BaseController {
  constructor(skinToneService) {
    super()
    this.skinToneService = skinToneService
  }

  async get(req, res) {
    try {
      const sonuc = await this.skinToneService.getAnalysis(req.userId)
      res.status(200).json(sonuc)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  // SENKRON: kullanıcı selfie'sini yükledi ve sonucu bekliyor. (Fotoğraf
  // yüklemedeki "önce cevapla, sonra analiz et" kalıbı burada geçersiz —
  // orada analiz bir yan etkiydi, burada isteğin kendisi.)
  async analyze(req, res) {
    try {
      const sonuc = await this.skinToneService.analyze(req.userId, req.file)
      res.status(200).json(sonuc)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async remove(req, res) {
    try {
      const sonuc = await this.skinToneService.remove(req.userId)
      res.status(200).json(sonuc)
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = SkinToneController
