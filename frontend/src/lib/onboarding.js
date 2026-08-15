const STORAGE_KEY = 'dg_onboarding_completed'

export function isOnboardingCompleted() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function setOnboardingCompleted() {
  localStorage.setItem(STORAGE_KEY, 'true')
}

export function resetOnboarding() {
  localStorage.removeItem(STORAGE_KEY)
}
