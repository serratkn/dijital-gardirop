-- Ten tonu analizi (Gemini). Kullanıcı isteğe bağlı olarak bir selfie yükler;
-- Gemini ten tonunu ve ona yakışan renkleri döndürür.
--
-- İKİ KOLON DA NULLABLE ve varsayılansız — bilinçli. Bu özellik TAMAMEN
-- İSTEĞE BAĞLIDIR: kullanıcı hiç selfie yüklemeden uygulamanın her yerini
-- kullanabilir. NULL "henüz yapmadı" demektir ve hiçbir akışı bloklamaz.
--
-- Saklanan biçim (bkz. GeminiService.analyzeSkinTone / SkinToneService):
--   { "model": "gemini-3.6-flash", "analiz_tarihi": "2026-08-23T…Z",
--     "veri": { "ten_tonu": "Sıcak", "ten_rengi_tanimi": "Açık buğday teni",
--               "uyumlu_renkler": [...], "uyumsuz_renkler": [...],
--               "uyumlu_metal_tonlari": ["Altın"], "genel_tavsiye": "…" } }
--
-- JSONB tercih edildi (ai_analysis ile aynı gerekçe): DBeaver'da ağaç olarak
-- açılabiliyor, `skin_tone_analysis->'veri'->>'ten_tonu'` ile sorgulanabiliyor.
-- NOT: JSONB anahtar SIRASINI KORUMAZ; gösterim sırası arayüzde tanımlıdır.
ALTER TABLE users
    ADD COLUMN skin_tone_analysis JSONB,
    ADD COLUMN skin_tone_photo_url VARCHAR(500);

COMMENT ON COLUMN users.skin_tone_analysis IS
    'Gemini ten tonu analizi. NULL = kullanıcı henüz selfie yüklemedi (özellik isteğe bağlıdır). Biçim: {model, analiz_tarihi, veri}';

-- HASSAS VERİ. Selfie yolu yalnızca kullanıcının KENDİSİNE döner; hiçbir
-- listeleme, istatistik ya da paylaşım akışında kullanılmaz. UserRepository'nin
-- SAFE_COLUMNS listesine de BİLEREK eklenmedi: /auth/me ve /users/:id
-- yanıtlarında görünmez, yalnızca kendi ucundan okunur.
COMMENT ON COLUMN users.skin_tone_photo_url IS
    'Selfie dosya yolu (göreli, /uploads/...). HASSAS: yalnızca sahibine döner, SAFE_COLUMNS dışındadır.';
