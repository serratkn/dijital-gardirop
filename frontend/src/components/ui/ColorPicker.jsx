import { Check } from 'lucide-react'
import { CLOTHING_COLORS } from '../../lib/colors'

// Açık renkler ivory zeminde kaybolmasın diye her daire ince bir çerçeve taşır;
// seçili olan burgundy halka ile vurgulanır.
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
                className={isDark || color.gradient ? 'text-ivory' : 'text-ink/70'}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export default ColorPicker
