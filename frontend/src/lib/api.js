import { Capacitor } from '@capacitor/core'
import { clearToken, getRefreshToken, getToken, getUserIdFromToken, setSession } from './auth'

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

// Access token süresi dolduğunda (401) tetiklenen SESSİZ yenileme. Birden
// fazla istek AYNI ANDA 401 alırsa (ör. bir sayfanın Promise.all ile paralel
// çektiği birkaç uç) hepsi TEK bir /auth/refresh çağrısını PAYLAŞIR — modül
// seviyesindeki bu değişken, ikinci ve sonraki çağıranların kendi refresh
// isteklerini atmasını önler (aksi hâlde her biri kendi rotasyonunu tetikler
// ve birbirinin YENİ refresh token'ını anında geçersiz kılardı, bkz. backend
// AuthService.refresh > ROTASYON). Yalnızca BU SEKME içindir — birden fazla
// sekme/pencere arasında paylaşılmaz (bkz. CLAUDE.md, bilinçli bir sınırlama).
let refreshPromise = null

async function performRefresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!response.ok) return false

    const data = await response.json()
    // ROTASYON: backend her başarılı yenilemede YENİ bir refresh token da
    // döner ve ESKİSİNİ anında geçersiz kılar; setSession ikisini BİRLİKTE
    // yazar — yalnızca access token güncellenseydi bir sonraki yenileme
    // artık var olmayan eski refresh token'ı göndermeye devam ederdi.
    setSession({ token: data.token, refreshToken: data.refreshToken })
    return true
  } catch {
    // Ağ hatası, zaman aşımı vb. — yenileme başarısız SAYILIR, çağıran
    // normal 401 akışına (notifyUnauthorized) düşer.
    return false
  }
}

function tryRefreshSession() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// `request`/`requestMultipart`/`fetchSkinTonePhoto`'nun PAYLAŞTIĞI tek fetch
// noktası: 401 alınırsa (ve `allowRefresh` açıksa) sessizce `tryRefreshSession`
// dener, başarılıysa Authorization başlığını YENİ access token'la değiştirip
// isteği BİR KEZ yeniden gönderir — çağıranın kendisi bunu hiç bilmez,
// yalnızca nihai `Response`'u görür. Yeniden deneme yalnızca BİR KEZ yapılır
// (retry sonrası hâlâ 401 ise olduğu gibi döner) — sonsuz döngü riski yok.
async function fetchWithAuth(url, { headers = {}, allowRefresh = true, ...init } = {}) {
  const attempt = (attemptHeaders) => fetch(url, { ...init, headers: attemptHeaders })

  let response = await attempt(headers)

  if (response.status === 401 && allowRefresh && headers.Authorization) {
    const refreshed = await tryRefreshSession()
    if (refreshed) {
      response = await attempt({ ...headers, Authorization: `Bearer ${getToken()}` })
    }
  }

  return response
}

