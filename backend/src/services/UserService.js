const { NotFoundError, ValidationError, ConflictError } = require('../utils/errors')

const UNIQUE_VIOLATION = '23505'
const SUBSCRIPTION_TIERS = ['free', 'premium']

class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository
  }

  async getUserById(id) {
    const user = await this.userRepository.findById(id)
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }
    return user
  }

  async createUser(data) {
    const email = this.#normalizeEmail(data.email)
    this.#validateAge(data.age)

    try {
      return await this.userRepository.create({
        name: data.name?.trim() || null,
        email,
        age: data.age ?? null,
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

  async updateUser(id, data) {
    const email = this.#normalizeEmail(data.email)
    this.#validateAge(data.age)

    const tier = data.subscriptionTier ?? 'free'
    if (!SUBSCRIPTION_TIERS.includes(tier)) {
      throw new ValidationError(
        `subscriptionTier şunlardan biri olmalıdır: ${SUBSCRIPTION_TIERS.join(', ')}`,
      )
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
        subscriptionTier: tier,
      })
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictError('Bu e-posta adresi zaten kayıtlı')
      }
      throw error
    }
  }

  async deleteUser(id) {
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

    return normalized
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
