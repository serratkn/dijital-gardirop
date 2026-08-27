// Backend ham veritabanı satırları döndürür (snake_case). Arayüz camelCase
// bekler ve ayrıca kategori ADINA ihtiyaç duyar — API ise category_id verir.
// Bu dosya iki dünya arasındaki tek çeviri noktasıdır.

// Masonry ızgarasının düzenli görünmemesi için bilinçli olarak
// tekrar etmeyen yükseklik dizisi (mock veriden taşındı).
const MASONRY_HEIGHTS = [
  'h-64', 'h-44', 'h-72', 'h-52', 'h-60',
  'h-48', 'h-68', 'h-40', 'h-76', 'h-56',
]

// Yükseklik id'den türetilir: filtreleme/arama sırasında kartların
// yeniden sıralanması yüksekliği değiştirmesin diye index kullanılmaz.
function pickMasonryHeight(id) {
  const hash = String(id)
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0)

  return MASONRY_HEIGHTS[hash % MASONRY_HEIGHTS.length]
}

export function toCategoryNameMap(categoryRows) {
  return new Map(categoryRows.map((row) => [row.id, row.name]))
}

// Ters yön: kategori ADI → id. Vektör araması kategori id'siyle sorgulanır
// (Chroma metadata'sında id var, ad yok) ama arayüzün her yeri adla çalışır.
export function toCategoryIdMap(categoryRows) {
  return new Map(categoryRows.map((row) => [row.name, row.id]))
}

export function toClothingItem(row, categoryNames) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    brand: row.brand,
    season: row.season,
    categoryId: row.category_id,
    // ClothingCard ve CATEGORY_ICONS kategori adıyla çalışır.
    category: categoryNames.get(row.category_id) ?? 'Diğer',
    imageUrl: row.image_url,
    isFavorite: row.is_favorite,
    isClean: row.is_clean,
    // Postgres NUMERIC kolonları `pg` sürücüsünde STRING döner (float
    // hassasiyet kaybını önlemek için) — `age`'in `toUserProfile`'daki
    // muamelesiyle AYNI ilke: form input'larına doğrudan `value` olarak
    // verilebilsin diye STRING olarak bırakılır, sayıya çevirme yalnızca
    // gönderim anında (QuickAddModal) yapılır.
    purchasePrice: row.purchase_price,
    // Yalnızca `GET /clothing-items/:id` (tekil) taşır — liste uçları
    // BİLİNÇLİ OLARAK taşımaz (bkz. ClothingItemRepository.findById).
    // `undefined` kalmaları (liste yanıtlarında) sorun değil: yalnızca
    // ClothingDetail bu alanları okur.
    totalTimesWorn: row.total_times_worn,
    costPerWear: row.cost_per_wear,
    // Gemini otomatik analizi (Aşama 2). NULL olabilir: analiz arka planda
    // çalışır, henüz bitmemiş ya da hiç yapılamamış olabilir. Kolonun içeriği
    // zaten kendi şemasında (Türkçe anahtarlar) olduğu için camelCase'e
    // ÇEVRİLMEZ — burada yalnızca kolon adı camelCase olur.
    aiAnalysis: row.ai_analysis ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imgHeight: pickMasonryHeight(row.id),
  }
}

export function toClothingItems(rows, categoryNames) {
  return rows.map((row) => toClothingItem(row, categoryNames))
}

// Anket soru anahtarı (styleQuestions.js) ↔ style_preferences kolonu eşlemesi.
const STYLE_ANSWER_TO_FIELD = {
  style: 'dailyStyle',
  colors: 'colorPreference',
  priority: 'priority',
  icon: 'styleIcon',
  frequency: 'frequency',
}

// { style: '...', colors: '...' } → { dailyStyle: '...', colorPreference: '...' }
export function toStylePreferencePayload(answers) {
  const payload = {}
  for (const [answerKey, field] of Object.entries(STYLE_ANSWER_TO_FIELD)) {
    payload[field] = answers[answerKey] ?? null
  }
  return payload
}

// API satırı (snake_case) → anket cevap nesnesi
export function toStyleAnswers(row) {
  if (!row) return {}
  return {
    style: row.daily_style ?? undefined,
    colors: row.color_preference ?? undefined,
    priority: row.priority ?? undefined,
    icon: row.style_icon ?? undefined,
    frequency: row.frequency ?? undefined,
  }
}

export function toUserProfile(row) {
  return {
    id: row.id,
    name: row.name ?? '',
    email: row.email ?? '',
    age: row.age === null || row.age === undefined ? '' : String(row.age),
    city: row.city ?? '',
    subscriptionTier: row.subscription_tier ?? 'free',
  }
}
