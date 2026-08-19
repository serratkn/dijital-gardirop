import { Capacitor } from '@capacitor/core'
import { clearToken, getToken, getUserIdFromToken } from './auth'

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

// Oturum düştüğünde (401) uygulamanın Login'e yönlenebilmesi için abonelik.
// App.jsx bunu dinler; api.js'in router'a bağımlı olmaması için olay tabanlı.
const unauthorizedListeners = new Set()

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

function notifyUnauthorized() {
  clearToken()
  unauthorizedListeners.forEach((listener) => listener())
}

// Tüm isteklerin tek geçtiği nokta: Authorization başlığı burada eklenir,
// böylece hiçbir çağrı yerinde token yönetmek zorunda kalmaz.
// keepSessionOn401: bazı uçlarda 401 "oturum düştü" değil "girilen şifre yanlış"
// demektir (örn. şifre değiştirme). Bu durumda kullanıcı dışarı atılmamalıdır.
async function request(
  endpoint,
  { method = 'GET', body, skipAuth = false, keepSessionOn401 = false } = {},
) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'

  if (!skipAuth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    // 401: token yok/süresi dolmuş → oturumu düşür ve dinleyicileri uyar.
    // Giriş/kayıt isteklerinde (skipAuth) 401 "şifre hatalı" demektir,
    // oturum düşürülmemelidir.
    if (response.status === 401 && !skipAuth && !keepSessionOn401) {
      notifyUnauthorized()
    }

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

// Kullanıcı kimliği artık token'dan gelir; localStorage'daki ayrı bir
// "dg_user_id" değerine güvenilmez.
export function getCurrentUserId() {
  return getUserIdFromToken()
}

// Backend image_url'i GÖRELİ saklar ("/uploads/abc.jpg") çünkü aynı kayda
// web localhost'tan, Android 10.0.2.2'den erişir. Doğru host'u burada ekliyoruz.
export function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null
  if (/^(https?:|data:|blob:)/.test(imageUrl)) return imageUrl
  return `${API_ORIGIN}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`
}

// FormData gönderirken Content-Type ELLE ayarlanmaz: tarayıcının multipart
// sınır (boundary) değerini kendisi eklemesi gerekir.
export async function uploadClothingItemImage(id, file) {
  const formData = new FormData()
  formData.append('image', file)

  const token = getToken()
  const response = await fetch(
    `${API_BASE_URL}/clothing-items/${encodeURIComponent(id)}/image`,
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    },
  )

  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized()

    let message = `Fotoğraf yüklenemedi (${response.status})`
    try {
      const data = await response.json()
      if (data?.error) message = data.error
    } catch {
      // Gövde okunamadı; varsayılan mesaj kalır.
    }
    throw new Error(message)
  }

  return response.json()
}

export function deleteClothingItemImage(id) {
  return request(`/clothing-items/${encodeURIComponent(id)}/image`, { method: 'DELETE' })
}

// --- Auth ---
export function register(payload) {
  return request('/auth/register', { method: 'POST', body: payload, skipAuth: true })
}

export function login(payload) {
  return request('/auth/login', { method: 'POST', body: payload, skipAuth: true })
}

export function fetchMe() {
  return request('/auth/me')
}

export function changePassword(payload) {
  // Buradaki 401 "mevcut şifren yanlış" demektir; oturumu düşürmemeli.
  return request('/auth/change-password', {
    method: 'POST',
    body: payload,
    keepSessionOn401: true,
  })
}

// --- Kaynaklar (userId artık gönderilmez: sunucu token'dan okur) ---
export function fetchCategories() {
  return request('/categories')
}

export function fetchClothingItems() {
  return request('/clothing-items')
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

export function fetchOutfits() {
  return request('/outfits')
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

export function updateUser(id, payload) {
  return request(`/users/${encodeURIComponent(id)}`, { method: 'PUT', body: payload })
}

export function fetchStylePreferences() {
  return request('/style-preferences')
}

export function saveStylePreferences(payload) {
  return request('/style-preferences', { method: 'PUT', body: payload })
}
