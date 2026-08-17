const BaseController = require('./BaseController')

class CategoryController extends BaseController {
  constructor(categoryService) {
    super()
    this.categoryService = categoryService
  }

  async getAll(req, res) {
    try {
      const categories = await this.categoryService.getCategories()
      res.status(200).json(categories)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async getById(req, res) {
    try {
      const category = await this.categoryService.getCategoryById(req.params.id)
      res.status(200).json(category)
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = CategoryController
