-- style_preferences mantıksal olarak "kullanıcı başına tek tercih seti" tutar.
-- UNIQUE kısıtı olmadan hem aynı kullanıcı için çift kayıt oluşabilir
-- hem de atomik upsert (ON CONFLICT) yazılamaz.
ALTER TABLE style_preferences
    ADD CONSTRAINT style_preferences_user_id_key UNIQUE (user_id);

-- PostgreSQL foreign key'ler için otomatik index oluşturmaz.
-- outfit_items her kombin sorgusunda JOIN edildiği için bu index gerekli.
CREATE INDEX idx_outfit_items_outfit_id ON outfit_items(outfit_id);
CREATE INDEX idx_outfit_items_clothing_item_id ON outfit_items(clothing_item_id);
