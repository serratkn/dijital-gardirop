const BaseController = require('./BaseController')
const { NotFoundError } = require('../utils/errors')

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

  // Selfie'yi express.static İLE DEĞİL, doğrudan buradan okuyup gönderir —
  // özelliğin tüm amacı bu: erişim yalnızca geçerli bir Bearer token'la
  // (authenticate middleware) ve yalnızca req.userId'nin KENDİ kaydıyla
  // mümkün olsun. Selfie hassas veri olduğu için paylaşılan/önbelleğe
  // alınan bir kopya istemiyoruz.
  async getPhoto(req, res) {
    try {
      const filePath = await this.skinToneService.getPhotoPath(req.userId)
      res.set('Cache-Control', 'private, max-age=0, no-store')
      res.sendFile(filePath, (error) => {
        // sendFile hata durumunda callback ile bildirir, fırlatmaz. Yanıt
        // BAŞLAMADIYSA (headersSent) 404'e çeviriyoruz; başladıysa (bağlantı
        // yarıda koptu vb.) yapacak bir şey yok, tekrar yanıt yazılamaz.
        if (error && !res.headersSent) {
          this.handleError(new NotFoundError('Selfie bulunamadı'), res)
        }
      })
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = SkinToneController
