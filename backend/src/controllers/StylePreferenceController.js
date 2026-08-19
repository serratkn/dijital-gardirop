const BaseController = require('./BaseController')

class StylePreferenceController extends BaseController {
  constructor(stylePreferenceService) {
    super()
    this.stylePreferenceService = stylePreferenceService
  }

  async getByUserId(req, res) {
    try {
      const preferences = await this.stylePreferenceService.getByUserId(req.userId)
      res.status(200).json(preferences)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async save(req, res) {
    try {
      const preferences = await this.stylePreferenceService.savePreferences({ ...req.body, userId: req.userId })
      res.status(200).json(preferences)
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = StylePreferenceController