// Tüm isteklerin tek geçtiği nokta: Authorization başlığı burada eklenir,
// böylece hiçbir çağrı yerinde token yönetmek zorunda kalmaz.
// keepSessionOn401: bazı uçlarda 401 "oturum düştü" değil "girilen şifre yanlış"
// demektir (örn. şifre değiştirme). Bu durumda kullanıcı dışarı atılmamalı VE
// sessiz yenileme denenmemelidir (yanlış şifre bir oturum sorunu değildir).
// timeoutMs: isteğin en fazla ne kadar bekleyeceği. Varsayılan YOK (sınırsız) —
// çoğu uç için tarayıcının kendi davranışı yeterli. Yalnızca kullanıcının
// ekrana bakıp beklediği ve BAŞARISIZLIĞI TOLERE EDİLEBİLEN çağrılarda
// kullanılır (bkz. fetchCompanions).
async function request(
  endpoint,
  { method = 'GET', body, skipAuth = false, keepSessionOn401 = false, timeoutMs } = {},
) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'

  if (!skipAuth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const response = await fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
    allowRefresh: !skipAuth && !keepSessionOn401,
  })

  if (!response.ok) {
    // 401: sessiz yenileme de (denendiyse) başarısız oldu → oturumu düşür ve
    // dinleyicileri uyar. Giriş/kayıt isteklerinde (skipAuth) ya da
    // keepSessionOn401 uçlarında 401 "şifre hatalı" demektir, oturum
    // düşürülmemelidir.
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


// Dosya yükleyen tüm çağrıların ortak yolu.
//
// FormData gönderirken Content-Type ELLE ayarlanmaz: tarayıcının multipart
// sınır (boundary) değerini kendisi eklemesi gerekir — bu yüzden JSON gönderen
// `request` yerine ayrı bir yol var.
async function requestMultipart(
  endpoint,
  formData,
  { timeoutMs, errorPrefix = 'Fotoğraf yüklenemedi' } = {},
) {
  const token = getToken()
  const response = await fetchWithAuth(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  })

  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized()

    let message = `${errorPrefix} (${response.status})`
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

export function uploadClothingItemImage(id, file) {
  const formData = new FormData()
  formData.append('image', file)

  return requestMultipart(`/clothing-items/${encodeURIComponent(id)}/image`, formData)
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

// GERÇEK çıkış: refresh token'ı sunucuda (veritabanında) SİLER — yalnızca
// localStorage'ı temizlemek yetmez, aksi hâlde çalınmış (ya da unutulmuş bir
// cihazdaki) bir kopya oturumu canlı tutmaya devam ederdi. `skipAuth`/
// `keepSessionOn401` GEREKMEZ: bu uç zaten `authenticate`'in arkasında,
// normal 401 davranışı (sessiz yenile, o da başarısızsa Login'e düş) burada
// da doğru olan davranıştır.
export function logout() {
  return request('/auth/logout', { method: 'POST' })
}

export function changePassword(payload) {
  // Buradaki 401 "mevcut şifren yanlış" demektir; oturumu düşürmemeli.
  return request('/auth/change-password', {
    method: 'POST',
    body: payload,
    keepSessionOn401: true,
  })
}

// "Şifremi Unuttum" — register/login ile AYNI şekilde skipAuth: token yok,
// Bearer başlığı denenmemeli. Backend e-posta kayıtlı olsun olmasın AYNI
// (204) yanıtı döner (bkz. AuthService.forgotPassword) — hangi e-postaların
// kayıtlı olduğu sızmasın diye; frontend bu yüzden başarı/başarısızlık
// ayrımı YAPMAZ, her zaman aynı "gönderildiyse ulaşacak" mesajını gösterir.
export function forgotPassword(email) {
  return request('/auth/forgot-password', { method: 'POST', body: { email }, skipAuth: true })
}

// Sıfırlama formunun gönderdiği token GEÇERSİZ/SÜRESİ DOLMUŞ olabilir —
// buradaki 401 gerçek bir form hatasıdır (oturum düşürme anlamına gelmez,
// zaten oturum YOK), bu yüzden de skipAuth: true.
export function resetPassword(token, newPassword) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
    skipAuth: true,
  })
}

// Vektör okuma uçlarının istemci tarafı zaman aşımı. İki çağrının da ortak
// özelliği var: kullanıcı ekrana bakıp bekliyor ve BAŞARISIZLIK TOLERE
// EDİLEBİLİR (sonuç yoksa bölüm gösterilmez / rastgele seçime düşülür).
// Bu yüzden süresiz beklemektense vazgeçmek her zaman daha iyi.
const VECTOR_REQUEST_TIMEOUT_MS = 4000

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

// Metin alanlarını günceller (isim, kategori, renk, sezon, temiz/kirli).
// FOTOĞRAF BU UCUN İŞİ DEĞİLDİR — backend zaten image_url'e dokunmuyor
// (ClothingItemService.updateItem mevcut fotoğrafı korur), burada da payload'a
// hiç eklenmiyor. Fotoğraf değişikliği ayrı uçlardan yönetilir
// (uploadClothingItemImage / deleteClothingItemImage, "Fotoğrafı Değiştir" akışı).
export function updateClothingItem(id, payload) {
  return request(`/clothing-items/${encodeURIComponent(id)}`, { method: 'PUT', body: payload })
}

export function toggleClothingItemFavorite(id) {
  return request(`/clothing-items/${encodeURIComponent(id)}/favorite`, { method: 'PATCH' })
}

export function toggleClothingItemCleanStatus(id) {
  return request(`/clothing-items/${encodeURIComponent(id)}/clean-status`, { method: 'PATCH' })
}

// "Yeniden Analiz Et" — mevcut analizin üzerine yazar (backend force:true).
//
// SENKRONDUR: yanıt geldiğinde analiz bitmiştir ve gövde güncel kaydı taşır.
// Zaman aşımı, sunucunun KENDİ en kötü senaryosunun (2 deneme x 30 sn Gemini
// zaman aşımı + eşzamanlılık kuyruğu) ÜSTÜNDE tutuldu; erken kesilseydi sunucu
// analizi yazmaya devam eder, arayüz ise "olmadı" der ve ekran bayat kalırdı.
// Yani bu sınır normal işleyişte hiç devreye girmez, yalnızca gerçekten
// takılmış bir istek için son çıkıştır.
const REANALYZE_TIMEOUT_MS = 90000

// Ten tonu analizi de senkron ve aynı Gemini sınırlarına tabi.
const SKIN_TONE_TIMEOUT_MS = 90000

