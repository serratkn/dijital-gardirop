// password_hash BİLİNÇLİ olarak dışarıda: RETURNING * kullanmak
// parola özetini API yanıtına sızdırır.
const SAFE_COLUMNS = `
  id, name, email, email_verified, age, city, subscription_tier, created_at, updated_at
`

class UserRepository {
  constructor(pool) {
    this.pool = pool
  }

  async findById(id) {
    try {
      const result = await this.pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findById hatası:', error.message)
      throw error
    }
  }

  async findByEmail(email) {
    try {
      const result = await this.pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users WHERE email = $1`,
        [email],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findByEmail hatası:', error.message)
      throw error
    }
  }

  async create(data) {
    try {
      const { name, email, age, city, passwordHash } = data
      const result = await this.pool.query(
        `INSERT INTO users (name, email, age, city, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SAFE_COLUMNS}`,
        [name, email, age, city ?? null, passwordHash ?? null],
      )
      return result.rows[0]
    } catch (error) {
      console.error('UserRepository.create hatası:', error.message)
      throw error
    }
  }

  // Yalnızca kimlik doğrulama için: parola özetini de döndüren TEK metod.
  // Dönen nesne asla doğrudan API yanıtına verilmemelidir.
  async findByEmailForAuth(email) {
    try {
      const result = await this.pool.query(
        `SELECT ${SAFE_COLUMNS}, password_hash FROM users WHERE email = $1`,
        [email],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findByEmailForAuth hatası:', error.message)
      throw error
    }
  }

  async findByIdForAuth(id) {
    try {
      const result = await this.pool.query(
        `SELECT ${SAFE_COLUMNS}, password_hash FROM users WHERE id = $1`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findByIdForAuth hatası:', error.message)
      throw error
    }
  }

  async updatePassword(id, passwordHash) {
    try {
      const result = await this.pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING ${SAFE_COLUMNS}`,
        [passwordHash, id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.updatePassword hatası:', error.message)
      throw error
    }
  }

  async update(id, data) {
    try {
      const { name, email, age, city, subscriptionTier } = data
      const result = await this.pool.query(
        `UPDATE users
         SET name = $1, email = $2, age = $3, city = $4,
             subscription_tier = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING ${SAFE_COLUMNS}`,
        [name, email, age, city, subscriptionTier, id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.update hatası:', error.message)
      throw error
    }
  }

  // --- Ten tonu analizi ---
  //
  // Bu iki kolon SAFE_COLUMNS'A BİLEREK EKLENMEDİ. Selfie yolu hassas veridir
  // ve analiz nesnesi de büyükçedir; /auth/me, /users/:id gibi HER kullanıcı
  // yanıtında taşınmalarının bir sebebi yok. Yalnızca kendi ucundan okunurlar.
  async findSkinTone(userId) {
    try {
      const result = await this.pool.query(
        'SELECT id, skin_tone_analysis, skin_tone_photo_url FROM users WHERE id = $1',
        [userId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findSkinTone hatası:', error.message)
      throw error
    }
  }

  async updateSkinTone(userId, { analysis, photoUrl }) {
    try {
      const result = await this.pool.query(
        `UPDATE users
         SET skin_tone_analysis = $1, skin_tone_photo_url = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, skin_tone_analysis, skin_tone_photo_url`,
        [analysis, photoUrl, userId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.updateSkinTone hatası:', error.message)
      throw error
    }
  }

  async delete(id) {
    try {
      const result = await this.pool.query(
        `DELETE FROM users WHERE id = $1 RETURNING ${SAFE_COLUMNS}`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.delete hatası:', error.message)
      throw error
    }
  }
}

module.exports = UserRepository
