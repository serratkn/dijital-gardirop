-- JWT refresh token sistemi. Access token artık KISA ömürlü (varsayılan
-- 15 dakika, bkz. backend/.env > JWT_EXPIRES_IN); kullanıcı oturumunun asıl
-- süresi (7-30 gün, varsayılan 30 gün > REFRESH_TOKEN_EXPIRES_IN) bu iki yeni
-- kolonla taşınır ve arka planda otomatik yenilenir (bkz. AuthService.refresh,
-- frontend/src/lib/api.js > tryRefreshSession).
--
-- KOLON ADI BİLEREK `refresh_token` DEĞİL `refresh_token_hash`dır —
-- `password_hash` ile AYNI kural: kolonda asla DÜZ METİN token durmaz,
-- yalnızca bcrypt özeti. Ham token yalnızca ÜRETİLDİĞİ anda (login/register/
-- refresh yanıtında) BİR KEZ istemciye gönderilir; sunucu tarafında bir daha
-- görünmez — çalınan bir veritabanı yedeği tek başına oturum ele geçirmeye
-- yetmez.
--
-- Kullanıcı başına TEK bir aktif refresh token vardır (ayrı bir "sessions"
-- tablosu değil, users satırının kendisinde) — bu depodaki tek-satır-tek-
-- kullanıcı deseniyle (password_hash, skin_tone_photo_url) tutarlıdır.
-- Bilinçli sınırlama: yeni bir cihazda/tarayıcıda giriş yapmak ÖNCEKİ
-- refresh token'ı geçersiz kılar (üzerine yazar). Çoklu-cihaz oturum yönetimi
-- bu uygulamanın kapsamı dışında bırakıldı (bkz. CLAUDE.md).
ALTER TABLE users
    ADD COLUMN refresh_token_hash VARCHAR(500),
    ADD COLUMN refresh_token_expires_at TIMESTAMP;

COMMENT ON COLUMN users.refresh_token_hash IS
    'bcrypt(refresh token). NULL = aktif bir refresh token yok (çıkış yapılmış ya da hiç giriş yapılmamış). Ham token asla saklanmaz, yalnızca üretildiği anda istemciye döner.';

COMMENT ON COLUMN users.refresh_token_expires_at IS
    'Refresh token bu tarihten SONRA geçersizdir. Her başarılı /auth/refresh çağrısı bu tarihi NOW() + REFRESH_TOKEN_EXPIRES_IN olarak yeniler (kayan pencere) — aktif kullanan bir kullanıcı süresiz oturumda kalabilir.';
