const STORAGE_KEY = 'dg_onboarding_completed'
const NAME_STORAGE_KEY = 'dg_user_name'

export function isOnboardingCompleted() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function setOnboardingCompleted() {
  localStorage.setItem(STORAGE_KEY, 'true')
}

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
}

export function getUserName() {
  return localStorage.getItem(NAME_STORAGE_KEY) || ''
}

export function setUserName(name) {
  localStorage.setItem(NAME_STORAGE_KEY, name)
}
