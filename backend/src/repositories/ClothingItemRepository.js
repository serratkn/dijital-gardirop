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

  // Birden çok id'yi TEK sorguda okur. Vektör araması kategori başına N aday
  // döndürüyor; her biri için ayrı findById atmak veritabanına onlarca tur
  // demekti ve bu yol kullanıcı öneriyi beklerken çalışıyor.
  //
  // Sıra KORUNMAZ: çağıran zaten benzerlik sırasını Chroma'dan biliyor ve
  // burada yalnızca id → kayıt eşlemesi kuruyor.
  async findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return []

    try {
      const result = await this.pool.query(
        'SELECT * FROM clothing_items WHERE id = ANY($1::uuid[]) AND is_deleted = false',
        [ids],
      )
      return result.rows
    } catch (error) {
      console.error('ClothingItemRepository.findByIds hatası:', error.message)
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

  // Ücretsiz plan sınırını uygulamak için (bkz. config/plans.js). Soft
  // delete edilmiş parçalar sayılmaz — kullanıcı bir parçayı silip yerine
  // yenisini ekleyebilmeli.
  async countActive(userId) {
    try {
      const result = await this.pool.query(
        'SELECT COUNT(*)::int AS count FROM clothing_items WHERE user_id = $1 AND is_deleted = false',
        [userId],
      )
      return result.rows[0].count
    } catch (error) {
      console.error('ClothingItemRepository.countActive hatası:', error.message)
      throw error
    }
  }

  async create(data) {
    try {
      const { userId, categoryId, name, color, brand, season, imageUrl, isClean } = data
      const result = await this.pool.query(
        `INSERT INTO clothing_items
           (user_id, category_id, name, color, brand, season, image_url, is_clean)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [userId, categoryId, name, color, brand, season, imageUrl, isClean],
      )
      return result.rows[0]
    } catch (error) {
      console.error('ClothingItemRepository.create hatası:', error.message)
      throw error
    }
  }

  async update(id, data) {
    try {
      const { categoryId, name, color, brand, season, imageUrl, isClean } = data
      const result = await this.pool.query(
        `UPDATE clothing_items
         SET category_id = $1, name = $2, color = $3, brand = $4, season = $5,
             image_url = $6, is_clean = $7, updated_at = NOW()
         WHERE id = $8 AND is_deleted = false
         RETURNING *`,
        [categoryId, name, color, brand, season, imageUrl, isClean, id],
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

  // Gemini analizini yazar (Aşama 2). Ayrı bir metod: analiz ARKA PLANDA,
  // kullanıcının isteğinden bağımsız bir anda tamamlanır — o sırada kaydın
  // diğer alanları başka bir istekle değişmiş olabilir, tam update onları ezerdi.
  //
  // updated_at BİLEREK dokunulmadan bırakılır: analiz kullanıcının yaptığı bir
  // düzenleme değildir, "son güncelleme" damgasını kaydırması yanıltıcı olurdu.
  async updateAiAnalysis(id, analysis) {
    try {
      const result = await this.pool.query(
        `UPDATE clothing_items
         SET ai_analysis = $1
         WHERE id = $2 AND is_deleted = false
         RETURNING *`,
        // JSONB kolona nesne DOĞRUDAN geçilemez; pg onu "[object Object]"
        // metnine çevirirdi. null geçmek analizi temizler (yeniden analiz yolu).
        [analysis === null ? null : JSON.stringify(analysis), id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('ClothingItemRepository.updateAiAnalysis hatası:', error.message)
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

  // Favori toggle'ıyla aynı desen: okuma + yazma yerine tek atomik UPDATE,
  // böylece iki eşzamanlı istek birbirinin değerini ezmez.
  async toggleCleanStatus(id) {
    try {
      const result = await this.pool.query(
        `UPDATE clothing_items
         SET is_clean = NOT is_clean, updated_at = NOW()
         WHERE id = $1 AND is_deleted = false
         RETURNING *`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('ClothingItemRepository.toggleCleanStatus hatası:', error.message)
      throw error
    }
  }
}

module.exports = ClothingItemRepository
