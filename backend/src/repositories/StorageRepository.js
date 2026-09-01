const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getClient, getBucketName, isConfigured } = require('../config/r2')

// Dış servis de repository'dir (WeatherRepository/EmailRepository ile AYNI
// rol): Cloudflare R2'ye yalnızca veri erişimi yapar, iş kuralı taşımaz.
// Fırlatır — çağıran (ClothingItemController/Service) hatayı "isteğe bağlı
// zenginleştirme" olarak ele alıp sessizce yerel diske düşer; bu servis
// kendisi o kararı vermez.
//
// YAKALANAN SORUN — R2'nin PAYLAŞILAN r2.dev genel alt alan adı (public
// development URL) bazı tarayıcılarda/ağlarda "ERR_SSL_PROTOCOL_ERROR" ile
// düşüyordu; bu Cloudflare'ın kendisinin de "production için önerilmez"
// dediği, bilinen bir kararsızlık (bkz. CLAUDE.md §9). Çözüm: yüklenen
// nesnenin genel r2.dev adresi hiç DIŞARI VERİLMEZ — `upload()` artık backend
// üzerinden okunacak GÖRELİ bir proxy yolu (`/r2-images/<key>`) döndürüyor.
// Okuma da (`download()`) AYNI güvenilir S3 API'sinden geçiyor (yükleme testi
// zaten bunun sorunsuz çalıştığını kanıtladı) — kırılgan olan yalnızca
// Cloudflare'ın paylaşılan genel alt alan adıydı, S3 uç noktası değil.
class StorageRepository {
  get isConfigured() {
    return isConfigured()
  }

  async upload(key, buffer, contentType) {
    const client = getClient()
    if (!client) {
      throw new Error('R2 yapılandırılmamış')
    }

    await client.send(
      new PutObjectCommand({
        Bucket: getBucketName(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    )

    return `/r2-images/${key}`
  }

  async download(key) {
    const client = getClient()
    if (!client) {
      throw new Error('R2 yapılandırılmamış')
    }

    const result = await client.send(new GetObjectCommand({ Bucket: getBucketName(), Key: key }))
    return { body: result.Body, contentType: result.ContentType }
  }

  async remove(key) {
    const client = getClient()
    if (!client) {
      throw new Error('R2 yapılandırılmamış')
    }

    await client.send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }))
  }
}

module.exports = StorageRepository
