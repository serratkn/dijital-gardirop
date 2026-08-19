const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { ValidationError, ConflictError, NotFoundError, AppError } = require('../utils/errors')
const { FIELD_LIMITS, assertMaxLength } = require('../utils/validators')

const UNIQUE_VIOLATION = '23505'
const BCRYPT_ROUNDS = 10
const MIN_PASSWORD_LENGTH = 8

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
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d'

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

      return { user, token: this.#createToken(user) }
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
    return { user, token: this.#createToken(user) }
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

  #createToken(user) {
    return jwt.sign({ sub: user.id, email: user.email }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    })
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
