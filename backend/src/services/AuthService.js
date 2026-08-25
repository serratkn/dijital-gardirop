const bcrypt = require('bcrypt')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { ValidationError, ConflictError, NotFoundError, AppError } = require('../utils/errors')
const { FIELD_LIMITS, assertMaxLength, UUID_PATTERN } = require('../utils/validators')

const UNIQUE_VIOLATION = '23505'
const BCRYPT_ROUNDS = 10
const MIN_PASSWORD_LENGTH = 8

// Refresh token bcrypt'le hash'lenir — password_hash ile AYNI mekanizma.
// Bu round sayısı /auth/refresh'te HER başarılı istekte bir kez çalışır
// (access token'ın aksine kısa aralıklarla tetiklenir); 10 tur ~60-70ms
// sürer ve bu depodaki password_hash ile TUTARLI kalması için düşürülmedi.
const REFRESH_TOKEN_BCRYPT_ROUNDS = 10
// 48 bayt = 384 bit entropi — kaba kuvvetle tahmin edilemez. Token biçimi
// `<userId>:<rastgeleHex>` şeklindedir (bkz. #createRefreshToken): bcrypt
// hash'leri SORGULANAMADIĞI için (her hash'leme farklı salt üretir, WHERE
// refresh_token_hash = ? diye arama yapılamaz), token'ın kendisine kullanıcı
// kimliğini gömüp #extractUserIdFromRefreshToken ile SADECE o kullanıcının
// satırını okumak gerekiyor. Bu, DB'yi ele geçiren birine hiçbir ek bilgi vermez
// (user id zaten access token payload'ında da açıkça duruyor) ama O(1) bir
// bakışta doğru satırı bulmayı sağlar.
const REFRESH_TOKEN_BYTES = 48

// jsonwebtoken'ın `expiresIn` biçimiyle AYNI küçük bir alt kümeyi ("30d",
// "12h", "15m", "45s", ya da düz saniye sayısı) milisaniyeye çevirir.
// jsonwebtoken kendi içinde `ms` paketini kullanıyor ama bu paket
// package.json'da bizim DOĞRUDAN bağımlılığımız değil (transitive) — ona
// güvenmek kırılgan olurdu (bir üst paket güncellenip onu kaldırabilir).
// Burada yalnızca KENDİ .env formatımızı çözen küçük, bağımsız bir yardımcı yeterli.
const DURATION_PATTERN = /^(\d+)\s*(d|h|m|s)?$/i
const DURATION_UNIT_TO_MS = { d: 86400000, h: 3600000, m: 60000, s: 1000 }

function parseDurationToMs(value) {
  const match = DURATION_PATTERN.exec(String(value).trim())
  if (!match) {
    throw new Error(`Geçersiz süre biçimi: "${value}" (örnek: "30d", "12h", "15m")`)
  }
  const amount = Number(match[1])
  const unit = (match[2] || 's').toLowerCase()
  return amount * DURATION_UNIT_TO_MS[unit]
}

// 401: kimlik doğrulanamadı (token yok/geçersiz, parola hatalı)
class UnauthorizedError extends AppError {
  constructor(message = 'Kimlik doğrulanamadı') {
    super(message, 401)
  }
}

