// `dg_intro_seen` bayrağının tek sahibi. `dg_theme` ile AYNI gerekçeyle
// `lib/onboarding.js`'in DIŞINDA tutulur: bu bir OTURUM verisi değil CİHAZ
// tercihidir ("bu cihazda tanıtım ekranı hiç gösterildi mi") — çıkışta
// `clearOnboardingState()` ile silinmemelidir, aksi hâlde aynı cihazda çıkış
// yapan her kullanıcı tanıtımı yeniden görürdü.
const INTRO_SEEN_KEY = 'dg_intro_seen'

export function hasSeenIntro() {
  return localStorage.getItem(INTRO_SEEN_KEY) === 'true'
}

export function markIntroSeen() {
  localStorage.setItem(INTRO_SEEN_KEY, 'true')
}
