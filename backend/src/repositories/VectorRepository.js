const {
  geminiEmbeddingFunction,
  getClient,
  getCollectionName,
  getHost,
  getPort,
} = require('../config/chroma')

// ChromaDB ile konuşan TEK katman. Rolü diğer repository'lerle aynıdır:
// yalnızca veri erişimi, iş kuralı yok, hatayı loglayıp YENİDEN FIRLATIR.
// (WeatherRepository ile aynı desen: dış servise bakar ama katman rolü değişmez.)
//
// Bu katman embedding ÜRETMEZ — hazır vektörü alır, saklar ve arar.
// Üretim VectorService'in işidir; böylece "hangi model, hangi metin" kararı
// depolama kodundan ayrı kalır.

// Dış servise yapılan istek SINIRSIZ BEKLEYEMEZ (WeatherService/GeminiService
// ile aynı kural). Chroma yerel ağda olduğu için 10 sn fazlasıyla yeterli;
// container yeni ayağa kalkıyorsa ilk istek biraz gecikebilir.
const REQUEST_TIMEOUT_MS = 10000

// Koleksiyon tanıtıcısı önbelleklenir: her yazmada getOrCreateCollection
// çağırmak Chroma'ya gereksiz bir tur atmak demekti.
let cachedCollection = null
let cachedKey = null

function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`ChromaDB yanıt vermedi (${label}, ${REQUEST_TIMEOUT_MS} ms)`)),
        REQUEST_TIMEOUT_MS,
      ),
    ),
  ])
}

class VectorRepository {
  // Koleksiyonu açar (yoksa oluşturur). Kosinüs uzayı burada sabitlenir.
  async getCollection() {
    const client = getClient()
    if (!client) {
      throw new Error('ChromaDB devre dışı (CHROMA_ENABLED=false)')
    }

    const key = `${getHost()}:${getPort()}/${getCollectionName()}`
    if (cachedCollection && cachedKey === key) return cachedCollection

    try {
      const collection = await withTimeout(
        client.getOrCreateCollection({
          name: getCollectionName(),
          embeddingFunction: geminiEmbeddingFunction,
          metadata: {
            // Koleksiyonun ne olduğu Chroma arayüzünden de okunabilsin.
            aciklama: 'Dijital Gardırop — kıyafet analizi embeddingleri',
          },
        }),
        'getOrCreateCollection',
      )
      cachedCollection = collection
      cachedKey = key
      return collection
    } catch (error) {
      console.error('VectorRepository.getCollection hatası:', error.message)
      throw error
    }
  }

  // Tek bir kıyafetin vektörünü yazar/günceller.
  // ID olarak KIYAFETİN VERİTABANI id'si kullanılır: ayrı bir eşleme tablosu
  // gerekmez ve aynı parça iki kez indekslenirse üzerine yazılır (upsert).
  async upsertItem({ id, embedding, document, metadata }) {
    try {
      const collection = await this.getCollection()
      await withTimeout(
        collection.upsert({
          ids: [id],
          embeddings: [embedding],
          documents: [document],
          metadatas: [metadata],
        }),
        'upsert',
      )
      return true
    } catch (error) {
      console.error('VectorRepository.upsertItem hatası:', error.message)
      throw error
    }
  }

  // En yakın komşular. `where` Chroma'nın metadata filtresidir; kullanıcı
  // izolasyonu BURADA DEĞİL çağıran katmanda kurulur ama filtre olmadan asla
  // sorgulanmamalıdır (bkz. VectorService.findSimilar).
  async query({ embedding, limit, where }) {
    try {
      const collection = await this.getCollection()
      const result = await withTimeout(
        collection.query({
          queryEmbeddings: [embedding],
          nResults: limit,
          where,
          include: ['metadatas', 'documents', 'distances'],
        }),
        'query',
      )

      // Chroma sonuçları "sorgu başına bir dizi" olarak döndürür; tek sorgu
      // gönderdiğimiz için ilk satırı düzleştirip sade bir liste veriyoruz.
      const ids = result.ids?.[0] ?? []
      return ids.map((id, index) => ({
        id,
        distance: result.distances?.[0]?.[index] ?? null,
        document: result.documents?.[0]?.[index] ?? null,
        metadata: result.metadatas?.[0]?.[index] ?? null,
      }))
    } catch (error) {
      console.error('VectorRepository.query hatası:', error.message)
      throw error
    }
  }

  // Bir kıyafetin vektörü var mı? (Toplu script "hangileri eksik" derken kullanır.)
  async getExistingIds(ids) {
    try {
      const collection = await this.getCollection()
      const result = await withTimeout(collection.get({ ids, include: [] }), 'get')
      return new Set(result?.ids ?? [])
    } catch (error) {
      console.error('VectorRepository.getExistingIds hatası:', error.message)
      throw error
    }
  }

  async deleteItems(ids) {
    try {
      const collection = await this.getCollection()
      await withTimeout(collection.delete({ ids }), 'delete')
      return true
    } catch (error) {
      console.error('VectorRepository.deleteItems hatası:', error.message)
      throw error
    }
  }

  async count() {
    try {
      const collection = await this.getCollection()
      return await withTimeout(collection.count(), 'count')
    } catch (error) {
      console.error('VectorRepository.count hatası:', error.message)
      throw error
    }
  }

  // Koleksiyonu tamamen siler. Embedding modeli değiştiğinde gerekir:
  // farklı modellerin vektörleri aynı uzayda olmadığı için koleksiyon
  // karışık kalırsa mesafeler anlamsızlaşır (bkz. config/gemini.js).
  async dropCollection() {
    const client = getClient()
    if (!client) throw new Error('ChromaDB devre dışı (CHROMA_ENABLED=false)')

    try {
      await withTimeout(client.deleteCollection({ name: getCollectionName() }), 'deleteCollection')
      VectorRepository.resetCache()
      return true
    } catch (error) {
      console.error('VectorRepository.dropCollection hatası:', error.message)
      throw error
    }
  }

  // Bağlantı sağlıklı mı? (/health ve test scriptleri için.)
  async heartbeat() {
    const client = getClient()
    if (!client) throw new Error('ChromaDB devre dışı (CHROMA_ENABLED=false)')

    try {
      return await withTimeout(client.heartbeat(), 'heartbeat')
    } catch (error) {
      console.error('VectorRepository.heartbeat hatası:', error.message)
      throw error
    }
  }

  // Yapılandırma değişince (testlerde) önbelleklenmiş koleksiyon bayatlar.
  static resetCache() {
    cachedCollection = null
    cachedKey = null
  }
}

module.exports = VectorRepository
module.exports.REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS
