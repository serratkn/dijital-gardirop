const API_BASE_URL = 'http://localhost:3001/api'

// Kimlik doğrulama kurulana kadar sabit test kullanıcısı.
// Gerçek oturum sistemi geldiğinde buradan kaldırılacak.
export const CURRENT_USER_ID = 'e4553e3e-3258-4b69-a1d0-001b5d90a83b'

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

export function fetchOutfits(userId) {
  return request(`/outfits?userId=${encodeURIComponent(userId)}`)
}

export function createOutfit(payload) {
  return request('/outfits', { method: 'POST', body: payload })
}
