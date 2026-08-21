-- Gemini'nin ürettiği otomatik kıyafet analizi (Aşama 2).
--
-- JSONB, TEXT değil: DBeaver'da ağaç olarak açılabiliyor, Postgres tarafında
-- sorgulanabiliyor (ai_analysis->'veri'->>'stil') ve anahtar sırası/boşluk
-- normalize ediliyor. Şema esnek kalmalı çünkü kategoriye göre DEĞİŞİYOR:
-- giyim, ayakkabı, çanta ve makyaj farklı alanlar taşır — sabit kolonlara
-- açmak altı ayrı tablo ya da onlarca çoğu boş kolon demekti.
--
-- NULLABLE ve varsayılansız, bilinçli olarak: analiz kıyafet kaydından SONRA,
-- arka planda çalışır. Gemini erişilemezse, kota dolarsa veya kullanıcı
-- fotoğrafsız parça eklerse kolon NULL kalır ve bu tamamen geçerli bir
-- durumdur — kıyafet ekleme akışı asla bu kolona bağlı değildir.
--
-- Saklanan biçim (bkz. GeminiService / ClothingAnalysisService):
--   { "sema": "giyim", "model": "gemini-3.6-flash",
--     "analiz_tarihi": "2026-08-21T…Z", "gardirop_kategorisi": "Üst",
--     "veri": { … kategoriye özgü analiz … } }
ALTER TABLE clothing_items
    ADD COLUMN ai_analysis JSONB;

-- DBeaver kolon açıklamasında görünür; şemayı kodda aramaya gerek kalmasın.
COMMENT ON COLUMN clothing_items.ai_analysis IS
    'Gemini otomatik analizi. NULL = henüz analiz edilmedi veya analiz başarısız oldu. Biçim: {sema, model, analiz_tarihi, gardirop_kategorisi, veri}';

-- KISMİ index: "henüz analiz edilmemiş, fotoğrafı olan parçalar" sorgusu
-- (toplu/yeniden analiz için) tablo taramasına düşmesin. Analiz edilmiş
-- satırlar index'e HİÇ girmediği için index küçük kalır.
CREATE INDEX idx_clothing_items_pending_analysis
    ON clothing_items (user_id)
    WHERE ai_analysis IS NULL AND image_url IS NOT NULL AND is_deleted = false;
