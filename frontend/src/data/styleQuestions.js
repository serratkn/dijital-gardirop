import { Square, Crown, Sparkles, Heart } from 'lucide-react'

export const STYLE_QUESTIONS = [
  {
    key: 'style',
    question: 'Günlük hayatta nasıl giyinirsin?',
    type: 'buttons',
    options: ['Rahat & Casual', 'Şık & Zarif', 'Sportif & Enerjik', 'Bohem & Özgür'],
  },
  {
    key: 'colors',
    question: 'Hangi renk tonlarına yakınsın?',
    type: 'cards',
    options: [
      { label: 'Nötr & Toprak Tonları', swatches: ['#e4d3b8', '#b08d57', '#6b4a34'] },
      { label: 'Canlı & Cesur Renkler', swatches: ['#c0392b', '#e0a41a', '#1f7a5c'] },
      { label: 'Pastel & Yumuşak Tonlar', swatches: ['#f4d9d9', '#e3ddf0', '#d9e8e0'] },
      { label: 'Siyah-Beyaz & Monokrom', swatches: ['#1c1a17', '#8a8a86', '#f7f3ed'] },
    ],
  },
  {
    key: 'priority',
    question: 'Kombin yaparken en çok neye önem verirsin?',
    type: 'buttons',
    options: ['Rahatlık', 'Şıklık', 'Trend Takibi', 'Fonksiyonellik'],
  },
  {
    key: 'icon',
    question: 'Hangi tarz ikonuna daha yakınsın?',
    type: 'cards',
    options: [
      { label: 'Minimalist', icon: Square },
      { label: 'Klasik & Zamansız', icon: Crown },
      { label: 'Trendy & Cesur', icon: Sparkles },
      { label: 'Romantik & Feminen', icon: Heart },
    ],
  },
  {
    key: 'frequency',
    question: 'Ne sıklıkla yeni kombinler denersin?',
    type: 'buttons',
    options: ['Her Gün Farklı', 'Favorilerim Var', 'Duruma Göre Değişir'],
  },
]
