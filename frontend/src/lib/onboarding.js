const STORAGE_KEY = 'dg_onboarding_completed'
const USER_ID_STORAGE_KEY = 'dg_user_id'
const NAME_STORAGE_KEY = 'dg_user_name'
const EMAIL_STORAGE_KEY = 'dg_user_email'
const AGE_STORAGE_KEY = 'dg_user_age'
const STYLE_ANSWERS_STORAGE_KEY = 'dg_style_answers'

// Kimlik doğrulama gelene kadarki geçici çözüm: onboarding'de oluşturulan
// gerçek kullanıcının id'si burada tutulur ve tüm API çağrılarında kullanılır.
export function getUserId() {
  return localStorage.getItem(USER_ID_STORAGE_KEY) || ''
}

export function setUserId(userId) {
  localStorage.setItem(USER_ID_STORAGE_KEY, userId || '')
}

export function isOnboardingCompleted() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function setOnboardingCompleted() {
  localStorage.setItem(STORAGE_KEY, 'true')
}

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
}

export function getUserProfile() {
  return {
    name: localStorage.getItem(NAME_STORAGE_KEY) || '',
    email: localStorage.getItem(EMAIL_STORAGE_KEY) || '',
    age: localStorage.getItem(AGE_STORAGE_KEY) || '',
  }
}

export function setUserProfile({ name, email, age }) {
  localStorage.setItem(NAME_STORAGE_KEY, name || '')
  localStorage.setItem(EMAIL_STORAGE_KEY, email || '')
  localStorage.setItem(AGE_STORAGE_KEY, age || '')
}

export function getStyleAnswers() {
  try {
    return JSON.parse(localStorage.getItem(STYLE_ANSWERS_STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

export function setStyleAnswers(answers) {
  localStorage.setItem(STYLE_ANSWERS_STORAGE_KEY, JSON.stringify(answers))
}

// Çıkışta çağrılır: bir sonraki kullanıcı önceki hesabın önbelleğini görmemeli.
export function clearOnboardingState() {
  for (const key of [
    STORAGE_KEY,
    USER_ID_STORAGE_KEY,
    NAME_STORAGE_KEY,
    EMAIL_STORAGE_KEY,
    AGE_STORAGE_KEY,
    STYLE_ANSWERS_STORAGE_KEY,
  ]) {
    localStorage.removeItem(key)
  }
}
