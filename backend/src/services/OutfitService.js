const { NotFoundError, ValidationError, PremiumRequiredError } = require('../utils/errors')
const { FIELD_LIMITS, assertMaxLength, assertUuid } = require('../utils/validators')
const { FREE_LIMITS, isPremium } = require('../config/plans')

const FOREIGN_KEY_VIOLATION = '23503'

class OutfitService {
  // userRepository, ücretsiz plan sınırını kontrol edebilmek için gerekir
  // (bkz. #assertUnderOutfitLimit) — ClothingItemService'teki AYNI gerekçe.
  constructor(outfitRepository, userRepository) {
    this.outfitRepository = outfitRepository
    this.userRepository = userRepository
  }

  // clothingItemId verilirse yalnızca o parçanın geçtiği kombinler döner
  // (Kıyafet Detay sayfasındaki "Bu Kıyafetle Yapılan Kombinler" bölümü).
  async getOutfits(userId, clothingItemId) {
    if (!userId) {
      throw new ValidationError('userId zorunludur')
    }

    if (clothingItemId) {
      assertUuid(clothingItemId, 'clothingItemId')
      return this.outfitRepository.findAllByClothingItem(userId, clothingItemId)
    }

    return this.outfitRepository.findAll(userId)
  }

  // Sahiplik kontrolü 404 ile yapılır (403 kaydın varlığını ele verirdi).
  async getOutfitById(id, userId) {
    const outfit = await this.outfitRepository.findById(id)
    if (!outfit || outfit.user_id !== userId) {
      throw new NotFoundError('Kombin bulunamadı')
    }
    return outfit
  }

  async createOutfit(data) {
    if (!data.userId) {
      throw new ValidationError('userId zorunludur')
    }

    assertMaxLength(data.occasion, FIELD_LIMITS.outfits.occasion, 'occasion')

    const clothingItemIds = this.#validateItemIds(data.clothingItemIds)
    await this.#assertItemsBelongToUser(data.userId, clothingItemIds)
    await this.#assertUnderOutfitLimit(data.userId)

    try {
      return await this.outfitRepository.create({
        userId: data.userId,
        occasion: data.occasion ?? null,
        clothingItemIds,
      })
    } catch (error) {
      if (error.code === FOREIGN_KEY_VIOLATION) {
        throw new ValidationError('Belirtilen userId ile bir kullanıcı bulunamadı')
      }
      throw error
    }
  }

  async updateOutfit(id, data, userId) {
    assertMaxLength(data.occasion, FIELD_LIMITS.outfits.occasion, 'occasion')

    const existingOutfit = await this.outfitRepository.findById(id)
    if (!existingOutfit || existingOutfit.user_id !== userId) {
      throw new NotFoundError('Kombin bulunamadı')
    }

    let clothingItemIds
    if (data.clothingItemIds !== undefined) {
      clothingItemIds = this.#validateItemIds(data.clothingItemIds)
      await this.#assertItemsBelongToUser(existingOutfit.user_id, clothingItemIds)
    }

    return this.outfitRepository.update(id, {
      occasion: data.occasion ?? null,
      clothingItemIds,
    })
  }

  async deleteOutfit(id, userId) {
    // Önce sahiplik doğrulanır; doğrudan silmek başkasının kombinini silerdi.
    const existingOutfit = await this.outfitRepository.findById(id)
    if (!existingOutfit || existingOutfit.user_id !== userId) {
      throw new NotFoundError('Kombin bulunamadı')
    }
    return this.outfitRepository.delete(id)
  }

  async toggleFavorite(id, userId) {
    const existing = await this.outfitRepository.findById(id)
    if (!existing || existing.user_id !== userId) {
      throw new NotFoundError('Kombin bulunamadı')
    }
    return this.outfitRepository.toggleFavorite(id)
  }

  async markAsWorn(id, userId) {
    const existing = await this.outfitRepository.findById(id)
    if (!existing || existing.user_id !== userId) {
      throw new NotFoundError('Kombin bulunamadı')
    }
    return this.outfitRepository.incrementTimesWorn(id)
  }

  // Ücretsiz kullanıcı en fazla FREE_LIMITS.outfits kombin kaydedebilir.
  // Premium kullanıcı hiçbir kontrolden geçmez.
  async #assertUnderOutfitLimit(userId) {
    const user = await this.userRepository.findById(userId)
    if (isPremium(user)) return

    const count = await this.outfitRepository.countByUser(userId)
    if (count >= FREE_LIMITS.outfits) {
      throw new PremiumRequiredError(
        `Ücretsiz planda en fazla ${FREE_LIMITS.outfits} kombin kaydedebilirsin. ` +
          'Daha fazlası için Profil > Premium Abonelik üzerinden yükselt.',
      )
    }
  }

  #validateItemIds(clothingItemIds) {
    if (!Array.isArray(clothingItemIds) || clothingItemIds.length === 0) {
      throw new ValidationError('clothingItemIds en az bir parça içeren bir dizi olmalıdır')
    }

    const uniqueIds = [...new Set(clothingItemIds)]
    if (uniqueIds.length !== clothingItemIds.length) {
      throw new ValidationError('clothingItemIds aynı parçayı birden fazla içeremez')
    }

    return uniqueIds
  }

  // Kombine yalnızca kullanıcının kendi (silinmemiş) parçaları eklenebilir.
  async #assertItemsBelongToUser(userId, clothingItemIds) {
    const ownedCount = await this.outfitRepository.countOwnedItems(userId, clothingItemIds)
    if (ownedCount !== clothingItemIds.length) {
      throw new ValidationError(
        'clothingItemIds bu kullanıcıya ait olmayan veya silinmiş parça içeriyor',
      )
    }
  }
}

module.exports = OutfitService
