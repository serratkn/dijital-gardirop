const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors')
const { FIELD_LIMITS, assertMaxLength } = require('../utils/validators')

const UNIQUE_VIOLATION = '23505'
const SUBSCRIPTION_TIERS = ['free', 'premium']

class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository
  }

  // Kullanıcı yalnızca kendi kaydına erişebilir.
  async getUserById(id, requesterId) {
    if (requesterId && id !== requesterId) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }
    const user = await this.userRepository.findById(id)
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }
    return user
  }

  async createUser(data) {
    const email = this.#normalizeEmail(data.email)
    this.#validateName(data.name)
    this.#validateAge(data.age)
    const city = this.#normalizeCity(data.city)

    try {
      return await this.userRepository.create({
        name: data.name?.trim() || null,
        email,
        age: data.age ?? null,
        city,
      })
    } catch (error) {
      // Ön kontrol yerine veritabanının UNIQUE kısıtını kaynak kabul ediyoruz:
      // "önce sorgula sonra ekle" yaklaşımı eşzamanlı isteklerde yarış durumu yaratır.
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictError('Bu e-posta adresi zaten kayıtlı')
      }
      throw error
    }
  }

  async updateUser(id, data, requesterId) {
    const email = this.#normalizeEmail(data.email)
    this.#validateName(data.name)
    this.#validateAge(data.age)
    const city = this.#normalizeCity(data.city)

    const tier = data.subscriptionTier ?? 'free'
    if (!SUBSCRIPTION_TIERS.includes(tier)) {
      throw new ValidationError(
        `subscriptionTier şunlardan biri olmalıdır: ${SUBSCRIPTION_TIERS.join(', ')}`,
      )
    }

    if (requesterId && id !== requesterId) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }

    const existingUser = await this.userRepository.findById(id)
    if (!existingUser) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }

    try {
      return await this.userRepository.update(id, {
        name: data.name?.trim() || null,
        email,
        age: data.age ?? null,
        city,
        subscriptionTier: tier,
      })
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictError('Bu e-posta adresi zaten kayıtlı')
      }
      throw error
    }
  }

  async deleteUser(id, requesterId) {
    if (requesterId && id !== requesterId) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }

    const deletedUser = await this.userRepository.delete(id)
    if (!deletedUser) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }
    return deletedUser
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

  // Şehir opsiyoneldir: boş/tanımsız değer NULL'a düşer ve hava durumu
  // özelliği devre dışı kalır — bu geçerli bir durumdur, hata değildir.
  #normalizeCity(city) {
    if (city === undefined || city === null) return null

    const trimmed = String(city).trim()
    if (!trimmed) return null

    assertMaxLength(trimmed, FIELD_LIMITS.users.city, 'city')
    return trimmed
  }

  #validateName(name) {
    assertMaxLength(name?.trim(), FIELD_LIMITS.users.name, 'name')
  }

  #validateAge(age) {
    if (age === undefined || age === null || age === '') return

    const parsed = Number(age)
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 120) {
      throw new ValidationError('age 0 ile 120 arasında bir tam sayı olmalıdır')
    }
  }
}

module.exports = UserService