export function reanalyzeClothingItem(id) {
  return request(`/clothing-items/${encodeURIComponent(id)}/analyze`, {
    method: 'POST',
    timeoutMs: REANALYZE_TIMEOUT_MS,
  })
}

export function deleteClothingItem(id) {
  return request(`/clothing-items/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// AŞAMA 4 — Kombin Öner'in akıllı eşleştirme çağrısı. Başlangıç parçasına
// vektör uzayında en yakın adayları, istenen DİĞER kategorilerden döndürür.
//
// ÇAĞIRAN HATAYI YUTMALIDIR: ChromaDB kapalıysa uç 503 döner ve bu bir kırılma
// değil, "rastgele seçime düş" işaretidir (bkz. lib/outfitBuilder.js).
// Zaman aşımı kısa tutuldu: kullanıcı öneri ekranına bakıp bekliyor, birkaç
// saniyeden fazlası için beklemektense rastgele bir kombin göstermek daha iyi.
export function fetchCompanions(id, { categoryIds, limit } = {}) {
  const params = new URLSearchParams({ categoryIds: categoryIds.join(',') })
  if (limit) params.set('limit', String(limit))

  return request(`/clothing-items/${encodeURIComponent(id)}/companions?${params}`, {
    timeoutMs: VECTOR_REQUEST_TIMEOUT_MS,
  })
}

// Kıyafet Detay'daki "Buna Benzer Diğer Parçalar" bölümünün çağrısı.
//
// NEDEN /companions DEĞİL: /companions kombin kurmak için var ve başlangıç
// parçasının KENDİ kategorisini hedeflerden bilerek düşürüyor (kombin slotu
// başka bir kategoriye ait; hedef kalmazsa 400 döner). Burada istenen tam
// tersi — aynı kategoriden komşular. /similar zaten tam olarak bunu yapıyor:
// kendisini eler, kullanıcıyla filtreler, Postgres'ten zenginleştirir.
//
// ÇAĞIRAN HATAYI YUTMALIDIR: Chroma kapalıysa uç 503 döner ve bu bir kırılma
// değil, "bölümü gösterme" işaretidir.
export function fetchSimilarItems(id, { categoryId, limit } = {}) {
  const params = new URLSearchParams()
  if (categoryId !== undefined && categoryId !== null) params.set('categoryId', String(categoryId))
  if (limit) params.set('limit', String(limit))

  return request(`/clothing-items/${encodeURIComponent(id)}/similar?${params}`, {
    timeoutMs: VECTOR_REQUEST_TIMEOUT_MS,
  })
}

// AŞAMA 5 — serbest metin (mood) kutusunun seed parça seçimini besleyen çağrı.
// fetchCompanions/fetchSimilarItems'tan farkı: bir başlangıç parçasına değil,
// kullanıcının kendi cümlesine (arama_metni) bakar ve TÜM indekslenmiş
// gardırobu bu cümleye yakınlığa göre sıralar. Bu yüzden HER ÇAĞRIDA gerçek
// bir Gemini embedding isteği atar (fetchCompanions/fetchSimilarItems atmaz,
// yalnızca Chroma okur) — zaman aşımı bilerek daha CÖMERTTİR
// (VECTOR_REQUEST_TIMEOUT_MS'in aksine): backend iki ayrı adımı (embedding +
// sorgu) art arda çalıştırıyor, her biri kendi 3 sn'lik payını kullanabilir.
//
// ÇAĞIRAN HATAYI YUTMALIDIR: bu istek başarısız olursa (Gemini/Chroma
// erişilemez, kota dolu, metin boş) seed parça seçimi sessizce rastgele
// moda düşer — "sessizce geri düş" kararı yine istemcinindir
// (bkz. lib/outfitBuilder.js > pickSeedItem, textRanking opsiyonel).
const TEXT_SEARCH_TIMEOUT_MS = 8000

export function searchClothingItemsByText(text, { limit } = {}) {
  return request('/clothing-items/search-by-text', {
    method: 'POST',
    body: { text, limit },
    timeoutMs: TEXT_SEARCH_TIMEOUT_MS,
  })
}

// clothingItemId verilirse yalnızca o parçanın geçtiği kombinler döner
// (Kıyafet Detay sayfasındaki "Bu Kıyafetle Yapılan Kombinler" bölümü).
export function fetchOutfits(clothingItemId) {
  const query = clothingItemId
    ? `?clothingItemId=${encodeURIComponent(clothingItemId)}`
    : ''
  return request(`/outfits${query}`)
}

export function createOutfit(payload) {
  return request('/outfits', { method: 'POST', body: payload })
}

// Kombin Öner'deki serbest metin kutusunun ucu. Kullanıcının kendi
// cümlelerini standart bir occasion'a ve kısa bir özete çevirir.
//
// ÇAĞIRAN HATAYI YUTMALIDIR: Gemini erişilemezse/kota dolduysa/anahtar yoksa
// bu 503 (ya da metin çok uzunsa 400) fırlatır — bu bir kırılma değil,
// "ham metni occasion olarak kullanmaya devam et" işaretidir (fetchCompanions
// ile aynı ilke: API dürüst kalır, "sessizce geri düş" kararı istemcinindir).
// Retry YOK (tek deneme) — sunucunun kendi tek denemesiyle eşleşen bir zaman
// aşımı yeterli, `reanalyzeClothingItem`'in retry'lı 90 sn'sine gerek yok.
const INTERPRET_OUTFIT_TIMEOUT_MS = 40000

export function interpretOutfitRequest(text) {
  return request('/outfits/interpret', {
    method: 'POST',
    body: { text },
    timeoutMs: INTERPRET_OUTFIT_TIMEOUT_MS,
  })
}

export function toggleOutfitFavorite(id) {
  return request(`/outfits/${encodeURIComponent(id)}/favorite`, { method: 'PATCH' })
}

// "Bugün Giydim" — times_worn'u atomik olarak +1 artırır (sunucu tarafında
// UPDATE ... SET times_worn = times_worn + 1, yarış durumu yok).
export function markOutfitAsWorn(id) {
  return request(`/outfits/${encodeURIComponent(id)}/worn`, { method: 'PATCH' })
}

export function deleteOutfit(id) {
  return request(`/outfits/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// Hava durumu uç noktası HER ZAMAN 200 döner; başarısızlık
// { status: 'bilinmiyor' } olarak gelir, exception olarak değil.
export function fetchWeather(city) {
  return request(`/weather?city=${encodeURIComponent(city)}`)
}

export function fetchUser(id) {
  return request(`/users/${encodeURIComponent(id)}`)
}

export function updateUser(id, payload) {
  return request(`/users/${encodeURIComponent(id)}`, { method: 'PUT', body: payload })
}

// Gardırop istatistikleri. Sunucu hazır ÖZET döner (ham kayıt değil), bu yüzden
// istemcide ek bir hesaplama/dönüştürme yapılmaz.
export function fetchWardrobeStats(userId) {
  return request(`/users/${encodeURIComponent(userId)}/stats`)
}

// --- Ten tonu analizi (isteğe bağlı özellik) ---
//
// Selfie HASSAS VERİDİR: bu uçlar yalnızca oturum sahibinin kendi kaydını
// döndürür (sunucu kimliği token'dan okur, yolda ":id" yoktur) ve analiz
// başka hiçbir akışta — paylaşım görseli dahil — kullanılmaz.

// Analizi yoksa { analiz: null, foto_url: null } döner; bu bir HATA DEĞİLDİR.
export function fetchSkinToneAnalysis() {
  return request('/users/skin-tone-analysis')
}

// Selfie yükler ve SENKRON olarak analiz eder. Zaman aşımı, sunucunun kendi
// en kötü senaryosunun (2 deneme x 30 sn) üstünde tutuldu; erken kesilseydi
// sunucu analizi yazmaya devam eder, arayüz "olmadı" derdi.
export function uploadSkinToneSelfie(file) {
  const body = new FormData()
  body.append('image', file)

  return requestMultipart('/users/skin-tone-analysis', body, {
    timeoutMs: SKIN_TONE_TIMEOUT_MS,
  })
}

export function deleteSkinToneAnalysis() {
  return request('/users/skin-tone-analysis', { method: 'DELETE' })
}

// Selfie'nin KENDİSİ artık /uploads/... İLE DEĞİL, bu token'lı uçtan blob
// olarak çekilir (backend bunu express.static ile değil, doğrudan controller'dan
// okuyup gönderir — bkz. CLAUDE.md). Çağıran taraf blob'u URL.createObjectURL
// ile <img src>'e çevirir ve iş bittiğinde revokeObjectURL ile serbest bırakır
// (PhotoPicker'daki aynı yaşam döngüsü deseni).
//
// Analiz/selfie yoksa backend 404 döner; bu bir HATA DEĞİLDİR — null dönülür,
// çağıran taraf görseli hiç göstermez.
export async function fetchSkinTonePhoto() {
  const token = getToken()
  const response = await fetchWithAuth(`${API_BASE_URL}/users/skin-tone-analysis/photo`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (response.status === 404) return null

  if (!response.ok) {
    if (response.status === 401) notifyUnauthorized()
    throw new Error(`Selfie alınamadı (${response.status})`)
  }

  return response.blob()
}

export function fetchStylePreferences() {
  return request('/style-preferences')
}

export function saveStylePreferences(payload) {
  return request('/style-preferences', { method: 'PUT', body: payload })
}
