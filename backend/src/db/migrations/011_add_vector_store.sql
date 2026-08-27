-- ChromaDB'den pgvector'a geçiş: vektör depolama artık AYRI bir servis
-- değil, bu veritabanının kendi içinde bir uzantı ve tablo (bkz. CLAUDE.md
-- §9, 2026-08-27 kaydı). Gerekçe: ChromaDB hiçbir zaman production'a
-- (Render) taşınmamıştı — yalnızca yerel Docker'da çalışıyordu, yani canlı
-- sitede "akıllı" kombin eşleştirmesi hep sessizce rastgele seçime
-- düşüyordu. Ayrı bir vektör servisini kalıcı diskle barındırmak yerine,
-- zaten taşınan/kalıcı olan Postgres'in içine taşımak hem "kaybolma" riskini
-- ortadan kaldırıyor hem de ayrı bir servisi ayakta tutma/ölçekleme
-- yükünü kaldırıyor.
CREATE EXTENSION IF NOT EXISTS vector;

-- 3072 boyut `gemini-embedding-001`e (varsayılan embedding modeli) sabittir.
-- EMBEDDING MODELİ DEĞİŞİRSE bu boyut da değişebilir — farklı modellerin
-- vektörleri aynı uzayda değildir (ChromaDB'deki "koleksiyonu sıfırla" kuralı
-- burada da geçerli, bkz. create-embeddings.js --sifirla --uygula karşılığı:
-- bu tabloyu TRUNCATE edip yeniden doldurmak gerekir).
CREATE TABLE clothing_item_embeddings (
    clothing_item_id UUID PRIMARY KEY REFERENCES clothing_items(id) ON DELETE CASCADE,
    -- user_id/category_id BİLEREK denormalize edilir (ChromaDB'deki metadata
    -- deseninin AYNISI): filtreleme için her sorguda clothing_items'a JOIN
    -- atmak yerine doğrudan bu tablodan okunur. Bir parça yeniden
    -- kategorilendirilirse (PUT ile) bu kolon YENİDEN İNDEKSLEME'ye kadar
    -- bayatlar — ChromaDB'deki metadata'nın da aynı sınırı vardı, yeni bir
    -- gerileme değil.
    user_id UUID NOT NULL,
    category_id INTEGER NOT NULL,
    embedding vector(3072) NOT NULL,
    -- Embedding'in ÜRETİLDİĞİ cümle (VectorService.buildSummaryText). Neyin
    -- embed edildiğini sonradan okuyabilmek için saklanır (ChromaDB'nin
    -- "document" alanının karşılığı).
    document TEXT NOT NULL,
    embedding_model VARCHAR(100),
    -- Kullanılan analiz şeması (giyim/ayakkabi/canta/makyaj) — yalnızca
    -- teşhis amaçlı, hiçbir sorguda filtre olarak kullanılmaz.
    sema VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- `WHERE user_id = $1` her sorguda zorunlu (kullanıcı izolasyonu) — index
-- olmadan tam tablo taraması gerekirdi. `(user_id, category_id)` bileşik
-- index'i companions/similar'ın kategori filtreli yolunu da kapsar.
CREATE INDEX idx_clothing_item_embeddings_user_id ON clothing_item_embeddings (user_id);
CREATE INDEX idx_clothing_item_embeddings_user_category ON clothing_item_embeddings (user_id, category_id);

-- BİLEREK bir ANN index'i (ivfflat/hnsw) YOK. Kişisel bir gardırop
-- kullanıcı başına onlarca/yüzlerce parça taşır; `user_id` ile daraltılmış
-- birkaç yüz satır üzerinde sıralı (brute-force) kosinüs taraması
-- milisaniyeler sürer. Bir ANN index'i bu ölçekte gereksiz karmaşıklık
-- (üstelik pgvector'un HNSW index'i varsayılan olarak 2000 boyutla
-- sınırlıdır, 3072 boyutlu bu embedding'ler için ek yapılandırma isterdi).
