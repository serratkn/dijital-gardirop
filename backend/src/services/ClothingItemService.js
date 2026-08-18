const { NotFoundError, ValidationError } = require('../utils/errors')
const { FIELD_LIMITS, assertFieldLengths } = require('../utils/validators')

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

    return this.clothingItemRepository.create(data)
  }

  async updateItem(id, data) {
    this.#validateUpdateData(data)

    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    return this.clothingItemRepository.update(id, data)
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
