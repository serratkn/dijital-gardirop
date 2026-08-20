// Kombinler parçalarıyla birlikte döner. Silinmiş kıyafetler JOIN koşulunda
// filtrelenir (WHERE'de değil) — böylece tüm parçaları silinmiş bir kombin de
// boş items dizisiyle dönmeye devam eder.
const SELECT_WITH_ITEMS = `
  SELECT o.*,
         COALESCE(
           json_agg(
             json_build_object(
               'id', ci.id,
               'name', ci.name,
               'category_id', ci.category_id,
               'color', ci.color,
               'image_url', ci.image_url
             ) ORDER BY ci.created_at
           ) FILTER (WHERE ci.id IS NOT NULL),
           '[]'
         ) AS items
  FROM outfits o
  LEFT JOIN outfit_items oi ON oi.outfit_id = o.id
  LEFT JOIN clothing_items ci ON ci.id = oi.clothing_item_id AND ci.is_deleted = false
`

class OutfitRepository {
  constructor(pool) {
    this.pool = pool
  }

  async findAll(userId) {
    try {
      const result = await this.pool.query(
        `${SELECT_WITH_ITEMS}
         WHERE o.user_id = $1
         GROUP BY o.id
         ORDER BY o.created_at DESC`,
        [userId],
      )
      return result.rows
    } catch (error) {
      console.error('OutfitRepository.findAll hatası:', error.message)
      throw error
    }
  }

  // Belirli bir kıyafetin geçtiği kombinler. Filtre EXISTS ile yazılır —
  // JOIN koşuluna eklenseydi dönen items dizisi yalnızca o parçaya inerdi,
  // oysa kartın kombinin TAMAMINI gösterebilmesi gerekir.
  // Silinmiş parça hiçbir kombinde geçmiyor sayılır (uygulamanın geri kalanıyla tutarlı).
  async findAllByClothingItem(userId, clothingItemId) {
    try {
      const result = await this.pool.query(
        `${SELECT_WITH_ITEMS}
         WHERE o.user_id = $1
           AND EXISTS (
             SELECT 1
             FROM outfit_items f
             JOIN clothing_items fci
               ON fci.id = f.clothing_item_id AND fci.is_deleted = false
             WHERE f.outfit_id = o.id AND f.clothing_item_id = $2
           )
         GROUP BY o.id
         ORDER BY o.created_at DESC`,
        [userId, clothingItemId],
      )
      return result.rows
    } catch (error) {
      console.error('OutfitRepository.findAllByClothingItem hatası:', error.message)
      throw error
    }
  }

  async findById(id) {
    try {
      const result = await this.pool.query(
        `${SELECT_WITH_ITEMS}
         WHERE o.id = $1
         GROUP BY o.id`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('OutfitRepository.findById hatası:', error.message)
      throw error
    }
  }

  // Kullanıcının gerçekten sahip olduğu (ve silinmemiş) parça sayısını döner.
  // Service, başka kullanıcının kıyafetinin kombine eklenmesini bununla engeller.
  async countOwnedItems(userId, clothingItemIds) {
    try {
      const result = await this.pool.query(
        `SELECT COUNT(*)::int AS count
         FROM clothing_items
         WHERE user_id = $1 AND is_deleted = false AND id = ANY($2::uuid[])`,
        [userId, clothingItemIds],
      )
      return result.rows[0].count
    } catch (error) {
      console.error('OutfitRepository.countOwnedItems hatası:', error.message)
      throw error
    }
  }

  // Kombin ve parçaları tek transaction içinde yazılır; biri başarısız olursa
  // yarım kombin kalmaması için tamamı geri alınır.
  async create(data) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      const { userId, occasion, clothingItemIds } = data
      const outfitResult = await client.query(
        'INSERT INTO outfits (user_id, occasion) VALUES ($1, $2) RETURNING id',
        [userId, occasion],
      )
      const outfitId = outfitResult.rows[0].id

      await client.query(
        `INSERT INTO outfit_items (outfit_id, clothing_item_id)
         SELECT $1, unnest($2::uuid[])`,
        [outfitId, clothingItemIds],
      )

      await client.query('COMMIT')
      return this.findById(outfitId)
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('OutfitRepository.create hatası:', error.message)
      throw error
    } finally {
      client.release()
    }
  }

  async update(id, data) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      const { occasion, clothingItemIds } = data
      const outfitResult = await client.query(
        'UPDATE outfits SET occasion = $1 WHERE id = $2 RETURNING id',
        [occasion, id],
      )

      if (outfitResult.rowCount === 0) {
        await client.query('ROLLBACK')
        return null
      }

      // Parça listesi verilmediyse mevcut parçalara dokunulmaz.
      if (clothingItemIds) {
        await client.query('DELETE FROM outfit_items WHERE outfit_id = $1', [id])
        await client.query(
          `INSERT INTO outfit_items (outfit_id, clothing_item_id)
           SELECT $1, unnest($2::uuid[])`,
          [id, clothingItemIds],
        )
      }

      await client.query('COMMIT')
      return this.findById(id)
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('OutfitRepository.update hatası:', error.message)
      throw error
    } finally {
      client.release()
    }
  }

  // outfit_items ON DELETE CASCADE ile birlikte silinir.
  async delete(id) {
    try {
      const result = await this.pool.query(
        'DELETE FROM outfits WHERE id = $1 RETURNING *',
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('OutfitRepository.delete hatası:', error.message)
      throw error
    }
  }

  async toggleFavorite(id) {
    try {
      const result = await this.pool.query(
        'UPDATE outfits SET is_favorite = NOT is_favorite WHERE id = $1 RETURNING id',
        [id],
      )
      return result.rowCount === 0 ? null : this.findById(id)
    } catch (error) {
      console.error('OutfitRepository.toggleFavorite hatası:', error.message)
      throw error
    }
  }

  async incrementTimesWorn(id) {
    try {
      const result = await this.pool.query(
        'UPDATE outfits SET times_worn = times_worn + 1 WHERE id = $1 RETURNING id',
        [id],
      )
      return result.rowCount === 0 ? null : this.findById(id)
    } catch (error) {
      console.error('OutfitRepository.incrementTimesWorn hatası:', error.message)
      throw error
    }
  }
}

module.exports = OutfitRepository
