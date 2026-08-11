export const CATEGORIES = ['Üst', 'Alt', 'Elbise', 'Ayakkabı', 'Çanta', 'Makyaj']

// Deliberately non-repeating sequence so the masonry grid reads as irregular, not patterned.
const HEIGHTS = [
  'h-64', 'h-44', 'h-72', 'h-52', 'h-60',
  'h-48', 'h-68', 'h-40', 'h-76', 'h-56',
  'h-44', 'h-72', 'h-52', 'h-64', 'h-48',
  'h-60', 'h-40', 'h-68', 'h-56', 'h-44',
  'h-52', 'h-68', 'h-44', 'h-60',
]

export const CLOTHES = [
  { id: 1, name: 'Zara Oversize Beyaz Gömlek', category: 'Üst', imgHeight: HEIGHTS[0] },
  { id: 2, name: 'H&M Siyah Basic Tişört', category: 'Üst', imgHeight: HEIGHTS[1] },
  { id: 3, name: 'Mango Örgü Kazak', category: 'Üst', imgHeight: HEIGHTS[2] },
  { id: 4, name: 'Bershka Denim Ceket', category: 'Üst', imgHeight: HEIGHTS[3] },

  { id: 5, name: "Levi's 501 Mom Jean", category: 'Alt', imgHeight: HEIGHTS[4] },
  { id: 6, name: 'Zara Yüksek Bel Kumaş Pantolon', category: 'Alt', imgHeight: HEIGHTS[5] },
  { id: 7, name: 'Mango Pileli Midi Etek', category: 'Alt', imgHeight: HEIGHTS[6] },
  { id: 8, name: 'H&M Jogger Eşofman Altı', category: 'Alt', imgHeight: HEIGHTS[7] },

  { id: 9, name: 'Zara Uzun Saten Elbise', category: 'Elbise', imgHeight: HEIGHTS[8] },
  { id: 10, name: 'H&M Volanlı Mini Elbise', category: 'Elbise', imgHeight: HEIGHTS[9] },
  { id: 11, name: 'Mango Keten Midi Elbise', category: 'Elbise', imgHeight: HEIGHTS[10] },
  { id: 12, name: 'Bershka Askılı Yazlık Elbise', category: 'Elbise', imgHeight: HEIGHTS[11] },

  { id: 13, name: 'Nike Air Force 1 Beyaz Sneaker', category: 'Ayakkabı', imgHeight: HEIGHTS[12] },
  { id: 14, name: 'Zara Topuklu Rugan Ayakkabı', category: 'Ayakkabı', imgHeight: HEIGHTS[13] },
  { id: 15, name: 'Converse Chuck Taylor Siyah', category: 'Ayakkabı', imgHeight: HEIGHTS[14] },
  { id: 16, name: 'Bershka Chelsea Bot', category: 'Ayakkabı', imgHeight: HEIGHTS[15] },

  { id: 17, name: 'Zara Mini Omuz Çantası', category: 'Çanta', imgHeight: HEIGHTS[16] },
  { id: 18, name: 'Mango Deri Tote Çanta', category: 'Çanta', imgHeight: HEIGHTS[17] },
  { id: 19, name: 'Bershka Crossbody Çanta', category: 'Çanta', imgHeight: HEIGHTS[18] },
  { id: 20, name: 'Pull&Bear Askılı Mini Çanta', category: 'Çanta', imgHeight: HEIGHTS[19] },

  { id: 21, name: 'MAC Ruby Woo Mat Ruj', category: 'Makyaj', imgHeight: HEIGHTS[20] },
  { id: 22, name: 'Maybelline Fit Me Fondöten', category: 'Makyaj', imgHeight: HEIGHTS[21] },
  { id: 23, name: 'Rimmel Scandaleyes Maskara', category: 'Makyaj', imgHeight: HEIGHTS[22] },
  { id: 24, name: 'NYX Allık Paleti', category: 'Makyaj', imgHeight: HEIGHTS[23] },
]
