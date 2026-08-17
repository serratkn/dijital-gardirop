const API_BASE_URL = 'http://localhost:3001/api'

// Kimlik doğrulama kurulana kadar sabit test kullanıcısı.
// Gerçek oturum sistemi geldiğinde buradan kaldırılacak.
export const CURRENT_USER_ID = 'e4553e3e-3258-4b69-a1d0-001b5d90a83b'

async function request(endpoint) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`)

  if (!response.ok) {
    throw new Error(`İstek başarısız oldu (${response.status}): ${endpoint}`)
  }

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
