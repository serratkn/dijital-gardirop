const { ValidationError, ServiceUnavailableError } = require('../utils/errors')
const { REQUEST_TIMEOUT_MS, getClient, getModel, isConfigured } = require('../config/gemini')

// AŞAMA 1 — yalnızca bağlantının çalıştığını kanıtlayan servis.
// Otomatik kıyafet analizi ve vektör veritabanı sonraki aşamaların işidir;
// buradaki tek sorumluluk: görseli Gemini'ye gönder, JSON cevabı çöz.

const ANALYZE_PROMPT =
  'Bu bir kıyafet fotoğrafı. Kısaca şu bilgileri JSON formatında döndür: ' +
  '{ kategori, renk, stil }'

// Gemini bazen JSON'ı markdown çitiyle sarar (```json ... ```).
// responseMimeType ile bunu istemiyoruz ama modelin biçime uymadığı durumlar
// olabiliyor; savunma amaçlı temizlik.
function stripCodeFence(text) {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed

  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim()
}

class GeminiService {
  // Görseli analiz eder ve Gemini'nin döndürdüğü JSON'ı nesne olarak verir.
  async analyzeClothingImage(file) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new ValidationError('Analiz edilecek bir görsel gönderilmedi')
    }

    // Anahtar yoksa dış servise HİÇ GİDİLMEZ (WeatherService ile aynı kural).
    if (!isConfigured()) {
      throw new ServiceUnavailableError(
        'Gemini API anahtarı tanımlı değil. backend/.env içine GEMINI_API_KEY ekleyin.',
      )
    }

    const client = getClient()
    const model = getModel()

    let response
    try {
      response = await client.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              // Görsel diskte tutulmaz; multer memoryStorage'dan gelen tampon
              // doğrudan base64'e çevrilip gönderilir.
              {
                inlineData: {
                  mimeType: file.mimetype,
                  data: file.buffer.toString('base64'),
                },
              },
              { text: ANALYZE_PROMPT },
            ],
          },
        ],
        config: {
          // Modelden DOĞRUDAN JSON istiyoruz: aksi hâlde açıklama cümleleri ve
          // markdown çitleri arasından ayıklamak gerekirdi.
          responseMimeType: 'application/json',
          abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      })
    } catch (error) {
      // SDK hatası ASLA olduğu gibi dışarı sızmamalı: yığın izi ve anahtar
      // parçaları içerebilir. Anlaşılır Türkçe mesaja çevriliyor.
      console.error('Gemini isteği başarısız:', error.message)
      throw new ServiceUnavailableError(this.#toFriendlyMessage(error))
    }

    const text = typeof response?.text === 'string' ? response.text : ''
    if (!text.trim()) {
      throw new ServiceUnavailableError('Gemini boş bir yanıt döndürdü')
    }

    let parsed
    try {
      parsed = JSON.parse(stripCodeFence(text))
    } catch {
      // Model JSON üretemediyse bu bizim hatamız değil; ham metni de veriyoruz
      // ki teşhis edilebilsin.
      console.error('Gemini JSON olarak çözülemedi:', text.slice(0, 200))
      throw new ServiceUnavailableError('Gemini yanıtı JSON olarak çözümlenemedi')
    }

    return {
      model,
      analysis: parsed,
      // Ham metin teşhis için: modelin ne döndürdüğünü görmeden hata ayıklamak zor.
      raw: text,
    }
  }

  // Gemini'nin sık karşılaşılan hatalarını kullanıcının anlayacağı dile çevirir.
  #toFriendlyMessage(error) {
    const message = String(error?.message || '')
    const status = error?.status ?? error?.code

    if (error?.name === 'TimeoutError' || /abort|timeout/i.test(message)) {
      return 'Gemini yanıt vermedi (zaman aşımı). Lütfen tekrar deneyin.'
    }
    if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(message)) {
      return 'Gemini API anahtarı geçersiz. backend/.env içindeki GEMINI_API_KEY değerini kontrol edin.'
    }
    if (status === 401 || status === 403 || /PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
      return 'Gemini API anahtarı reddedildi (yetki hatası). Anahtarın geçerli olduğunu doğrulayın.'
    }
    if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) {
      return 'Gemini kullanım kotası doldu. Bir süre sonra tekrar deneyin.'
    }
    if (status === 404 || /not found|NOT_FOUND/i.test(message)) {
      return `Gemini modeli bulunamadı (${getModel()}). GEMINI_MODEL değerini kontrol edin.`
    }
    return 'Gemini servisine şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.'
  }
}

module.exports = GeminiService
