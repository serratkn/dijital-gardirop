// Sıcaklık eşikleri. "sıcak" 20°C'nin ÜZERİ; 10-20 arası "ılık"; altı "soğuk".
const WARM_THRESHOLD = 20
const MILD_THRESHOLD = 10

const UNKNOWN_STATUS = 'bilinmiyor'

// Hava durumu bilinmediğinde dönen sabit yanıt. Uç NOKTA HER ZAMAN 200 döner:
// bu bilgi kombin önerisi için "olsa iyi olur" niteliğindedir, hata olarak
// dönmesi frontend'de gereksiz bir kırılma noktası yaratırdı.
// (Depodaki { error: "..." } kalıbından bilinçli sapma — bkz. CLAUDE.md.)
function unknownWeather(reason) {
  return { city: null, temperature: null, status: UNKNOWN_STATUS, reason }
}

class WeatherService {
  constructor(weatherRepository) {
    this.weatherRepository = weatherRepository
  }

  // ASLA fırlatmaz. Her başarısızlık "bilinmiyor" olarak geri döner.
  async getWeather(city) {
    if (!city || !String(city).trim()) {
      return unknownWeather('sehir-belirtilmedi')
    }

    if (!this.weatherRepository.isConfigured) {
      // WEATHER_API_KEY tanımlı değil. Sunucuyu patlatmıyoruz (JWT_SECRET'ten
      // farklı olarak): hava durumu opsiyonel bir özellik, uygulamanın geri
      // kalanı anahtarsız da tam çalışır.
      return unknownWeather('api-anahtari-yok')
    }

    try {
      const data = await this.weatherRepository.fetchByCity(String(city).trim())
      const temperature = data?.main?.temp

      if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
        return unknownWeather('sicaklik-okunamadi')
      }

      return {
        city: data?.name ?? String(city).trim(),
        temperature: Math.round(temperature),
        status: this.#toStatus(temperature),
        reason: null,
      }
    } catch (error) {
      // Ağ hatası, zaman aşımı, 401 (geçersiz anahtar), 404 (şehir yok) —
      // hepsi aynı yere çıkar: bilinmiyor. Sunucu log'una düşer ki
      // yanlış yapılandırma sessizce kaybolmasın.
      console.error('WeatherService.getWeather hatası:', error.message)
      return unknownWeather(error.status === 404 ? 'sehir-bulunamadi' : 'servis-hatasi')
    }
  }

  #toStatus(temperature) {
    if (temperature > WARM_THRESHOLD) return 'sıcak'
    if (temperature >= MILD_THRESHOLD) return 'ılık'
    return 'soğuk'
  }
}

module.exports = { WeatherService, UNKNOWN_STATUS }
