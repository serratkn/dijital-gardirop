const { ChromaClient } = require('chromadb')

// ChromaDB istemcisinin tek kurulduğu yer (config/database.js ve config/gemini.js
// ile aynı rol): bağlantı ayarları burada okunur, katmanlar yalnızca hazır
// istemciyi alır.

const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 8000
const DEFAULT_COLLECTION = 'kiyafet_embeddings'

// HOST NEDEN localhost? Backend şu an HOST MAKİNEDE çalışıyor (backend/ içinde
// `npm run dev`), Compose ağının içinde değil. Bu yüzden Chroma'ya yayımlanmış
// port üzerinden erişilir. Backend de bir gün container'a taşınırsa değer
// docker-compose'daki SERVİS ADI olur: CHROMA_HOST=chromadb. Servis bilerek o
// adla tanımlandı ki bu geçiş tek bir .env satırı olsun.
function getHost() {
  return process.env.CHROMA_HOST?.trim() || DEFAULT_HOST
}

function getPort() {
  const raw = Number(process.env.CHROMA_PORT)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PORT
}

function getCollectionName() {
  return process.env.CHROMA_COLLECTION?.trim() || DEFAULT_COLLECTION
}

// Vektör katmanı KAPATILABİLİR olmalı: Chroma çalışmayan bir kurulumda
// (yalnızca API geliştiren biri) her fotoğraf yüklemesinde bağlantı hatası
// loglamak gürültüden başka bir şey değil. Varsayılan AÇIK — özellik
// altyapının bir parçası, istisna değil.
function isEnabled() {
  return process.env.CHROMA_ENABLED?.trim().toLowerCase() !== 'false'
}

// Chroma'nın kendi varsayılan embedding fonksiyonu ayrı bir paket ister
// (@chroma-core/default-embed) ve kurulu olmadığı için istemci her koleksiyon
// açılışında uyarı basıyordu. BİZ ZATEN KENDİ EMBEDDING'İMİZİ VERİYORUZ
// (Gemini), dolayısıyla koleksiyona açıkça "metinden embedding üretme" diyen
// bir fonksiyon veriyoruz. Çağrılırsa bu bir programlama hatasıdır: her yazma
// ve sorgu `embeddings` / `queryEmbeddings` ile gelmelidir.
const geminiEmbeddingFunction = {
  name: 'gemini-harici',
  generate() {
    throw new Error(
      'Chroma metinden embedding üretmemeli: embedding VectorService tarafından ' +
        'Gemini ile üretilip açıkça gönderilir.',
    )
  },
  // Koleksiyonun mesafe ölçütü. Kosinüs seçildi çünkü Gemini embedding'leri
  // yön taşır, büyüklük değil; L2 uzun metinleri haksız yere uzaklaştırırdı.
  defaultSpace: () => 'cosine',
  supportedSpaces: () => ['cosine'],
  getConfig: () => ({}),
}

let client = null
let clientKey = null

// İstemci ilk kullanımda kurulur (lazy) ve ADRESE bağlı önbelleklenir —
// gemini.js'teki "anahtara bağlı önbellek" ile aynı gerekçe: çalışma anında
// CHROMA_HOST değişirse eski adrese bağlı istemci sessizce kullanılmaya
// devam etmesin (testler bunu sürüyor).
function getClient() {
  if (!isEnabled()) {
    client = null
    clientKey = null
    return null
  }

  const key = `${getHost()}:${getPort()}`
  if (!client || clientKey !== key) {
    client = new ChromaClient({ host: getHost(), port: getPort(), ssl: false })
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
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_COLLECTION,
  geminiEmbeddingFunction,
  getClient,
  getCollectionName,
  getHost,
  getPort,
  isEnabled,
  resetClient,
}
