// Postgres (pgvector) ile konuşan TEK katman. Rolü diğer repository'lerle
// AYNIDIR: yalnızca veri erişimi, iş kuralı yok, hatayı loglayıp YENİDEN
// FIRLATIR. ChromaDB'nin yerini aldı (bkz. CLAUDE.md §9, 2026-08-27 kaydı) —
// dış bir istemci/host/port yok, doğrudan paylaşılan `pool` kullanılır.
//
// Bu katman embedding ÜRETMEZ — hazır vektörü alır, saklar ve arar. Üretim
// VectorService'in işidir; böylece "hangi model, hangi metin" kararı
// depolama kodundan ayrı kalır (ChromaDB döneminden değişmeyen tek ilke).

// pgvector `vector` sütunu `pg` sürücüsünde tip kaydı yapılmadığı için metin
// olarak gelir/gider: `'[0.1,0.2,-0.3]'`. Bu biçim AYNI ZAMANDA geçerli bir
// JSON dizisidir, bu yüzden okurken `JSON.parse` yeterlidir — ayrı bir
// `pgvector` npm paketi eklenmedi (WeatherRepository/EmailRepository'nin
// "native fetch yeter, SDK gereksiz" ilkesiyle aynı gerekçe).
function toVectorLiteral(embedding) {
  return `[${embedding.join(',')}]`
}

function fromVectorLiteral(raw) {
  if (raw === null || raw === undefined) return null
  return JSON.parse(raw)
}

class VectorRepository {
  constructor(pool) {
    this.pool = pool
  }

  // Bağlantı sağlıklı mı? (/health ve test scriptlerinin "bağlantı" bölümü
  // için.) Chroma döneminde ayrı bir servisti; artık aynı pool'u paylaştığı
  // için bu yalnızca basit bir sorgu ile doğrulanır.
  async heartbeat() {
    try {
      await this.pool.query('SELECT 1')
      return true
    } catch (error) {
      console.error('VectorRepository.heartbeat hatası:', error.message)
      throw error
    }
  }

  // Tek bir kıyafetin vektörünü yazar/günceller (upsert).
  // ID olarak KIYAFETİN VERİTABANI id'si kullanılır (ChromaDB döneminde de
  // böyleydi): ayrı bir eşleme tablosu gerekmez, aynı parça iki kez
  // indekslenirse üzerine yazılır.
  async upsertItem({ id, embedding, document, metadata }) {
    try {
      await this.pool.query(
        `INSERT INTO clothing_item_embeddings
           (clothing_item_id, user_id, category_id, embedding, document, embedding_model, sema)
         VALUES ($1, $2, $3, $4::vector, $5, $6, $7)
         ON CONFLICT (clothing_item_id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           category_id = EXCLUDED.category_id,
           embedding = EXCLUDED.embedding,
           document = EXCLUDED.document,
           embedding_model = EXCLUDED.embedding_model,
           sema = EXCLUDED.sema,
           created_at = NOW()`,
        [
          id,
          metadata.user_id,
          metadata.category_id,
          toVectorLiteral(embedding),
          document,
          metadata.embedding_modeli ?? null,
          metadata.sema ?? null,
        ],
      )
      return true
    } catch (error) {
      console.error('VectorRepository.upsertItem hatası:', error.message)
      throw error
    }
  }

  // Bir kıyafetin kendi vektörünü okur (findSimilar/findCompanions'ın
  // "başlangıç parçasının vektörünü oku" adımı). Kayıt yoksa `null` döner —
  // hata değildir, "henüz indekslenmemiş" demektir.
  async getEmbedding(id) {
    try {
      const result = await this.pool.query(
        'SELECT embedding FROM clothing_item_embeddings WHERE clothing_item_id = $1',
        [id],
      )
      if (result.rows.length === 0) return null
      return fromVectorLiteral(result.rows[0].embedding)
    } catch (error) {
      console.error('VectorRepository.getEmbedding hatası:', error.message)
      throw error
    }
  }

  // En yakın komşular. Kullanıcı izolasyonu BURADA DEĞİL çağıran katmanda
  // kurulur ama `userId` olmadan asla sorgulanmamalıdır (bkz.
  // VectorService.findSimilar/findCompanions/findByText) — bu yüzden
  // `userId` ZORUNLU bir parametredir, ChromaDB'deki serbest `where` DSL'i
  // gibi opsiyonel bir filtre değildir.
  //
  // `<=>` pgvector'ın kosinüs MESAFE operatörüdür (0 = birebir aynı yön) —
  // ChromaDB'nin koleksiyonu `cosine` uzayında açılmasıyla AYNI ölçüt,
  // sonuçlar birebir karşılaştırılabilir kalır.
  async query({ embedding, limit, userId, categoryId = null }) {
    try {
      const vectorLiteral = toVectorLiteral(embedding)
      const result =
        categoryId === null
          ? await this.pool.query(
              `SELECT clothing_item_id AS id, category_id, document,
                      embedding <=> $1::vector AS distance
               FROM clothing_item_embeddings
               WHERE user_id = $2
               ORDER BY embedding <=> $1::vector
               LIMIT $3`,
              [vectorLiteral, userId, limit],
            )
          : await this.pool.query(
              `SELECT clothing_item_id AS id, category_id, document,
                      embedding <=> $1::vector AS distance
               FROM clothing_item_embeddings
               WHERE user_id = $2 AND category_id = $3
               ORDER BY embedding <=> $1::vector
               LIMIT $4`,
              [vectorLiteral, userId, categoryId, limit],
            )

      return result.rows.map((row) => ({
        id: row.id,
        distance: row.distance === null ? null : Number(row.distance),
        document: row.document,
        categoryId: row.category_id,
      }))
    } catch (error) {
      console.error('VectorRepository.query hatası:', error.message)
      throw error
    }
  }

  // Bir kıyafetin vektörü var mı? (Toplu script "hangileri eksik" derken kullanır.)
  async getExistingIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return new Set()

    try {
      const result = await this.pool.query(
        'SELECT clothing_item_id FROM clothing_item_embeddings WHERE clothing_item_id = ANY($1::uuid[])',
        [ids],
      )
      return new Set(result.rows.map((row) => row.clothing_item_id))
    } catch (error) {
      console.error('VectorRepository.getExistingIds hatası:', error.message)
      throw error
    }
  }

  async deleteItems(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return true

    try {
      await this.pool.query(
        'DELETE FROM clothing_item_embeddings WHERE clothing_item_id = ANY($1::uuid[])',
        [ids],
      )
      return true
    } catch (error) {
      console.error('VectorRepository.deleteItems hatası:', error.message)
      throw error
    }
  }

  async count() {
    try {
      const result = await this.pool.query('SELECT COUNT(*)::int AS count FROM clothing_item_embeddings')
      return result.rows[0].count
    } catch (error) {
      console.error('VectorRepository.count hatası:', error.message)
      throw error
    }
  }

  // Tüm embedding'leri siler. Embedding modeli değiştiğinde gerekir: farklı
  // modellerin vektörleri aynı uzayda olmadığı için tablo karışık kalırsa
  // mesafeler anlamsızlaşır (bkz. config/gemini.js) — ChromaDB'deki
  // "koleksiyonu sil"in karşılığı.
  async dropCollection() {
    try {
      await this.pool.query('TRUNCATE clothing_item_embeddings')
      return true
    } catch (error) {
      console.error('VectorRepository.dropCollection hatası:', error.message)
      throw error
    }
  }
}

module.exports = VectorRepository
