import { Capacitor } from '@capacitor/core'
import { getUserId } from './onboarding'

const DEFAULT_PORT = 3001

// Android native mi? Birincil kaynak Capacitor'dür; ancak Capacitor bir şekilde
// bootstrap edilemezse (bundling/tree-shaking sorunu) native köprü doğrudan
// kontrol edilir — Capacitor'ün kendi platform tespiti de bu köprüye bakar.
function isAndroidNative() {
  try {
    if (Capacitor.getPlatform() === 'android') return true
    if (Capacitor.isNativePlatform?.() && Capacitor.getPlatform() !== 'ios') return true
  } catch {
    // Capacitor yüklenemedi; aşağıdaki köprü kontrolüne düşülür.
  }

  return typeof window !== 'undefined' && Boolean(window.androidBridge)
}

// API adresinin tek belirlendiği yer. Sıra:
//   1) VITE_API_BASE_URL tanımlıysa o kullanılır (gerçek cihaz, staging vb.)
//   2) Android'de 10.0.2.2 — emülatörde "localhost" emülatörün KENDİSİdir,
//      host makineye bu özel alias ile erişilir
//   3) Diğer her yerde (web tarayıcı, iOS simülatörü) localhost
function resolveApiOrigin() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  if (isAndroidNative()) {
    return `http://10.0.2.2:${DEFAULT_PORT}`
  }

  return `http://localhost:${DEFAULT_PORT}`
}

export const API_ORIGIN = resolveApiOrigin()

const API_BASE_URL = `${API_ORIGIN}/api`

// Hangi adresin seçildiği emülatör hata ayıklamasında kritik.
// Logcat'te görmek için: adb logcat | grep "DG_API"
// (Capacitor konsol çıktısını "Capacitor/Console" etiketiyle iletir.)
if (typeof window !== 'undefined') {
  let platform = 'bilinmiyor'
  let native = 'bilinmiyor'
  try {
    platform = Capacitor.getPlatform()
    native = String(Capacitor.isNativePlatform())
  } catch (error) {
    platform = `hata: ${error.message}`
  }

  console.log(
    `DG_API base=${API_BASE_URL} | platform=${platform} native=${native} ` +
      `androidBridge=${Boolean(window.androidBridge)} ` +
      `origin=${window.location.origin} protocol=${window.location.protocol} ` +
      `env=${import.meta.env.VITE_API_BASE_URL ?? '(tanımsız)'}`,
  )
}

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
