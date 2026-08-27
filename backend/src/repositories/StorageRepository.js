const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getClient, getBucketName, getPublicUrl, isConfigured } = require('../config/r2')

// Dış servis de repository'dir (WeatherRepository/EmailRepository ile AYNI
// rol): Cloudflare R2'ye yalnızca veri erişimi yapar, iş kuralı taşımaz.
// Fırlatır — çağıran (ClothingItemController/Service) hatayı "isteğe bağlı
// zenginleştirme" olarak ele alıp sessizce yerel diske düşer; bu servis
// kendisi o kararı vermez.
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

    return `${getPublicUrl()}/${key}`
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
