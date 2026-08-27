-- Kullanım başına maliyet (cost-per-wear) özelliği için: kullanıcının bir
-- parçaya ne kadar ödediği, isteğe bağlı olarak girilir. NUMERIC(10,2)
-- kuruş/cent hassasiyeti için — para birimi INTEGER'a (kuruşsuz) ya da FLOAT'a
-- (yuvarlama hatası riski) bilerek kondulmadı.
ALTER TABLE clothing_items
    ADD COLUMN purchase_price NUMERIC(10, 2);

COMMENT ON COLUMN clothing_items.purchase_price IS
    'Kullanıcının parça için ödediği tutar (TL). NULL = fiyat girilmedi, kullanım başına maliyet hesaplanamaz.';
