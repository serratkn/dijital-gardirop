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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imgHeight: pickMasonryHeight(row.id),
  }
}

export function toClothingItems(rows, categoryNames) {
  return rows.map((row) => toClothingItem(row, categoryNames))
}
