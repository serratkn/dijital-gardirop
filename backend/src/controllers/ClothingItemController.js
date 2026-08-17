const BaseController = require('./BaseController')

class ClothingItemController extends BaseController {
  constructor(clothingItemService) {
    super()
    this.clothingItemService = clothingItemService
  }

  async getAll(req, res) {
    try {
      const { userId, categoryId } = req.query
      const items = await this.clothingItemService.getItems(userId, categoryId)
      res.status(200).json(items)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async getById(req, res) {
    try {
      const item = await this.clothingItemService.getItemById(req.params.id)
      res.status(200).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async create(req, res) {
    try {
      const item = await this.clothingItemService.createItem(req.body)
      res.status(201).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async update(req, res) {
    try {
      const item = await this.clothingItemService.updateItem(req.params.id, req.body)
      res.status(200).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async delete(req, res) {
    try {
      await this.clothingItemService.deleteItem(req.params.id)
      res.status(204).send()
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async toggleFavorite(req, res) {
    try {
      const item = await this.clothingItemService.toggleFavorite(req.params.id)
      res.status(200).json(item)
    } catch (error) {
      this.handleError(error, res)
    }
  }

}

module.exports = ClothingItemController
