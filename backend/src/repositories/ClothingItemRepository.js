class ClothingItemRepository {
  constructor(pool) {
    this.pool = pool
  }

  async findAll(userId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM clothing_items WHERE user_id = $1 AND is_deleted = false ORDER BY created_at DESC',
        [userId],
      )
      return result.rows
    } catch (error) {
      console.error('ClothingItemRepository.findAll hatası:', error.message)
      throw error
    }
  }

  async findById(id) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM clothing_items WHERE id = $1 AND is_deleted = false',
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('ClothingItemRepository.findById hatası:', error.message)
      throw error
    }
  }

  async findByCategory(userId, categoryId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM clothing_items WHERE user_id = $1 AND category_id = $2 AND is_deleted = false ORDER BY created_at DESC',
        [userId, categoryId],
      )
      return result.rows
    } catch (error) {
      console.error('ClothingItemRepository.findByCategory hatası:', error.message)
      throw error
    }
  }

  async create(data) {
    try {
      const { userId, categoryId, name, color, brand, season, imageUrl } = data
      const result = await this.pool.query(
        `INSERT INTO clothing_items (user_id, category_id, name, color, brand, season, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, categoryId, name, color, brand, season, imageUrl],
      )
      return result.rows[0]
    } catch (error) {
      console.error('ClothingItemRepository.create hatası:', error.message)
      throw error
    }
  }

  async update(id, data) {
    try {
      const { categoryId, name, color, brand, season, imageUrl } = data
      const result = await this.pool.query(
        `UPDATE clothing_items
         SET category_id = $1, name = $2, color = $3, brand = $4, season = $5, image_url = $6, updated_at = NOW()
         WHERE id = $7 AND is_deleted = false
         RETURNING *`,
        [categoryId, name, color, brand, season, imageUrl, id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('ClothingItemRepository.update hatası:', error.message)
      throw error
    }
  }

  // Yalnızca fotoğraf alanını günceller; null göndermek fotoğrafı kaldırır.
  async updateImageUrl(id, imageUrl) {
    try {
      const result = await this.pool.query(
        `UPDATE clothing_items
         SET image_url = $1, updated_at = NOW()
         WHERE id = $2 AND is_deleted = false
         RETURNING *`,
        [imageUrl, id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('ClothingItemRepository.updateImageUrl hatası:', error.message)
      throw error
    }
  }

  async softDelete(id) {
    try {
      const result = await this.pool.query(
        `UPDATE clothing_items
         SET is_deleted = true, updated_at = NOW()
         WHERE id = $1 AND is_deleted = false
         RETURNING *`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('ClothingItemRepository.softDelete hatası:', error.message)
      throw error
    }
  }

  async toggleFavorite(id) {
    try {
      const result = await this.pool.query(
        `UPDATE clothing_items
         SET is_favorite = NOT is_favorite, updated_at = NOW()
         WHERE id = $1 AND is_deleted = false
         RETURNING *`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('ClothingItemRepository.toggleFavorite hatası:', error.message)
      throw error
    }
  }
}

module.exports = ClothingItemRepository
