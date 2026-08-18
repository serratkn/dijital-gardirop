import { getUserId } from './onboarding'

const API_BASE_URL = 'http://localhost:3001/api'

// Onboarding'i tamamlamamış (veya localStorage'ı temizlenmiş) tarayıcılar için
// yedek kullanıcı. Gerçek oturum sistemi geldiğinde ikisi de kaldırılacak.
const FALLBACK_USER_ID = 'e4553e3e-3258-4b69-a1d0-001b5d90a83b'

// Sabit yerine fonksiyon: kullanıcı onboarding'de oluşturulduğunda id değişir,
// bu yüzden her çağrıda güncel değer okunmalıdır.
export function getCurrentUserId() {
  return getUserId() || FALLBACK_USER_ID
}

async function request(endpoint, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    // Backend hataları { error: "..." } biçiminde ve Türkçe döner;
    // varsa o mesajı kullanıcıya gösterebilmek için okuyoruz.
    let message = `İstek başarısız oldu (${response.status})`
    try {
      const data = await response.json()
      if (data?.error) message = data.error
    } catch {
      // Gövde okunamadıysa varsayılan mesajla devam.
    }
    throw new Error(message)
  }

  if (response.status === 204) return null

  return response.json()
}

export function fetchCategories() {
  return request('/categories')
}

export function fetchClothingItems(userId) {
  return request(`/clothing-items?userId=${encodeURIComponent(userId)}`)
}

export function fetchClothingItem(id) {
  return request(`/clothing-items/${encodeURIComponent(id)}`)
}

export function createClothingItem(payload) {
  return request('/clothing-items', { method: 'POST', body: payload })
}

export function toggleClothingItemFavorite(id) {
  return request(`/clothing-items/${encodeURIComponent(id)}/favorite`, { method: 'PATCH' })
}

export function deleteClothingItem(id) {
  return request(`/clothing-items/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function fetchOutfits(userId) {
  return request(`/outfits?userId=${encodeURIComponent(userId)}`)
}

export function createOutfit(payload) {
  return request('/outfits', { method: 'POST', body: payload })
}

export function toggleOutfitFavorite(id) {
  return request(`/outfits/${encodeURIComponent(id)}/favorite`, { method: 'PATCH' })
}

export function deleteOutfit(id) {
  return request(`/outfits/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function fetchUser(id) {
  return request(`/users/${encodeURIComponent(id)}`)
}

export function createUser(payload) {
  return request('/users', { method: 'POST', body: payload })
}

export function updateUser(id, payload) {
  return request(`/users/${encodeURIComponent(id)}`, { method: 'PUT', body: payload })
}

export function fetchStylePreferences(userId) {
  return request(`/style-preferences?userId=${encodeURIComponent(userId)}`)
}

export function saveStylePreferences(payload) {
  return request('/style-preferences', { method: 'PUT', body: payload })
}
