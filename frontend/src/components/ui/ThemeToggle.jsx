import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { THEMES, getInitialTheme, setThemeAnimated, subscribeTheme } from '../../lib/theme'

// Açık/Koyu anahtarı. Tema DOM'a theme.js tarafından uygulanır; bu bileşen
// yalnızca mevcut değeri gösterir ve değiştirir — böylece tek doğru kaynak
// korunur ve anahtar, sistem teması değiştiğinde de kendiliğinden güncellenir.
function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => subscribeTheme(setTheme), [])

  const isDark = theme === THEMES.DARK

  const toggle = () => {
    setThemeAnimated(isDark ? THEMES.LIGHT : THEMES.DARK)
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {isDark ? (
        <Moon size={18} strokeWidth={1.5} className="text-ink/40" />
      ) : (
        <Sun size={18} strokeWidth={1.5} className="text-ink/40" />
      )}

      <span className="flex-1 text-sm font-medium text-ink">Görünüm</span>

      <span className="text-xs uppercase tracking-[0.15em] text-ink/40">
        {isDark ? 'Koyu' : 'Açık'}
      </span>

      {/* Anahtarın kendisi bir <button role="switch">: <input type="checkbox">
          yerine bunun seçilmesinin sebebi, ekran okuyucuya "açık/kapalı" yerine
          doğrudan tema durumunu bildirmek ve tasarım sistemindeki hap (pill)
          biçimini stil savaşı olmadan uygulayabilmek. */}
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Karanlık modu aç/kapat"
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40 ${
          isDark ? 'border-burgundy bg-burgundy' : 'border-ink/15 bg-warm-gray'
        }`}
      >
        <span
          className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all duration-200 ${
            isDark ? 'left-[1.5rem] bg-on-primary' : 'left-1 bg-surface'
          }`}
        />
      </button>
    </div>
  )
}

export default ThemeToggle
