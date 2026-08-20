const BaseController = require('./BaseController')

class OutfitController extends BaseController {
  constructor(outfitService) {
    super()
    this.outfitService = outfitService
  }

  async getAll(req, res) {
    try {
      const outfits = await this.outfitService.getOutfits(
        req.userId,
        req.query.clothingItemId,
      )
      res.status(200).json(outfits)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async getById(req, res) {
    try {
      const outfit = await this.outfitService.getOutfitById(req.params.id, req.userId)
      res.status(200).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async create(req, res) {
    try {
      const outfit = await this.outfitService.createOutfit({ ...req.body, userId: req.userId })
      res.status(201).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async update(req, res) {
    try {
      const outfit = await this.outfitService.updateOutfit(req.params.id, req.body, req.userId)
      res.status(200).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async delete(req, res) {
    try {
      await this.outfitService.deleteOutfit(req.params.id, req.userId)
      res.status(204).send()
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async toggleFavorite(req, res) {
    try {
      const outfit = await this.outfitService.toggleFavorite(req.params.id, req.userId)
      res.status(200).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }

  async markAsWorn(req, res) {
    try {
      const outfit = await this.outfitService.markAsWorn(req.params.id, req.userId)
      res.status(200).json(outfit)
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = OutfitController
