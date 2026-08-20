// Tema tercihinin TEK sahibi. localStorage'a doğrudan dokunmayın —
// `dg_` önekli diğer anahtarlar lib/onboarding.js'in sorumluluğunda,
// tema ise oturumdan bağımsız bir cihaz tercihidir (çıkışta silinmez).
const THEME_STORAGE_KEY = 'dg_theme'

export const THEMES = { LIGHT: 'light', DARK: 'dark' }

// index.html içindeki satır içi script ile AYNI mantık. Orada tekrar edilmesinin
// sebebi: React yüklenene kadar beklenirse sayfa bir kare açık temada boyanır
// ve karanlık modda gözü rahatsız eden bir "beyaz flaş" görünür.
// Bu iki yer birlikte güncellenmelidir.
export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === THEMES.DARK || stored === THEMES.LIGHT ? stored : null
  } catch {
    // Gizli sekmede localStorage erişimi hata verebilir; tema kritik değil.
    return null
  }
}

export function getSystemTheme() {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? THEMES.DARK
    : THEMES.LIGHT
}

// Kayıtlı tercih varsa o kazanır; yoksa sistem tercihi VARSAYILAN olur.
// Kullanıcı bir kez seçim yaptıktan sonra sistem teması değişse bile
// uygulama kullanıcının seçimini korur.
export function getInitialTheme() {
  return getStoredTheme() ?? getSystemTheme()
}

// Tema değişimini dinleyenler (örn. Profil'deki anahtar). Abonelik sayesinde
// sistem teması değiştiğinde arayüzdeki anahtar da kendiliğinden güncellenir;
// aksi hâlde ekranda "Açık" yazarken sayfa karanlık görünebilirdi.
const listeners = new Set()

export function subscribeTheme(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// `applyTheme` DOM'u değiştirir ama kaydetmez; `setTheme` ikisini de yapar.
// Ayrı tutulmalarının sebebi: sistem teması değiştiğinde (kullanıcı henüz
// seçim yapmamışken) temayı uygulamak isteriz ama bunu bir "tercih" olarak
// kaydetmek istemeyiz — kaydedilseydi sistemi takip etmeyi bırakırdı.
export function applyTheme(theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === THEMES.DARK)
  listeners.forEach((listener) => listener(theme))
}

export function setTheme(theme) {
  applyTheme(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Yazılamadıysa tema bu oturumda yine de geçerli; kalıcı olmaz.
  }
}

// Geçişi yumuşatan sınıfı ekler, geçiş bitince kaldırır. Kalıcı bırakılsaydı
// uygulamadaki her hover da 300ms'e uzardı (bkz. index.css).
const TRANSITION_MS = 300
let transitionTimer

export function setThemeAnimated(theme) {
  const root = document.documentElement
  root.classList.add('theme-transition')
  setTheme(theme)

  clearTimeout(transitionTimer)
  transitionTimer = setTimeout(() => {
    root.classList.remove('theme-transition')
  }, TRANSITION_MS)
}

// Kullanıcı henüz elle seçim YAPMADIYSA sistem temasını canlı takip eder.
// Seçim yapıldıysa dinleyici hiçbir şey yapmaz.
export function watchSystemTheme(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}

  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (event) => {
    if (getStoredTheme()) return
    const next = event.matches ? THEMES.DARK : THEMES.LIGHT
    applyTheme(next)
    onChange?.(next)
  }

  query.addEventListener('change', handler)
  return () => query.removeEventListener('change', handler)
}
