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

    // GEÇİCİ TEŞHİS — bkz. config/database.js > resolveSslOption yorumu.
    if (this.healthRepository.pool?.dgSslDebug) {
      status.database.sslDebug = this.healthRepository.pool.dgSslDebug
    }

    return status
  }
}

module.exports = HealthService
