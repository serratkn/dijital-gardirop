const { Router } = require('express')
const pool = require('../config/database')
const StylePreferenceRepository = require('../repositories/StylePreferenceRepository')
const StylePreferenceService = require('../services/StylePreferenceService')
const StylePreferenceController = require('../controllers/StylePreferenceController')

const stylePreferenceRepository = new StylePreferenceRepository(pool)
const stylePreferenceService = new StylePreferenceService(stylePreferenceRepository)
const stylePreferenceController = new StylePreferenceController(stylePreferenceService)

const router = Router()

router.get('/style-preferences', (req, res) => stylePreferenceController.getByUserId(req, res))
router.put('/style-preferences', (req, res) => stylePreferenceController.save(req, res))

module.exports = router
