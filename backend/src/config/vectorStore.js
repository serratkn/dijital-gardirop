// Vektör depolama artık ChromaDB DEĞİL, aynı Postgres veritabanının içindeki
// pgvector uzantısı ve `clothing_item_embeddings` tablosudur (bkz. CLAUDE.md
// §9, 2026-08-27 kaydı — "ChromaDB'den pgvector'a geçiş"). Bu yüzden
// config/chroma.js'teki host/port/istemci kurulumunun karşılığı burada YOK:
// VectorRepository doğrudan paylaşılan `pool`'u (config/database.js) kullanır,
// ayrı bir bağlantı/istemci gerekmez.

// Vektör katmanı yine de KAPATILABİLİR olmalı: pgvector uzantısı kurulu
// olmayan bir Postgres'te (ör. migration'ları henüz uygulamamış bir
// geliştirme ortamı) `CHROMA_ENABLED=false`'ın karşılığı budur.
function isEnabled() {
  return process.env.VECTOR_STORE_ENABLED?.trim().toLowerCase() !== 'false'
}

module.exports = { isEnabled }
