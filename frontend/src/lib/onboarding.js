const STORAGE_KEY = 'dg_onboarding_completed'
const NAME_STORAGE_KEY = 'dg_user_name'
const EMAIL_STORAGE_KEY = 'dg_user_email'
const AGE_STORAGE_KEY = 'dg_user_age'

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
