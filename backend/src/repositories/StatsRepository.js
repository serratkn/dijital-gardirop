// Gardırop istatistikleri. Hesaplama TAMAMEN SQL'de yapılır: frontend'e ham
// kayıt değil hazır özet gider (binlerce parçalı bir gardıropta bile yanıt sabit
// boyutta kalır).
//
// Metodlar bilinçli olarak KÜÇÜK ve TEK KONULU tutuldu. İleride "premium analiz
// raporu" eklenirken yeni bir metod yazılıp servis tarafında özete eklenmesi
// yeterli olsun diye; mevcut sorgulara dokunmak gerekmez.
//
// Not: COUNT(*) Postgres'te bigint döner ve pg sürücüsü bunu STRING'e çevirir.
// Her sayım ::int ile daraltılır — aksi hâlde yanıtta "12" (metin) çıkardı.
class StatsRepository {
  constructor(pool) {
    this.pool = pool
  }

  // Parça sayıları tek satırda: toplam, favori, temiz, kirli.
  // is_favorite nullable olduğu için "= true" ile karşılaştırılır;
  // is_clean NOT NULL ama aynı açık biçim tutarlılık için korunur.
  async getItemSummary(userId) {
    try {
      const result = await this.pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE is_favorite = true)::int AS favorite,
                COUNT(*) FILTER (WHERE is_clean = true)::int AS clean,
                COUNT(*) FILTER (WHERE is_clean = false)::int AS dirty
         FROM clothing_items
         WHERE user_id = $1 AND is_deleted = false`,
        [userId],
      )
      return result.rows[0]
    } catch (error) {
      console.error('StatsRepository.getItemSummary hatası:', error.message)
      throw error
    }
  }

  // Kategori dağılımı. INNER JOIN bilinçli: parçası olmayan kategori listede
  // hiç görünmez ("0 Makyaj" satırı özeti gereksiz uzatırdı).
  async getCategoryDistribution(userId) {
    try {
      const result = await this.pool.query(
        `SELECT c.id AS category_id, c.name, c.icon, COUNT(ci.id)::int AS count
         FROM categories c
         JOIN clothing_items ci
           ON ci.category_id = c.id
          AND ci.user_id = $1
          AND ci.is_deleted = false
         GROUP BY c.id, c.name, c.icon
         ORDER BY count DESC, c.id ASC`,
        [userId],
      )
      return result.rows
    } catch (error) {
      console.error('StatsRepository.getCategoryDistribution hatası:', error.message)
      throw error
    }
  }

  // En sık geçen renk. Eşitlikte ada göre alfabetik sıralanır — ikincil
  // sıralama olmasaydı aynı veri için farklı yanıtlar dönebilir ve test
  // rastgele kırılırdı.
  async getTopColor(userId) {
    try {
      const result = await this.pool.query(
        `SELECT color AS name, COUNT(*)::int AS count
         FROM clothing_items
         WHERE user_id = $1
           AND is_deleted = false
           AND color IS NOT NULL
           AND btrim(color) <> ''
         GROUP BY color
         ORDER BY count DESC, color ASC
         LIMIT 1`,
        [userId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('StatsRepository.getTopColor hatası:', error.message)
      throw error
    }
  }

  async getOutfitSummary(userId) {
    try {
      const result = await this.pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE is_favorite = true)::int AS favorite,
                COALESCE(SUM(times_worn), 0)::int AS total_worn
         FROM outfits
         WHERE user_id = $1`,
        [userId],
      )
      return result.rows[0]
    } catch (error) {
      console.error('StatsRepository.getOutfitSummary hatası:', error.message)
      throw error
    }
  }

  // En çok oluşturulan kombin durumu. occasion NULL olabilir (durum girilmeden
  // kaydedilen kombinler) — bunlar "en çok" yarışına hiç girmez.
  async getTopOccasion(userId) {
    try {
      const result = await this.pool.query(
        `SELECT occasion AS name, COUNT(*)::int AS count
         FROM outfits
         WHERE user_id = $1
           AND occasion IS NOT NULL
           AND btrim(occasion) <> ''
         GROUP BY occasion
         ORDER BY count DESC, occasion ASC
         LIMIT 1`,
        [userId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('StatsRepository.getTopOccasion hatası:', error.message)
      throw error
    }
  }
}

module.exports = StatsRepository
