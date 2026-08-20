const { Router } = require('express')
const pool = require('../config/database')
const StatsRepository = require('../repositories/StatsRepository')
const StatsService = require('../services/StatsService')
const StatsController = require('../controllers/StatsController')

// İstatistikler userRoutes'a değil kendi rota dosyasına konuldu: ileride
// "premium analiz raporu" gibi başka özet uçları da bu ağaca eklenecek.
const statsRepository = new StatsRepository(pool)
const statsService = new StatsService(statsRepository)
const statsController = new StatsController(statsService)

const router = Router()

router.get('/users/:id/stats', (req, res) => statsController.getWardrobeStats(req, res))

module.exports = router
