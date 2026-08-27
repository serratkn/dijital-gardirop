// Analizi olan ama embedding'i olmayan kıyafetler için toplu embedding üretimi
// (Gemini Aşama 3 — vektör veritabanı).
//
// Otomatik akış yalnızca YENİ tamamlanan analizlerden sonra embedding üretir.
// Bu özellikten önce analiz edilmiş parçaların vektörü yoktur; bu script
// onları tek seferde doldurur.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/create-embeddings.js                (yalnızca listeler)
//   node test-scripts/create-embeddings.js --uygula
//   node test-scripts/create-embeddings.js --uygula --limit 3
//   node test-scripts/create-embeddings.js --sifirla --uygula   (tabloyu boşaltıp baştan)
//
// VARSAYILAN DAVRANIŞ SALT OKUNURDUR (analyze-existing-items.js kalıbı):
// her çağrı gerçek Gemini kotası harcadığı için hiçbir şey yanlışlıkla
// üretilmesin.
//
// --sifirla EMBEDDING MODELİ DEĞİŞTİĞİNDE gerekir: farklı modellerin vektörleri
// aynı uzayda değildir, karışık bir tabloda mesafeler anlamsızlaşır.
//
// Sunucuya İHTİYAÇ DUYMAZ: servisleri doğrudan kurar.

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const pool = require('../src/config/database')
const { isConfigured, getEmbeddingModel } = require('../src/config/gemini')
const { isEnabled } = require('../src/config/vectorStore')
const ClothingItemRepository = require('../src/repositories/ClothingItemRepository')
const VectorRepository = require('../src/repositories/VectorRepository')
const VectorService = require('../src/services/VectorService')
const GeminiService = require('../src/services/GeminiService')

const UYGULA = process.argv.includes('--uygula')
const SIFIRLA = process.argv.includes('--sifirla')
const limitIndex = process.argv.indexOf('--limit')
const LIMIT = limitIndex !== -1 ? Number(process.argv[limitIndex + 1]) : null

async function main() {
  if (!isEnabled()) {
    console.log('Vektör deposu devre dışı (VECTOR_STORE_ENABLED=false) — yapacak bir şey yok.')
    return
  }
  if (!isConfigured()) {
    console.log('GEMINI_API_KEY tanımlı değil — embedding üretilemez.')
    return
  }

  const vectorRepository = new VectorRepository(pool)

  console.log(`Vektör deposu: pgvector (clothing_item_embeddings tablosu)`)
  console.log(`Embedding modeli: ${getEmbeddingModel()}\n`)

  try {
    await vectorRepository.heartbeat()
  } catch {
    console.log('Veritabanına ulaşılamıyor. Ayakta mı?  docker compose up -d')
    process.exitCode = 1
    return
  }

  if (SIFIRLA) {
    if (!UYGULA) {
      console.log('--sifirla yalnızca --uygula ile birlikte çalışır (tüm embeddingler SİLİNİR).')
      return
    }
    try {
      await vectorRepository.dropCollection()
      console.log('Vektör tablosu boşaltıldı; tüm embeddingler yeniden üretilecek.\n')
    } catch (error) {
      console.log(`Vektör tablosu boşaltılamadı: ${error.message}\n`)
    }
  }

  // Analizi olan parçalar. Hangilerinin vektörü eksik olduğunu
  // clothing_item_embeddings söyler (aynı veritabanı, ayrı bir tablo).
  const { rows } = await pool.query(
    `SELECT ci.id, ci.name, c.name AS kategori
       FROM clothing_items ci
       LEFT JOIN categories c ON c.id = ci.category_id
      WHERE ci.ai_analysis IS NOT NULL
        AND ci.is_deleted = false
      ORDER BY ci.created_at DESC`,
  )

  if (rows.length === 0) {
    console.log('Analizi olan hiç parça yok. Önce: node test-scripts/analyze-existing-items.js --uygula')
    return
  }

  let mevcut = new Set()
  try {
    mevcut = await vectorRepository.getExistingIds(rows.map((row) => row.id))
  } catch (error) {
    console.log(`Mevcut embeddingler okunamadı: ${error.message}`)
    process.exitCode = 1
    return
  }

  const eksikler = rows.filter((row) => !mevcut.has(row.id))
  const secilen = LIMIT ? eksikler.slice(0, LIMIT) : eksikler

  console.log(`Analizi olan parça : ${rows.length}`)
  console.log(`Embedding'i olan    : ${mevcut.size}`)
  console.log(`Embedding'i eksik   : ${eksikler.length}\n`)

  if (eksikler.length === 0) {
    console.log('Her analizin embeddingi mevcut — yapacak bir şey yok.')
    return
  }

  secilen.forEach((row) => console.log(`  - [${row.kategori ?? 'kategorisiz'}] ${row.name}`))

  if (!UYGULA) {
    console.log('\nBu bir ÖNİZLEMEDİR, hiçbir embedding üretilmedi.')
    console.log('Gerçekten çalıştırmak için: node test-scripts/create-embeddings.js --uygula')
    return
  }

  console.log('\nEmbeddingler üretiliyor (toplu istek)...\n')

  const service = new VectorService(
    vectorRepository,
    new ClothingItemRepository(pool),
    new GeminiService(),
  )

  const sonuclar = await service.indexItems(secilen.map((row) => row.id))

  for (const row of secilen) {
    const sonuc = sonuclar.get(row.id)
    const isaret =
      sonuc.durum === 'tamamlandi' ? '✓' : sonuc.durum === 'atlandi' ? '–' : '✗'
    console.log(`  ${isaret} ${row.name}${sonuc.sebep ? ` (${sonuc.sebep})` : ''}`)
  }

  const say = (durum) => [...sonuclar.values()].filter((row) => row.durum === durum).length
  console.log(
    `\nBitti: ${say('tamamlandi')} üretildi, ${say('atlandi')} atlandı, ` +
      `${say('basarisiz')} başarısız.`,
  )
  console.log(`Tablodaki toplam vektör: ${await vectorRepository.count()}`)
  console.log('\nDoğrulamak için: node test-scripts/test-vector.js')
}

main()
  .catch((error) => {
    console.error('Çalıştırılamadı:', error.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
