const { ValidationError } = require('./errors')

// Veritabanı kolon uzunlukları. Bir alan bu sınırı aşarsa Postgres 22001
// (value too long) fırlatır ve istek 500'e düşerdi; burada 400'e çeviriyoruz.
const FIELD_LIMITS = {
  users: { name: 100, email: 255, city: 100 },
  clothingItems: { name: 200, color: 50, brand: 100, season: 20, imageUrl: 500 },
  outfits: { occasion: 50 },
  stylePreferences: {
    dailyStyle: 50,
    colorPreference: 50,
    priority: 50,
    styleIcon: 50,
    frequency: 50,
  },
}

// Boş/tanımsız değerler burada denetlenmez; zorunluluk kontrolü
// servislerin kendi doğrulamasına aittir.
function assertMaxLength(value, maxLength, fieldName) {
  if (value === undefined || value === null) return

  if (String(value).length > maxLength) {
    throw new ValidationError(`${fieldName} en fazla ${maxLength} karakter olabilir`)
  }
}

// Bir nesnedeki alanları ilgili limit tablosuna göre topluca doğrular.
function assertFieldLengths(data, limits) {
  for (const [fieldName, maxLength] of Object.entries(limits)) {
    assertMaxLength(data[fieldName], maxLength, fieldName)
  }
}

// Geçersiz biçimli bir UUID doğrudan Postgres'e gitseydi 22P02 (invalid input
// syntax) ile 500'e düşerdi; sorgu paramı olarak gelen id'ler burada 400'e çevrilir.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUuid(value, fieldName) {
  if (!UUID_PATTERN.test(String(value))) {
    throw new ValidationError(`${fieldName} geçerli bir UUID olmalıdır`)
  }
}

module.exports = { FIELD_LIMITS, assertMaxLength, assertFieldLengths, assertUuid }
