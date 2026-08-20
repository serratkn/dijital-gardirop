import { Check } from 'lucide-react'
import { CLOTHING_COLORS } from '../../lib/colors'

// Açık renkler ivory zeminde kaybolmasın diye her daire ince bir çerçeve taşır;
// seçili olan burgundy halka ile vurgulanır.
//
// Onay ikonunun rengi TEMAYA BAĞLI DEĞİLDİR ve olmamalıdır: arkasında duran şey
// kıyafetin GERÇEK rengidir (bir veri değeri), karanlık modda değişmez. Token
// kullanılsaydı ikon karanlık modda ters dönüp siyah dairede siyah, beyaz
// dairede beyaz görünürdü — yani tam da kaçınmak istediğimiz okunmazlık.
const CHECK_ON_DARK = 'text-[#f7f3ed]'
const CHECK_ON_LIGHT = 'text-[#1c1a17]'
function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CLOTHING_COLORS.map((color) => {
        const isSelected = value === color.name
        const isDark = ['Siyah', 'Lacivert', 'Kahverengi', 'Bordo', 'Mor', 'Yeşil'].includes(
          color.name,
        )

        return (
          <button
            key={color.name}
            type="button"
            onClick={() => onChange(color.name)}
            title={color.name}
            aria-label={color.name}
            aria-pressed={isSelected}
            className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 ${
              isSelected
                ? 'border-burgundy ring-2 ring-burgundy/30'
                : 'border-ink/15 hover:border-dusty-rose'
            }`}
            style={{ background: color.gradient ?? color.hex }}
          >
            {isSelected && (
              <Check
                size={14}
                strokeWidth={2.5}
                className={isDark || color.gradient ? CHECK_ON_DARK : CHECK_ON_LIGHT}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export default ColorPicker
