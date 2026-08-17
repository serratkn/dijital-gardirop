const { NotFoundError, ValidationError } = require('../utils/errors')

const FOREIGN_KEY_VIOLATION = '23503'

class OutfitService {
  constructor(outfitRepository) {
    this.outfitRepository = outfitRepository
  }

  async getOutfits(userId) {
    if (!userId) {
      throw new ValidationError('userId zorunludur')
    }
    return this.outfitRepository.findAll(userId)
  }

  async getOutfitById(id) {
    const outfit = await this.outfitRepository.findById(id)
    if (!outfit) {
      throw new NotFoundError('Kombin bulunamadı')
    }
    return outfit
  }

  async createOutfit(data) {
    if (!data.userId) {
      throw new ValidationError('userId zorunludur')
    }

    const clothingItemIds = this.#validateItemIds(data.clothingItemIds)
    await this.#assertItemsBelongToUser(data.userId, clothingItemIds)

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

  async updateOutfit(id, data) {
    const existingOutfit = await this.outfitRepository.findById(id)
    if (!existingOutfit) {
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

  async deleteOutfit(id) {
    const deletedOutfit = await this.outfitRepository.delete(id)
    if (!deletedOutfit) {
      throw new NotFoundError('Kombin bulunamadı')
    }
    return deletedOutfit
  }

  async toggleFavorite(id) {
    const outfit = await this.outfitRepository.toggleFavorite(id)
    if (!outfit) {
      throw new NotFoundError('Kombin bulunamadı')
    }
    return outfit
  }

  async markAsWorn(id) {
    const outfit = await this.outfitRepository.incrementTimesWorn(id)
    if (!outfit) {
      throw new NotFoundError('Kombin bulunamadı')
    }
    return outfit
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
