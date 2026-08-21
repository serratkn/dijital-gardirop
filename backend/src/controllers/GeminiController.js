const BaseController = require('./BaseController')

class GeminiController extends BaseController {
  constructor(geminiService) {
    super()
    this.geminiService = geminiService
  }

  async testAnalyze(req, res) {
    try {
      const result = await this.geminiService.analyzeClothingImage(req.file)
      res.status(200).json(result)
    } catch (error) {
      // BaseController tipli hataları kendi statusCode'una çevirir;
      // ServiceUnavailableError burada 503 + açıklayıcı Türkçe mesaj olur.
      this.handleError(error, res)
    }
  }
}

module.exports = GeminiController
