// password_hash BİLİNÇLİ olarak dışarıda: RETURNING * kullanmak
// parola özetini API yanıtına sızdırır.
const SAFE_COLUMNS = `
  id, name, email, email_verified, age, city, subscription_tier, created_at, updated_at
`

class UserRepository {
  constructor(pool) {
    this.pool = pool
  }

  async findById(id) {
    try {
      const result = await this.pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findById hatası:', error.message)
      throw error
    }
  }

  async findByEmail(email) {
    try {
      const result = await this.pool.query(
        `SELECT ${SAFE_COLUMNS} FROM users WHERE email = $1`,
        [email],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findByEmail hatası:', error.message)
      throw error
    }
  }

  async create(data) {
    try {
      const { name, email, age, city, passwordHash } = data
      const result = await this.pool.query(
        `INSERT INTO users (name, email, age, city, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SAFE_COLUMNS}`,
        [name, email, age, city ?? null, passwordHash ?? null],
      )
      return result.rows[0]
    } catch (error) {
      console.error('UserRepository.create hatası:', error.message)
      throw error
    }
  }

  // Yalnızca kimlik doğrulama için: parola özetini de döndüren TEK metod.
  // Dönen nesne asla doğrudan API yanıtına verilmemelidir.
  async findByEmailForAuth(email) {
    try {
      const result = await this.pool.query(
        `SELECT ${SAFE_COLUMNS}, password_hash FROM users WHERE email = $1`,
        [email],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findByEmailForAuth hatası:', error.message)
      throw error
    }
  }

  async findByIdForAuth(id) {
    try {
      const result = await this.pool.query(
        `SELECT ${SAFE_COLUMNS}, password_hash FROM users WHERE id = $1`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findByIdForAuth hatası:', error.message)
      throw error
    }
  }

  // --- Refresh token (bkz. AuthService.refresh) ---
  //
  // Bu üç metod da SAFE_COLUMNS KULLANMAZ: hiçbiri API yanıtına doğrudan
  // dönmez, yalnızca AuthService'in kendi iç akışında tüketilir. Ham token
  // asla parametre olarak buraya gelmez — çağıran taraf (AuthService)
  // bcrypt.hash sonucunu gönderir; bu repository yalnızca hash'i saklar.

  // Login/register/refresh sonrası YENİ bir refresh token yazılır (ROTASYON:
  // bir önceki hash bu satırla birlikte üzerine yazılıp geçersiz kalır).
  async setRefreshToken(userId, { hash, expiresAt }) {
    try {
      const result = await this.pool.query(
        `UPDATE users
         SET refresh_token_hash = $1, refresh_token_expires_at = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id`,
        [hash, expiresAt, userId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.setRefreshToken hatası:', error.message)
      throw error
    }
  }

  // Refresh token OPAK bir dizedir (bcrypt hash'i sorgulanamaz — her hash'leme
  // farklı salt üretir); bu yüzden AuthService token'ın içine gömülü user id'yi
  // önce çıkarır, sonra SADECE O KULLANICININ hash'ini burada okuyup
  // bcrypt.compare ile doğrular. `password_hash` gibi bu metod da yalnızca
  // AuthService içinde tüketilir, doğrudan API yanıtına asla verilmez.
  async findRefreshTokenData(userId) {
    try {
      const result = await this.pool.query(
        `SELECT id, email, refresh_token_hash, refresh_token_expires_at
         FROM users WHERE id = $1`,
        [userId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findRefreshTokenData hatası:', error.message)
      throw error
    }
  }

  // "Çıkış Yap" — gerçek bir çıkış: refresh token veritabanından SİLİNİR,
  // yalnızca istemci tarafında token'ları unutmak yetmez (frontend'de
  // localStorage temizlense bile, sunucu tarafında hâlâ geçerli bir refresh
  // token dursaydı çalınmış bir kopya oturumu canlı tutmaya devam ederdi).
  async clearRefreshToken(userId) {
    try {
      await this.pool.query(
        `UPDATE users
         SET refresh_token_hash = NULL, refresh_token_expires_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [userId],
      )
    } catch (error) {
      console.error('UserRepository.clearRefreshToken hatası:', error.message)
      throw error
    }
  }

  async updatePassword(id, passwordHash) {
    try {
      const result = await this.pool.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING ${SAFE_COLUMNS}`,
        [passwordHash, id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.updatePassword hatası:', error.message)
      throw error
    }
  }

  async update(id, data) {
    try {
      const { name, email, age, city, subscriptionTier } = data
      const result = await this.pool.query(
        `UPDATE users
         SET name = $1, email = $2, age = $3, city = $4,
             subscription_tier = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING ${SAFE_COLUMNS}`,
        [name, email, age, city, subscriptionTier, id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.update hatası:', error.message)
      throw error
    }
  }

  // --- Ten tonu analizi ---
  //
  // Bu iki kolon SAFE_COLUMNS'A BİLEREK EKLENMEDİ. Selfie yolu hassas veridir
  // ve analiz nesnesi de büyükçedir; /auth/me, /users/:id gibi HER kullanıcı
  // yanıtında taşınmalarının bir sebebi yok. Yalnızca kendi ucundan okunurlar.
  async findSkinTone(userId) {
    try {
      const result = await this.pool.query(
        'SELECT id, skin_tone_analysis, skin_tone_photo_url FROM users WHERE id = $1',
        [userId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.findSkinTone hatası:', error.message)
      throw error
    }
  }

  async updateSkinTone(userId, { analysis, photoUrl }) {
    try {
      const result = await this.pool.query(
        `UPDATE users
         SET skin_tone_analysis = $1, skin_tone_photo_url = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING id, skin_tone_analysis, skin_tone_photo_url`,
        [analysis, photoUrl, userId],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.updateSkinTone hatası:', error.message)
      throw error
    }
  }

  // Kullanıcı silinmeden ÖNCE çağrılmalıdır. `ON DELETE CASCADE`
  // clothing_items satırlarını veritabanından temizler ama diskteki
  // fotoğraf dosyalarına DOKUNMAZ — bu yüzden hangi dosyaların artık
  // sahipsiz kalacağını cascade'den ÖNCE toplamak gerekiyor.
  //
  // `is_deleted` FARK ETMEZ: soft-delete edilmiş bir parçanın dosyası
  // normal akışta zaten silinmiş olur (bkz. ClothingItemService.deleteItem),
  // ama garanti değildir (örn. doğrudan SQL ile silinen test verisi);
  // burada dosya sistemine bakılmadan tüm olası yollar toplanıp silme
  // en sonda idempotent olarak (yoksa hata vermeden) yapılır.
  // İKİ AYRI liste döner (tek bir düz dizi DEĞİL): kıyafet fotoğrafları
  // UPLOAD_DIR kökünde, selfie ise UPLOAD_DIR/selfies altında yaşıyor —
  // çağıran (UserService.deleteUser) her biri için doğru silme fonksiyonunu
  // (removeUploadedFile / removeSelfieFile) seçebilsin diye ayrım burada yapılır.
  async collectUploadedFileNames(userId) {
    try {
      const items = await this.pool.query(
        'SELECT image_url FROM clothing_items WHERE user_id = $1 AND image_url IS NOT NULL',
        [userId],
      )
      const selfie = await this.pool.query(
        'SELECT skin_tone_photo_url FROM users WHERE id = $1 AND skin_tone_photo_url IS NOT NULL',
        [userId],
      )
      return {
        clothingImageUrls: items.rows.map((row) => row.image_url),
        selfiePhotoUrl: selfie.rows[0]?.skin_tone_photo_url ?? null,
      }
    } catch (error) {
      console.error('UserRepository.collectUploadedFileNames hatası:', error.message)
      throw error
    }
  }

  async delete(id) {
    try {
      const result = await this.pool.query(
        `DELETE FROM users WHERE id = $1 RETURNING ${SAFE_COLUMNS}`,
        [id],
      )
      return result.rows[0] || null
    } catch (error) {
      console.error('UserRepository.delete hatası:', error.message)
      throw error
    }
  }
}

module.exports = UserRepository
