class HealthRepository {
  constructor(pool) {
    this.pool = pool
  }

  async checkConnection() {
    const result = await this.pool.query('SELECT NOW() AS current_time')
    return result.rows[0].current_time
  }
}

module.exports = HealthRepository
