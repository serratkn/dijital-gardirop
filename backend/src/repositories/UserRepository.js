// password_hash BİLİNÇLİ olarak dışarıda: RETURNING * kullanmak
// parola özetini API yanıtına sızdırır.
const SAFE_COLUMNS = `
  id, name, email, email_verified, age, subscription_tier, created_at, updated_at
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
      const { name, email, age, passwordHash } = data
      const result = await this.pool.query(
        `INSERT INTO users (name, email, age, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING ${SAFE_COLUMNS}`,
        [name, email, age, passwordHash ?? null],
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
      const { name, email, age, subscriptionTier } = data
      const result = await this.pool.query(
        `UPDATE users
         SET name = $1, email = $2, age = $3, subscription_tier = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING ${SAFE_COLUMNS}`,
        [name, email, age, subscriptionTier, id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.update hatası:', error.message)
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
