// Otomatik analiz ÖNCESİNDEN kalan parçalar için toplu analiz (Gemini Aşama 2).
//
// Otomatik analiz yalnızca YENİ fotoğraf yüklendiğinde tetiklenir. Bu özellik
// gelmeden önce eklenmiş parçalarda ai_analysis NULL kalır; bu script onları
// tek seferde doldurur.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/analyze-existing-items.js            (yalnızca listeler)
//   node test-scripts/analyze-existing-items.js --uygula   (analiz eder ve yazar)
//   node test-scripts/analyze-existing-items.js --uygula --limit 3
//
// VARSAYILAN DAVRANIŞ SALT OKUNURDUR (migrate-passwordless-users.js kalıbı):
// her çağrı gerçek para harcadığı için hiçbir şey yanlışlıkla analiz edilmesin.
//
// Sunucuya İHTİYAÇ DUYMAZ: servisleri doğrudan kurar ve veritabanına bağlanır.
// Analiz servisi eşzamanlılığı kendisi sınırlar (aynı anda 2 çağrı).

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const pool = require('../src/config/database')
const { isConfigured } = require('../src/config/gemini')
const ClothingItemRepository = require('../src/repositories/ClothingItemRepository')
const CategoryRepository = require('../src/repositories/CategoryRepository')
const ClothingAnalysisService = require('../src/services/ClothingAnalysisService')
const GeminiService = require('../src/services/GeminiService')

const UYGULA = process.argv.includes('--uygula')
const limitIndex = process.argv.indexOf('--limit')
const LIMIT = limitIndex !== -1 ? Number(process.argv[limitIndex + 1]) : null

async function main() {
  if (!isConfigured()) {
    console.log('GEMINI_API_KEY tanımlı değil — analiz yapılamaz.')
    console.log('backend/.env içine anahtarı ekleyip tekrar deneyin.')
    return
  }

  // Migration 005 ile eklenen kısmi index tam olarak bu sorgu içindir.
  const { rows } = await pool.query(
    `SELECT ci.id, ci.name, c.name AS kategori
       FROM clothing_items ci
       LEFT JOIN categories c ON c.id = ci.category_id
      WHERE ci.ai_analysis IS NULL
        AND ci.image_url IS NOT NULL
        AND ci.is_deleted = false
      ORDER BY ci.created_at DESC
      ${LIMIT ? `LIMIT ${Number(LIMIT)}` : ''}`,
  )

  if (rows.length === 0) {
    console.log('Analiz bekleyen parça yok (fotoğrafı olan her parçanın analizi mevcut).')
    return
  }

  console.log(`Analiz bekleyen ${rows.length} parça:\n`)
  rows.forEach((row) => console.log(`  - [${row.kategori ?? 'kategorisiz'}] ${row.name}`))

  if (!UYGULA) {
    console.log('\nBu bir ÖNİZLEMEDİR, hiçbir şey analiz edilmedi.')
    console.log('Gerçekten çalıştırmak için: node test-scripts/analyze-existing-items.js --uygula')
    return
  }

  const service = new ClothingAnalysisService(
    new ClothingItemRepository(pool),
    new CategoryRepository(pool),
    new GeminiService(),
  )

  console.log('\nAnaliz başlıyor...\n')

  // Hepsi birden başlatılır; eşzamanlılık sınırını servis uygular.
  const sonuclar = await Promise.all(
    rows.map(async (row) => {
      const sonuc = await service.analyzeItem(row.id)
      const isaret = sonuc.durum === 'tamamlandi' ? '✓' : sonuc.durum === 'atlandi' ? '–' : '✗'
      console.log(`  ${isaret} ${row.name}${sonuc.sebep ? ` (${sonuc.sebep})` : ''}`)
      return sonuc
    }),
  )

  const say = (durum) => sonuclar.filter((row) => row.durum === durum).length
  console.log(
    `\nBitti: ${say('tamamlandi')} analiz edildi, ${say('atlandi')} atlandı, ` +
      `${say('basarisiz')} başarısız.`,
  )
  console.log('\nDBeaver ile bakmak için:')
  console.log("  SELECT name, jsonb_pretty(ai_analysis) FROM clothing_items")
  console.log('   WHERE ai_analysis IS NOT NULL ORDER BY created_at DESC;')
}

main()
  .catch((error) => {
    console.error('Çalıştırılamadı:', error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
