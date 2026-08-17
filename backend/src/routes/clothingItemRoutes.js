const { Router } = require('express')
const pool = require('../config/database')
const ClothingItemRepository = require('../repositories/ClothingItemRepository')
const ClothingItemService = require('../services/ClothingItemService')
const ClothingItemController = require('../controllers/ClothingItemController')

const clothingItemRepository = new ClothingItemRepository(pool)
const clothingItemService = new ClothingItemService(clothingItemRepository)
const clothingItemController = new ClothingItemController(clothingItemService)

const router = Router()

router.get('/clothing-items', (req, res) => clothingItemController.getAll(req, res))
router.get('/clothing-items/:id', (req, res) => clothingItemController.getById(req, res))
router.post('/clothing-items', (req, res) => clothingItemController.create(req, res))
router.put('/clothing-items/:id', (req, res) => clothingItemController.update(req, res))
router.delete('/clothing-items/:id', (req, res) => clothingItemController.delete(req, res))
router.patch('/clothing-items/:id/favorite', (req, res) => clothingItemController.toggleFavorite(req, res))

module.exports = router
