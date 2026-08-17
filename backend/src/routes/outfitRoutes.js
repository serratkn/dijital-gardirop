const { Router } = require('express')
const pool = require('../config/database')
const OutfitRepository = require('../repositories/OutfitRepository')
const OutfitService = require('../services/OutfitService')
const OutfitController = require('../controllers/OutfitController')

const outfitRepository = new OutfitRepository(pool)
const outfitService = new OutfitService(outfitRepository)
const outfitController = new OutfitController(outfitService)

const router = Router()

router.get('/outfits', (req, res) => outfitController.getAll(req, res))
router.get('/outfits/:id', (req, res) => outfitController.getById(req, res))
router.post('/outfits', (req, res) => outfitController.create(req, res))
router.put('/outfits/:id', (req, res) => outfitController.update(req, res))
router.delete('/outfits/:id', (req, res) => outfitController.delete(req, res))
router.patch('/outfits/:id/favorite', (req, res) => outfitController.toggleFavorite(req, res))
router.patch('/outfits/:id/worn', (req, res) => outfitController.markAsWorn(req, res))

module.exports = router
