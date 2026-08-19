const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors')
const { FIELD_LIMITS, assertFieldLengths } = require('../utils/validators')
const { removeUploadedFile, fileNameFromImageUrl } = require('../config/upload')

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

  // Başkasının kaydı için 403 yerine 404 dönüyoruz: 403, o id'de bir kaydın
  // VAR olduğunu ele verir. 404 ile kaynak varlığı da gizlenmiş olur.
  async getItemById(id, userId) {
    const item = await this.clothingItemRepository.findById(id)

    if (!item || item.user_id !== userId) {
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

  async updateItem(id, data, userId) {
    this.#validateUpdateData(data)

    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem || existingItem.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    try {
      return await this.clothingItemRepository.update(id, data)
    } catch (error) {
      throw translateForeignKeyError(error)
    }
  }

  async deleteItem(id, userId) {
    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem || existingItem.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    const deleted = await this.clothingItemRepository.softDelete(id)

    // Kayıt soft delete edilse de dosya diskte tutulmaz: erişilemeyen
    // fotoğraflar yer kaplamasın.
    await removeUploadedFile(fileNameFromImageUrl(existingItem.image_url))

    return deleted
  }

  // Fotoğraf yükleme. Sahiplik ihlalinde 403 döner (diğer uçlardaki 404'ten
  // farklı; bkz. utils/errors.js). Çağıran katman, hata durumunda yeni
  // yüklenen dosyayı silmekten sorumludur.
  async setImage(id, userId, imageUrl) {
    if (!imageUrl) {
      throw new ValidationError('Fotoğraf dosyası zorunludur')
    }

    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }
    if (existingItem.user_id !== userId) {
      throw new ForbiddenError('Bu kıyafete fotoğraf yükleyemezsiniz')
    }

    const updated = await this.clothingItemRepository.updateImageUrl(id, imageUrl)

    // Yeni fotoğraf kaydedildikten SONRA eskisi silinir; sıra tersine olsaydı
    // veritabanı güncellemesi patladığında kullanıcı fotoğrafsız kalırdı.
    if (existingItem.image_url && existingItem.image_url !== imageUrl) {
      await removeUploadedFile(fileNameFromImageUrl(existingItem.image_url))
    }

    return updated
  }

  async removeImage(id, userId) {
    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }
    if (existingItem.user_id !== userId) {
      throw new ForbiddenError('Bu kıyafetin fotoğrafını kaldıramazsınız')
    }

    const updated = await this.clothingItemRepository.updateImageUrl(id, null)
    await removeUploadedFile(fileNameFromImageUrl(existingItem.image_url))

    return updated
  }

  async toggleFavorite(id, userId) {
    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem || existingItem.user_id !== userId) {
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
