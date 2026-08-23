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

// Gemini'nin ten tonu analizinde ürettiği renk adları SERBEST METİNDİR ve
// CLOTHING_COLORS paletiyle sınırlı değildir ("Mercan", "Zeytin Yeşili",
// "Kiremit"...). Kullanıcıya renk DAİRESİ gösterebilmek için bu adları da
// tanıyan ek bir sözlük tutuluyor.
//
// Palet DEĞİL, yalnızca gösterim yardımcısı: kıyafet kaydına bu renkler
// yazılmaz, hiçbir seçicide görünmezler.
const AI_RENK_HEX = {
  Mercan: '#f08070',
  Şeftali: '#ffb997',
  Somon: '#fa8072',
  Zeytin: '#808000',
  'Zeytin Yeşili': '#7c8b46',
  Kiremit: '#b7410e',
  'Kiremit Rengi': '#b7410e',
  Taba: '#a0522d',
  Toprak: '#9c6b४4'.replace('४', '4'),
  'Buz Mavisi': '#cfe8f3',
  'Bebek Mavisi': '#a7c7e7',
  'Petrol Mavisi': '#1f4e5f',
  Eflatun: '#9b6bb5',
  Fuşya: '#e0218a',
  'Soğuk Pembe': '#f2a2c0',
  'Canlı Pembe': '#ff5c93',
  'Soğuk Gri': '#9aa3ab',
  'Sıcak Sarı': '#f2c14e',
  Hardal: '#d4a017',
  'Nane Yeşili': '#a8e0c0',
  Zümrüt: '#2e8b57',
  'Zümrüt Yeşili': '#2e8b57',
  Şarap: '#722f37',
  Vişne: '#8b1a2b',
  Antrasit: '#3b3b3b',
  Fildişi: '#f5f0e1',
  Ekru: '#efe4d0',
  Kavuniçi: '#ff8c42',
  Lavanta: '#c3a8e1',
  Gümüşi: '#c0c0c0',
  Bronz: '#cd7f32',
  Bakır: '#b87333',
}

// Renk adından gösterilecek hex. Önce kıyafet paleti, sonra AI sözlüğü,
// bulunamazsa null (çağıran daireyi çizmez, düz etiket gösterir).
export function resolveColorHex(name) {
  const temiz = String(name ?? '').trim()
  if (!temiz) return null

  const paletten = getColorSwatch(temiz)
  if (paletten?.hex) return paletten.hex

  return AI_RENK_HEX[temiz] ?? null
}
