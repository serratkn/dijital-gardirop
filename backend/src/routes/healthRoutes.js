const { Router } = require('express')
const pool = require('../config/database')
const HealthRepository = require('../repositories/HealthRepository')
const HealthService = require('../services/HealthService')
const HealthController = require('../controllers/HealthController')

const healthRepository = new HealthRepository(pool)
const healthService = new HealthService(healthRepository)
const healthController = new HealthController(healthService)

const router = Router()

router.get('/health', (req, res) => healthController.getHealth(req, res))

module.exports = router
