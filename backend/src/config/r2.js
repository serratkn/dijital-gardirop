const { S3Client } = require('@aws-sdk/client-s3')

// Cloudflare R2 istemcisinin tek kurulduğu yer (config/database.js,
// config/gemini.js, config/chroma.js ile AYNI rol). R2, S3 API'siyle uyumlu
// olduğu için resmi AWS SDK'sı kullanılır — Cloudflare'ın kendi dokümanlarının
// önerdiği yaklaşım budur, R2'ye özel bir SDK yoktur.

function getAccountId() {
  return process.env.R2_ACCOUNT_ID?.trim() || null
}

function getAccessKeyId() {
  return process.env.R2_ACCESS_KEY_ID?.trim() || null
}

function getSecretAccessKey() {
  return process.env.R2_SECRET_ACCESS_KEY?.trim() || null
}

function getBucketName() {
  return process.env.R2_BUCKET_NAME?.trim() || null
}

// Bucket'ın herkese açık okuma adresi (r2.dev alt alan adı ya da bağlanmış
// özel bir alan adı) — SONUNDA `/` OLMAMALIDIR. Yüklenen her nesnenin genel
// URL'si `${publicUrl}/${key}` olarak kurulur.
function getPublicUrl() {
  const raw = process.env.R2_PUBLIC_URL?.trim()
  return raw ? raw.replace(/\/+$/, '') : null
}

// Depolama katmanı KAPATILABİLİR olmalı: anahtarlar tanımlı değilse (yerel
// geliştirme, ya da henüz R2 kurulmamış bir dağıtım) fotoğraflar eskisi gibi
// yalnızca yerel diske yazılır — WeatherService/GeminiService'teki "anahtar
// yoksa dış servise hiç gidilmez" ilkesiyle AYNI. Dördü de dolu olmalıdır;
// biri eksikse istemci hiç kurulmaz (yarım yapılandırmayla denemek, ortasında
// patlayan bir yükleme isteği demektir).
function isConfigured() {
  return Boolean(getAccountId() && getAccessKeyId() && getSecretAccessKey() && getBucketName() && getPublicUrl())
}

let client = null
let clientKey = null

// İstemci ilk kullanımda kurulur (lazy) ve ANAHTARLARA bağlı önbelleklenir —
// chroma.js'teki "adrese bağlı önbellek" ile aynı gerekçe: çalışma anında
// R2 anahtarları değişirse eski anahtarlı istemci sessizce kullanılmaya devam
// etmesin (testler bunu sürer).
function getClient() {
  if (!isConfigured()) {
    client = null
    clientKey = null
    return null
  }

  const accountId = getAccountId()
  const key = `${accountId}:${getAccessKeyId()}`
  if (!client || clientKey !== key) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: getAccessKeyId(),
        secretAccessKey: getSecretAccessKey(),
      },
    })
    clientKey = key
  }
  return client
}

// Test ve yeniden yapılandırma için önbelleği boşaltır.
function resetClient() {
  client = null
  clientKey = null
}

module.exports = {
  getBucketName,
  getPublicUrl,
  isConfigured,
  getClient,
  resetClient,
}
