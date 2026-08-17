const BaseController = require('./BaseController')

class HealthController extends BaseController {
  constructor(healthService) {
    super()
    this.healthService = healthService
  }

  async getHealth(req, res) {
    const status = await this.healthService.getStatus()
    const httpStatus = status.status === 'ok' ? 200 : 503
    res.status(httpStatus).json(status)
  }
}

module.exports = HealthController
