const { NotFoundError, ValidationError } = require('../utils/errors')
const { FIELD_LIMITS, assertFieldLengths } = require('../utils/validators')

const FOREIGN_KEY_VIOLATION = '23503'

class StylePreferenceService {
  constructor(stylePreferenceRepository) {
    this.stylePreferenceRepository = stylePreferenceRepository
  }

  async getByUserId(userId) {
    if (!userId) {
      throw new ValidationError('userId zorunludur')
    }

    const preferences = await this.stylePreferenceRepository.findByUserId(userId)
    if (!preferences) {
      throw new NotFoundError('Tarz tercihleri bulunamadı')
    }

    return preferences
  }

  async savePreferences(data) {
    if (!data.userId) {
      throw new ValidationError('userId zorunludur')
    }

    assertFieldLengths(data, FIELD_LIMITS.stylePreferences)

    try {
      return await this.stylePreferenceRepository.upsert(data.userId, {
        dailyStyle: data.dailyStyle ?? null,
        colorPreference: data.colorPreference ?? null,
        priority: data.priority ?? null,
        styleIcon: data.styleIcon ?? null,
        frequency: data.frequency ?? null,
      })
    } catch (error) {
      // Olmayan bir kullanıcıya tercih kaydetmek 500 değil, anlamlı bir istemci hatasıdır.
      if (error.code === FOREIGN_KEY_VIOLATION) {
        throw new ValidationError('Belirtilen userId ile bir kullanıcı bulunamadı')
      }
      throw error
    }
  }
}

module.exports = StylePreferenceService
