const { NotFoundError, ValidationError } = require('../utils/errors')

class CategoryService {
  constructor(categoryRepository) {
    this.categoryRepository = categoryRepository
  }

  async getCategories() {
    return this.categoryRepository.findAll()
  }

  async getCategoryById(id) {
    const categoryId = Number(id)
    if (!Number.isInteger(categoryId)) {
      throw new ValidationError('categoryId sayı olmalıdır')
    }

    const category = await this.categoryRepository.findById(categoryId)
    if (!category) {
      throw new NotFoundError('Kategori bulunamadı')
    }

    return category
  }
}

module.exports = CategoryService
