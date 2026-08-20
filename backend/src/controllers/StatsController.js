const BaseController = require('./BaseController')

class StatsController extends BaseController {
  constructor(statsService) {
    super()
    this.statsService = statsService
  }

  async getWardrobeStats(req, res) {
    try {
      const stats = await this.statsService.getWardrobeStats(req.params.id, req.userId)
      res.status(200).json(stats)
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = StatsController
