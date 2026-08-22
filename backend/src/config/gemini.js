const { GoogleGenAI } = require('@google/genai')

// Gemini istemcisinin tek kurulduğu yer (config/database.js ile aynı rol).
//
// SDK SEÇİMİ — @google/genai:
// İstenen `@google/generative-ai` Google'ın ESKİ SDK'sıdır: 0.24.1'de kalmış,
// Nisan 2025'ten beri güncellenmemiş ve hiç 1.0'a ulaşmamıştır. Yerini alan
// resmi paket `@google/genai`'dır (googleapis/js-genai) ve aktif bakımdadır.
// Bu dosya ileriki aşamaların (otomatik kıyafet analizi, vektör DB) temeli
// olduğu için bakımlı olan tercih edildi.

// Model .env'den değiştirilebilir: yeni sürümler çıktığında kod değil
// yapılandırma güncellenir.
//
// MODEL SEÇİMİ ölçümle yapıldı, varsayımla değil:
//   - `gemini-1.5-flash` ve `gemini-2.0-flash` (ilk istenenler) API'nin model
//     listesinde HİÇ dönmüyor — emekliye ayrıldılar.
//   - `gemini-2.5-flash` listede GÖRÜNÜYOR ama çağrıldığında 404 veriyor:
//     "no longer available to new users. Please update your code to use
//     models/gemini-3.6-flash". Yani listede olması kullanılabilir olduğu
//     anlamına gelmiyor — model seçerken gerçekten ÇAĞIRARAK doğrulayın.
//   - `gemini-3.7-flash` çağrıldığında 503 ("high demand") döndü.
// Varsayılan, Google'ın kendi hata mesajında önerdiği modeldir. Gerçek bir
// kıyafet fotoğrafıyla denendi ve tutarlı Türkçe etiketler üretti.
const DEFAULT_MODEL = 'gemini-3.6-flash'

// EMBEDDING MODELİ (Aşama 3 — vektör veritabanı). Analiz modelinden AYRI:
// biri görselden metin üretir, diğeri metinden vektör.
//
// SEÇİM YİNE ÖLÇÜMLE YAPILDI — istenen `text-embedding-004` ARTIK YOK:
// çağrıldığında 404 ("not found for API version v1beta, or is not supported
// for embedContent"). Model listesinde embedding destekleyen üç model dönüyor:
// gemini-embedding-001, gemini-embedding-2, gemini-embedding-2-preview.
// Üçü de 3072 boyutlu vektör üretiyor; 001 ve 2 gerçekten çağrılarak
// doğrulandı (~300–500 ms).
//
// Varsayılan `gemini-embedding-001`: GA ve en uzun süredir kararlı olan.
//
// > MODELİ DEĞİŞTİRMEK KOLEKSİYONU GEÇERSİZ KILAR. Farklı modellerin vektörleri
// > aynı uzayda DEĞİLDİR; karışık koleksiyonda mesafeler anlamsızlaşır. Model
// > değişirse tüm embedding'ler silinip yeniden üretilmelidir
// > (test-scripts/create-embeddings.js --sifirla).
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001'

// Benzer parça araması bir "hangi belge sorguya yakın" işi değil, iki parçanın
// BİRBİRİNE benzemesi işidir; Gemini bunun için ayrı bir görev tipi sunuyor ve
// sonuçları buna göre uzayda konumlandırıyor. Yazma ve sorgu tarafında AYNI
// değer kullanılmalıdır, yoksa vektörler kıyaslanabilir olmaz.
const EMBEDDING_TASK_TYPE = 'SEMANTIC_SIMILARITY'

// Dış servise yapılan istek SINIRSIZ BEKLEYEMEZ (WeatherService ile aynı kural):
// takılan bir istek isteği tutan HTTP bağlantısını da askıda bırakırdı.
// Görsel analizi metin üretiminden yavaştır, bu yüzden hava durumundaki
// 5 saniyeden yüksek tutuldu: ölçümde aynı model aynı fotoğraf için bir kez
// 4.4 sn, bir kez 20.4 sn sürdü — 30 sn bu değişkenliği rahatça kapsıyor.
const REQUEST_TIMEOUT_MS = 30000

function getApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim()
  return key || null
}

// Anahtar YOKSA sunucu PATLAMAZ — JWT_SECRET'in aksine, WEATHER_API_KEY ile
// aynı yaklaşım. Gemini şu an isteğe bağlı bir yetenektir; anahtarsız kurulumda
// uygulamanın geri kalanı tam çalışır, yalnızca bu uç anlamlı bir hata döner.
function isConfigured() {
  return getApiKey() !== null
}

let client = null
let clientKey = null

// İstemci ilk kullanımda kurulur (lazy): anahtar yokken modül yüklenmesi
// sırasında hata fırlatmasın diye.
//
// Önbellek, İSTEMCİYİ KURAN ANAHTARI da saklar. Yalnızca `client` tutulsaydı
// çalışma anında GEMINI_API_KEY değiştiğinde eski anahtarlı istemci sessizce
// kullanılmaya devam ederdi — testlerde geçersiz anahtar senaryosunu sürmek de
// imkânsız olurdu.
function getClient() {
  const apiKey = getApiKey()
  if (!apiKey) {
    client = null
    clientKey = null
    return null
  }

  if (!client || clientKey !== apiKey) {
    client = new GoogleGenAI({ apiKey })
    clientKey = apiKey
  }
  return client
}

function getModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
}

function getEmbeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL
}

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_TASK_TYPE,
  REQUEST_TIMEOUT_MS,
  isConfigured,
  getClient,
  getModel,
  getEmbeddingModel,
}
