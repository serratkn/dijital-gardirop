-- Şifre sıfırlama akışı. `refresh_token_hash` / `refresh_token_expires_at`
-- (migration 007) ile BİREBİR AYNI desen: opak, tek kullanımlık bir token;
-- veritabanında yalnızca bcrypt özeti tutulur, ham değer ASLA saklanmaz.
--
-- Nullable ve varsayılansız: normal zamanda her iki kolon da NULL'dır —
-- yalnızca aktif bir sıfırlama isteği sürerken dolu olur, kullanıldıktan
-- (ya da süresi dolduktan) sonra tekrar NULL'a döner.
ALTER TABLE users
    ADD COLUMN reset_token_hash VARCHAR(255),
    ADD COLUMN reset_token_expires_at TIMESTAMP;
