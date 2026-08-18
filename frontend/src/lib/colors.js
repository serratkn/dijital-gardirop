// Gardırop renk paleti. `name` veritabanına yazılan değerdir
// (clothing_items.color, VARCHAR(50)); `hex` yalnızca arayüzdeki
// renk dairesini boyamak için kullanılır.
export const CLOTHING_COLORS = [
  { name: 'Beyaz', hex: '#ffffff' },
  { name: 'Siyah', hex: '#1c1a17' },
  { name: 'Gri', hex: '#8a8a86' },
  { name: 'Bej', hex: '#e4d3b8' },
  { name: 'Kahverengi', hex: '#6b4a34' },
  { name: 'Lacivert', hex: '#1e2a47' },
  { name: 'Mavi', hex: '#3d6ea8' },
  { name: 'Turkuaz', hex: '#2ea39e' },
  { name: 'Yeşil', hex: '#4a7c59' },
  { name: 'Haki', hex: '#7a7a52' },
  { name: 'Sarı', hex: '#e0b83a' },
  { name: 'Turuncu', hex: '#d97b3c' },
  { name: 'Kırmızı', hex: '#c0392b' },
  { name: 'Bordo', hex: '#7a3b3b' },
  { name: 'Pembe', hex: '#e8a0b4' },
  { name: 'Pudra', hex: '#f0d5d5' },
  { name: 'Mor', hex: '#6b4a7c' },
  { name: 'Lila', hex: '#b9a3d1' },
  { name: 'Krem', hex: '#f5ecd9' },
  { name: 'Altın', hex: '#c9a961' },
  { name: 'Gümüş', hex: '#c0c4c8' },
  // Tek bir renkle temsil edilemeyeceği için desenli gösterilir.
  { name: 'Çok Renkli', gradient: 'linear-gradient(135deg,#c0392b,#e0b83a,#4a7c59,#3d6ea8,#6b4a7c)' },
]

export const DEFAULT_COLOR = CLOTHING_COLORS[0].name

export function getColorSwatch(name) {
  return CLOTHING_COLORS.find((color) => color.name === name) ?? null
}
