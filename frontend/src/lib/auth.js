const TOKEN_STORAGE_KEY = 'dg_token'
// Refresh token AYNI mekanizmayla (localStorage) saklanır — httpOnly cookie
// KULLANILMADI: Capacitor WebView'de cookie tabanlı oturum yönetimi
// karmaşıklaşır (Android'de ayrı bir origin/scheme, cookie'lerin native
// isteklerle paylaşılmaması gibi bilinen sorunlar) ve bu depo zaten access
// token için de aynı ödünleşmeyi bilerek yapmıştı. Access token KISA ömürlü
// olduğu için XSS'in okuyabileceği pencere artık çok daha dar; refresh token
// çalınırsa da ROTASYON (bkz. api.js > tryRefreshSession) meşru sahibinin bir
// sonraki sessiz yenilemesinde çalıntı kopyayı geçersiz kılar.
const REFRESH_TOKEN_STORAGE_KEY = 'dg_refresh_token'

// Token localStorage'da tutuluyor: Capacitor WebView'de de çalışan, sunucu
// tarafı oturum gerektirmeyen en basit yöntem. XSS durumunda okunabilir olması
// bilinen bir ödünleşmedir; httpOnly cookie'ye geçilirse burası değişir.
export function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || ''
}

export function setRefreshToken(refreshToken) {
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken)
}

export function clearRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
}

// Login/Register/refresh sonrası ikisi BİRLİKTE yazılır — access token'sız
// bir refresh token (ya da tersi) tutarsız bir oturum durumu yaratırdı.
export function setSession({ token, refreshToken }) {
  setToken(token)
  if (refreshToken) setRefreshToken(refreshToken)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  clearRefreshToken()
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

// Access token artık KISA ömürlü (15dk-1sa, bkz. backend .env.example);
// yalnızca onun süresine bakmak, aktif bir refresh token'ı olan bir
// kullanıcıyı her sayfa yüklemesinde/geçişinde Login'e geri fırlatırdı —
// tam da bu özelliğin ORTADAN KALDIRMAYA çalıştığı "zorla yeniden giriş"
// deneyimi. Bu yüzden GEÇERLİ SAYILIR: access token hâlâ süresi dolmamışsa
// (hızlı yol, ağ isteği gerekmez) YA DA elde (süresi dolmuş olsa bile) bir
// refresh token varsa. İkinci durumda gerçek yenileme burada YAPILMAZ —
// sayfa normal açılır, ilk API çağrısı 401 alır almaz api.js'in
// tryRefreshSession'ı sessizce devreye girer (bkz. request()). Refresh token
// da geçersizse (süresi dolmuş/iptal edilmiş) o ilk çağrı nihayetinde
// notifyUnauthorized()'a düşer ve kullanıcı GERÇEKTEN Login'e yönlendirilir —
// yani buradaki "iyimser" karar, en kötü ihtimalle bir sayfa geçişi
// GECİKMESİYLE aynı sonuca varır, asla yanlış bir "oturum açık" izlenimini
// kalıcı kılmaz.
export function hasValidSession() {
  const token = getToken()
  if (token && !isTokenExpired(token)) return true
  return Boolean(getRefreshToken())
}
