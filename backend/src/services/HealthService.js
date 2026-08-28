class HealthService {
  constructor(healthRepository) {
    this.healthRepository = healthRepository
  }

  async getStatus() {
    const status = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
      },
    }

    try {
      const dbTime = await this.healthRepository.checkConnection()
      status.database.connected = true
      status.database.time = dbTime
    } catch (error) {
      status.status = 'degraded'
      status.database.connected = false
      status.database.error = error.message
    }

    return status
  }
}

module.exports = HealthService
