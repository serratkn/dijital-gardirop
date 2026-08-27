// Resend (https://resend.com) üzerinden e-posta gönderir. Bu repository
// veritabanına değil DIŞ BİR SERVİSE bakar — WeatherRepository ile AYNI rol:
// yalnızca ham istek, iş kuralı yok. Hata durumunda FIRLATIR; sessize alma
// kararı çağıran servise (AuthService) aittir.
const API_URL = 'https://api.resend.com/emails'

// Dış servis yanıt vermezse istek burada kesilir. Olmasaydı takılan bir
// Resend isteği "şifremi unuttum" formunu süresiz beklemeye düşürürdü.
const REQUEST_TIMEOUT_MS = 8000

// Resend'in kendi paylaşılan test adresi: hesap doğrulaması GEREKTİRMEZ ama
// YALNIZCA Resend hesabının kendi sahibinin e-postasına gönderim yapabilir
// (Resend'in sandbox kısıtı). Gerçek kullanıcılara göndermek için Resend'de
// bir alan adı doğrulayıp RESEND_FROM_ADDRESS ile override etmek gerekir.
const DEFAULT_FROM_ADDRESS = 'Dijital Gardırop <onboarding@resend.dev>'

class EmailRepository {
  constructor(apiKey, fromAddress) {
    this.apiKey = apiKey
    this.fromAddress = fromAddress || DEFAULT_FROM_ADDRESS
  }

  get isConfigured() {
    return Boolean(this.apiKey)
  }

  async send({ to, subject, html }) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.fromAddress, to, subject, html }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const error = new Error(`Resend ${response.status}: ${body}`)
      error.status = response.status
      throw error
    }

    return response.json()
  }
}

module.exports = EmailRepository
