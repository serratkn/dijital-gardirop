const { NotFoundError, ValidationError } = require('../utils/errors')
const { FIELD_LIMITS, assertFieldLengths } = require('../utils/validators')

const FOREIGN_KEY_VIOLATION = '23503'

// Olmayan bir kullanıcı ya da kategoriye parça eklemek sunucu hatası değil,
// anlamlı bir istemci hatasıdır.
function translateForeignKeyError(error) {
  if (error.code !== FOREIGN_KEY_VIOLATION) return error

  return new ValidationError(
    error.constraint === 'clothing_items_category_id_fkey'
      ? 'Belirtilen categoryId ile bir kategori bulunamadı'
      : 'Belirtilen userId ile bir kullanıcı bulunamadı',
  )
}

class ClothingItemService {
  constructor(clothingItemRepository) {
    this.clothingItemRepository = clothingItemRepository
  }

  async getItems(userId, categoryId) {
    if (!userId) {
      throw new ValidationError('userId zorunludur')
    }

    if (categoryId) {
      return this.clothingItemRepository.findByCategory(userId, categoryId)
    }

    return this.clothingItemRepository.findAll(userId)
  }

  async getItemById(id) {
    const item = await this.clothingItemRepository.findById(id)

    if (!item) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    return item
  }

  async createItem(data) {
    this.#validateCreateData(data)

    try {
      return await this.clothingItemRepository.create(data)
    } catch (error) {
      throw translateForeignKeyError(error)
    }
  }

  async updateItem(id, data) {
    this.#validateUpdateData(data)

    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    try {
      return await this.clothingItemRepository.update(id, data)
    } catch (error) {
      throw translateForeignKeyError(error)
    }
  }

  async deleteItem(id) {
    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    return this.clothingItemRepository.softDelete(id)
  }

  async toggleFavorite(id) {
    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    return this.clothingItemRepository.toggleFavorite(id)
  }

  #validateCreateData(data) {
    if (!data.userId) {
      throw new ValidationError('userId zorunludur')
    }
    if (!data.categoryId) {
      throw new ValidationError('categoryId zorunludur')
    }
    if (!data.name || !data.name.trim()) {
      throw new ValidationError('name zorunludur')
    }
    assertFieldLengths(data, FIELD_LIMITS.clothingItems)
  }

  #validateUpdateData(data) {
    if (!data.categoryId) {
      throw new ValidationError('categoryId zorunludur')
    }
    if (!data.name || !data.name.trim()) {
      throw new ValidationError('name zorunludur')
    }
    assertFieldLengths(data, FIELD_LIMITS.clothingItems)
  }
}

module.exports = ClothingItemService
