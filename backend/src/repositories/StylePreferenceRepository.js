class StylePreferenceRepository {
  constructor(pool) {
    this.pool = pool
  }

  async findByUserId(userId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM style_preferences WHERE user_id = $1',
        [userId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('StylePreferenceRepository.findByUserId hatası:', error.message)
      throw error
    }
  }

  // Kullanıcı başına tek kayıt tutulur; UNIQUE(user_id) kısıtı sayesinde
  // ekleme/güncelleme tek atomik sorguda yapılır (002 migration).
  async upsert(userId, data) {
    try {
      const { dailyStyle, colorPreference, priority, styleIcon, frequency } = data
      const result = await this.pool.query(
        `INSERT INTO style_preferences
           (user_id, daily_style, color_preference, priority, style_icon, frequency)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE
           SET daily_style = EXCLUDED.daily_style,
               color_preference = EXCLUDED.color_preference,
               priority = EXCLUDED.priority,
               style_icon = EXCLUDED.style_icon,
               frequency = EXCLUDED.frequency,
               updated_at = NOW()
         RETURNING *`,
        [userId, dailyStyle, colorPreference, priority, styleIcon, frequency],
      )
      return result.rows[0]
    } catch (error) {
      console.error('StylePreferenceRepository.upsert hatası:', error.message)
      throw error
    }
  }
}

module.exports = StylePreferenceRepository
