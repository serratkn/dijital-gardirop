const TOKEN_STORAGE_KEY = 'dg_token'

// Token localStorage'da tutuluyor: Capacitor WebView'de de çalışan, sunucu
// tarafı oturum gerektirmeyen en basit yöntem. XSS durumunda okunabilir olması
// bilinen bir ödünleşmedir; httpOnly cookie'ye geçilirse burası değişir.
export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

// JWT payload'ını okur. İMZA DOĞRULANMAZ — bu yalnızca arayüzün kullanıcı
// id'sini ve son kullanma tarihini bilmesi içindir. Yetki kararları her zaman
// sunucuda, token doğrulandıktan sonra verilir.
function decodePayload(token) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))

    // Türkçe karakterlerin bozulmaması için UTF-8 olarak çöz.
    const decoded = decodeURIComponent(
      Array.from(json, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )

    return JSON.parse(decoded)
  } catch {
    return null
  }
}

export function getUserIdFromToken() {
  const payload = decodePayload(getToken())
  return payload?.sub || ''
}

export function isTokenExpired(token = getToken()) {
  const payload = decodePayload(token)
  if (!payload?.exp) return true
  // exp saniye cinsindendir.
  return payload.exp * 1000 <= Date.now()
}

export function hasValidSession() {
  const token = getToken()
  return Boolean(token) && !isTokenExpired(token)
}
