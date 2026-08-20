const BaseController = require('./BaseController')

class WeatherController extends BaseController {
  constructor(weatherService) {
    super()
    this.weatherService = weatherService
  }

  // Servis fırlatmadığı için burada hata çevirisine gerek kalmıyor; yine de
  // beklenmedik bir durum olursa BaseController devreye girsin diye try/catch
  // korunuyor (depodaki controller kalıbı).
  async getByCity(req, res) {
    try {
      const weather = await this.weatherService.getWeather(req.query.city)
      res.status(200).json(weather)
    } catch (error) {
      this.handleError(error, res)
    }
  }
}

module.exports = WeatherController
