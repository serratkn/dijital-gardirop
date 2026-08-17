class CategoryRepository {
  constructor(pool) {
    this.pool = pool
  }

  async findAll() {
    try {
      const result = await this.pool.query(
        'SELECT * FROM categories WHERE is_active = true ORDER BY id',
      )
      return result.rows
    } catch (error) {
      console.error('CategoryRepository.findAll hatası:', error.message)
      throw error
    }
  }

  async findById(id) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM categories WHERE id = $1 AND is_active = true',
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('CategoryRepository.findById hatası:', error.message)
      throw error
    }
  }
}

module.exports = CategoryRepository
