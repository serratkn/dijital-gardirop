// Kıyafet sezonu sözlüğü. Değerler clothing_items.season kolonuna (VARCHAR(20))
// yazıldığı gibi saklanır — en uzunu "İlkbahar-Sonbahar" (17 karakter).
export const ALL_SEASON = 'Tüm Sezon'

export const SEASONS = [ALL_SEASON, 'Yaz', 'İlkbahar-Sonbahar', 'Kış']

// Yeni parçalar sezon belirtilmeden de eklenebilsin diye varsayılan geniş tutuldu.
export const DEFAULT_SEASON = ALL_SEASON

// Hava durumu kategorisi → o havaya uygun sezonlar.
// Kategoriler backend'deki WeatherService.#toStatus ile birebir aynı olmalıdır.
const STATUS_SEASONS = {
  sıcak: ['Yaz'],
  ılık: ['İlkbahar-Sonbahar'],
  soğuk: ['Kış'],
}

// Hava bilinmiyorsa null döner — çağıran taraf bunu "filtreleme yapma"
// olarak yorumlar, böylece mevcut davranış aynen korunur.
export function seasonsForWeather(status) {
  return STATUS_SEASONS[status] ?? null
}

export function matchesSeason(item, seasons) {
  if (!seasons) return true

  // Sezonu boş olan parçalar (bu özellik eklenmeden önce girilmiş tüm gardırop)
  // ve "Tüm Sezon" parçalar her havaya uygundur. Aksi hâlde eski kayıtlar
  // hava durumu açıkken bir anda önerilemez hâle gelirdi.
  if (!item.season || item.season === ALL_SEASON) return true

  return seasons.includes(item.season)
}
