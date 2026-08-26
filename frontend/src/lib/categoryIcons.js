import { Shirt, PanelBottom, Triangle, Footprints, Handbag, Sparkles, Snowflake } from 'lucide-react'

// lucide-react'te (v1.31.0) doğrudan bir "mont/kaban" ikonu yok; Snowflake
// bilerek seçildi — kategori zaten yalnızca soğuk havada devreye giren
// koşullu bir slotu temsil ediyor (bkz. outfitBuilder.js > OUTERWEAR_CATEGORY).
export const CATEGORY_ICONS = {
  Üst: Shirt,
  Alt: PanelBottom,
  Elbise: Triangle,
  Ayakkabı: Footprints,
  Çanta: Handbag,
  Makyaj: Sparkles,
  'Dış Giyim': Snowflake,
}