class AuthService {
  constructor(userRepository) {
    this.userRepository = userRepository

    this.jwtSecret = process.env.JWT_SECRET
    // KISA ömürlü access token — artık kullanıcı oturumunun asıl süresini
    // TAŞIMIYOR (bu iş refreshTokenExpiresInMs'e devredildi). Varsayılan 15
    // dakika: eskiden burası "7d" idi ve token çalınırsa saldırı penceresi
    // bir hafta açık kalıyordu; artık dolduğunda frontend arka planda
    // sessizce yeniliyor (bkz. lib/api.js > tryRefreshSession), kullanıcı
    // hiçbir şey fark etmiyor.
    this.accessTokenExpiresIn = process.env.JWT_EXPIRES_IN || '15m'
    this.refreshTokenExpiresInMs = parseDurationToMs(process.env.REFRESH_TOKEN_EXPIRES_IN || '30d')

    // Secret olmadan token imzalamak sessizce güvensiz bir sisteme yol açar;
    // sunucu açılışında net biçimde patlaması daha iyidir.
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET tanımlı değil. backend/.env dosyasını kontrol edin.')
    }
  }

  async register(data) {
    const email = this.#normalizeEmail(data.email)
    const password = this.#validatePassword(data.password)

    assertMaxLength(data.name?.trim(), FIELD_LIMITS.users.name, 'name')
    this.#validateAge(data.age)

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    try {
      const user = await this.userRepository.create({
        name: data.name?.trim() || null,
        email,
        age: data.age === '' || data.age === undefined ? null : data.age,
        passwordHash,
      })

      const tokens = await this.#issueTokenPair(user.id, user.email)
      return { user, ...tokens }
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictError('Bu e-posta adresi zaten kayıtlı')
      }
      throw error
    }
  }

  async login(data) {
    const email = this.#normalizeEmail(data.email)

    if (!data.password) {
      throw new ValidationError('password zorunludur')
    }

    const record = await this.userRepository.findByEmailForAuth(email)

    // Kullanıcı yok ile parola yanlış arasında ayrım yapmıyoruz:
    // aksi hâlde hangi e-postaların kayıtlı olduğu dışarıdan öğrenilebilirdi.
    if (!record || !record.password_hash) {
      throw new UnauthorizedError('E-posta veya şifre hatalı')
    }

    const isValid = await bcrypt.compare(data.password, record.password_hash)
    if (!isValid) {
      throw new UnauthorizedError('E-posta veya şifre hatalı')
    }

    const { password_hash: _ignored, ...user } = record
    const tokens = await this.#issueTokenPair(user.id, user.email)
    return { user, ...tokens }
  }

  // Access token süresi dolduğunda frontend'in sessizce çağırdığı uç.
  // Geçerli bir refresh token karşılığında YENİ bir access token VE
  // (rotasyon gereği) YENİ bir refresh token döner — `user` alanı YOKTUR:
  // çağıran zaten oturum açık bir sayfada, kullanıcı nesnesine ihtiyacı yok.
  //
  // ROTASYON: bu çağrı başarılı olduğu anda ESKİ refresh token (parametre
  // olarak gelen `rawToken`) veritabanında YENİSİYLE DEĞİŞTİRİLİR ve bir
  // daha ASLA kabul edilmez (test bunu ayrıca doğruluyor). Çalınmış bir
  // token'ın süresiz kullanılabilmesini önlemenin standart yolu budur:
  // meşru sahibi bir sonraki sessiz yenilemeyi yaptığı anda çalıntı kopya
  // geçersiz kalır.
  async refresh(rawToken) {
    const userId = this.#extractUserIdFromRefreshToken(rawToken)
    if (!userId) {
      throw new UnauthorizedError('Oturum yenilenemedi, lütfen tekrar giriş yapın')
    }

    const record = await this.userRepository.findRefreshTokenData(userId)
    if (!record || !record.refresh_token_hash) {
      throw new UnauthorizedError('Oturum yenilenemedi, lütfen tekrar giriş yapın')
    }

    if (record.refresh_token_expires_at && record.refresh_token_expires_at.getTime() <= Date.now()) {
      // Süresi dolmuş — housekeeping olarak DB'den de temizlenir; hatanın
      // kendisi zaten aynı (401), yeniden aynı token'la denemek anlamsız.
      await this.userRepository.clearRefreshToken(userId)
      throw new UnauthorizedError('Oturumun süresi doldu, lütfen tekrar giriş yapın')
    }

    const isValid = await bcrypt.compare(rawToken, record.refresh_token_hash)
    if (!isValid) {
      // EŞLEŞMİYOR: ya rotasyonla ZATEN geçersiz kılınmış eski bir token
      // (çalıntı bir kopyanın tekrar kullanılmaya çalışılması) ya da bozuk
      // bir istek. Mevcut (hâlâ geçerli olabilecek) hash'e BURADA DOKUNULMAZ
      // — yalnızca bu istek reddedilir, meşru sahibinin oturumu etkilenmez.
      throw new UnauthorizedError('Oturum yenilenemedi, lütfen tekrar giriş yapın')
    }

    return this.#issueTokenPair(record.id, record.email)
  }

  // "Çıkış Yap" — GERÇEK bir çıkış: refresh token veritabanından SİLİNİR.
  // Yalnızca frontend'de localStorage'ı temizlemek yeterli değildir; sunucu
  // tarafında refresh token hâlâ dursaydı çalınmış (ya da farklı bir cihazda
  // saklanan) bir kopya oturumu canlı tutmaya devam ederdi.
  async logout(userId) {
    await this.userRepository.clearRefreshToken(userId)
  }

  async getCurrentUser(userId) {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }
    return user
  }

  async changePassword(userId, data) {
    if (!data.currentPassword) {
      throw new ValidationError('currentPassword zorunludur')
    }

    const newPassword = this.#validatePassword(data.newPassword, 'newPassword')

    const record = await this.userRepository.findByIdForAuth(userId)
    if (!record) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }

    if (!record.password_hash) {
      throw new ValidationError('Bu hesapta tanımlı bir şifre yok')
    }

    const isValid = await bcrypt.compare(data.currentPassword, record.password_hash)
    if (!isValid) {
      throw new UnauthorizedError('Mevcut şifre hatalı')
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    return this.userRepository.updatePassword(userId, passwordHash)
  }

  // Middleware tarafından her korumalı istekte çağrılır.
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret)
    } catch {
      throw new UnauthorizedError('Oturum geçersiz veya süresi dolmuş')
    }
  }

  #createAccessToken(userId, email) {
    return jwt.sign({ sub: userId, email }, this.jwtSecret, {
      expiresIn: this.accessTokenExpiresIn,
    })
  }

  // Register/login/refresh'in ÜÇÜ DE bu tek noktadan geçer — access + refresh
  // token çifti üretilir, refresh token'ın bcrypt hash'i (ROTASYON: bir
  // önceki hash'in üzerine yazılarak) kalıcı hâle getirilir. `user` alanı
  // BİLEREK yok: çağıranların (register/login) kendi tarafında zaten dolu
  // bir `user` nesnesi var, burada tekrarlamaya gerek yok.
  async #issueTokenPair(userId, email) {
    const accessToken = this.#createAccessToken(userId, email)
    const refreshToken = this.#createRefreshToken(userId)
    const refreshTokenHash = await bcrypt.hash(refreshToken, REFRESH_TOKEN_BCRYPT_ROUNDS)
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiresInMs)

    await this.userRepository.setRefreshToken(userId, { hash: refreshTokenHash, expiresAt })

    return { token: accessToken, refreshToken }
  }

  // Opak bir dize: `<userId>:<48 baytlık rastgele hex>`. JWT DEĞİLDİR —
  // imzalanmaz, çözülmez; tek işlevi kaba kuvvetle tahmin edilemeyecek kadar
  // yüksek entropili (384 bit) bir sır taşımak ve DB'de hangi kullanıcıya ait
  // olduğunu O(1) bulunabilir kılmaktır (bkz. REFRESH_TOKEN_BYTES yorumu).
  #createRefreshToken(userId) {
    return `${userId}:${crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex')}`
  }

  // `refresh()` bu userId'yi kullanarak SADECE o kullanıcının satırını okur;
  // biçimi bozuk (UUID değil) bir token burada sessizce null'a düşer —
  // refresh() bunu diğer tüm doğrulama hatalarıyla AYNI 401'e çevirir,
  // "neden reddedildiği" dışarıya asla sızmaz.
  #extractUserIdFromRefreshToken(rawToken) {
    if (typeof rawToken !== 'string' || !rawToken) return null

    const separatorIndex = rawToken.indexOf(':')
    if (separatorIndex <= 0) return null

    const userId = rawToken.slice(0, separatorIndex)
    return UUID_PATTERN.test(userId) ? userId : null
  }

  #normalizeEmail(email) {
    if (!email || !email.trim()) {
      throw new ValidationError('email zorunludur')
    }

    const normalized = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ValidationError('email geçerli bir adres olmalıdır')
    }

    assertMaxLength(normalized, FIELD_LIMITS.users.email, 'email')
    return normalized
  }

  #validatePassword(password, fieldName = 'password') {
    if (!password) {
      throw new ValidationError(`${fieldName} zorunludur`)
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(`${fieldName} en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır`)
    }
    // bcrypt 72 bayttan uzun girdiyi sessizce kırpar; sınırı açıkça koyuyoruz.
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new ValidationError(`${fieldName} en fazla 72 bayt olabilir`)
    }
    return password
  }

  #validateAge(age) {
    if (age === undefined || age === null || age === '') return

    const parsed = Number(age)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 120) {
      throw new ValidationError('age 0 ile 120 arasında bir tam sayı olmalıdır')
    }
  }
}

module.exports = { AuthService, UnauthorizedError }
