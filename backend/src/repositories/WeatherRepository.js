// Bu repository veritabanına değil DIŞ BİR SERVİSE (OpenWeatherMap) bakar.
// Katman rolü aynı kalır: yalnızca veri erişimi, iş kuralı yok — sıcaklığın
// "sıcak/ılık/soğuk" kategorisine çevrilmesi WeatherService'in işidir.

const API_URL = 'https://api.openweathermap.org/data/2.5/weather'

// Şehir listesi Türkiye şehirleriyle sınırlı olduğu için sorguya ülke kodu
// eklenir; "Istanbul" gibi adlar dünyada birden fazla yerde geçebiliyor.
const DEFAULT_COUNTRY_CODE = 'TR'

// Dış servis yanıt vermezse istek burada kesilir. Olmasaydı takılan bir
// OpenWeatherMap isteği Kombin Öner sayfasının açılışını bekletirdi.
const REQUEST_TIMEOUT_MS = 5000

class WeatherRepository {
  constructor(apiKey) {
    this.apiKey = apiKey
  }

  get isConfigured() {
    return Boolean(this.apiKey)
  }

  // Ham yanıtı döndürür; hata durumunda FIRLATIR. Sessize alma kararı
  // servis katmanına aittir (bkz. WeatherService.getWeather).
  async fetchByCity(city) {
    const url =
      `${API_URL}?q=${encodeURIComponent(`${city},${DEFAULT_COUNTRY_CODE}`)}` +
      `&appid=${encodeURIComponent(this.apiKey)}&units=metric&lang=tr`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      const error = new Error(`OpenWeatherMap ${response.status}`)
      error.status = response.status
      throw error
    }

    return response.json()
  }
}

module.exports = WeatherRepository
