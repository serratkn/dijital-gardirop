const { Router } = require('express')
const WeatherRepository = require('../repositories/WeatherRepository')
const { WeatherService } = require('../services/WeatherService')
const WeatherController = require('../controllers/WeatherController')

// Anahtar süreç açılışında bir kez okunur. Yoksa servis "bilinmiyor" döner;
// sunucu bilinçli olarak patlamaz (hava durumu opsiyonel bir özelliktir).
const weatherRepository = new WeatherRepository(process.env.WEATHER_API_KEY)
const weatherService = new WeatherService(weatherRepository)
const weatherController = new WeatherController(weatherService)

const router = Router()

router.get('/weather', (req, res) => weatherController.getByCity(req, res))

module.exports = router
