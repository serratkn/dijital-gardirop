// Test verilerini temizler. Varsayılan olarak yalnızca test amaçlı üretilmiş
// kayıtları siler; --all ile bir kullanıcının tüm verisi temizlenebilir.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/cleanup.js                     # test artıklarını sil (önizleme + onay yok)
//   node test-scripts/cleanup.js --dry-run           # neyin silineceğini göster, silme
//   node test-scripts/cleanup.js --all --user <uuid> # o kullanıcının TÜM kombin/parçalarını sil
//
// Not: veritabanına doğrudan bağlanır (API üzerinden değil), çünkü
// silme işlemleri toplu ve idempotent olmalı.

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const pool = require('../src/config/database')

// Test scriptlerinin ürettiği kayıtlar bu kalıplarla adlandırılır.
const TEST_NAME_PATTERNS = ['Test Gomlek', 'Test Parça %', 'Temiz Akış %', 'Regresyon Testi', 'x%']
const TEST_EMAIL_PATTERN = '%@example.com'

const isDryRun = process.argv.includes('--dry-run')
const deleteAll = process.argv.includes('--all')
const userArgIndex = process.argv.indexOf('--user')
const targetUserId = userArgIndex !== -1 ? process.argv[userArgIndex + 1] : null

async function countRows(sql, params) {
  const result = await pool.query(sql, params)
  return Number(result.rows[0].count)
}

async function main() {
  if (deleteAll && !targetUserId) {
    console.error('--all kullanımı için --user <uuid> zorunludur.')
    process.exitCode = 1
    return
  }

  console.log(isDryRun ? 'ÖNİZLEME (hiçbir şey silinmeyecek)\n' : 'TEMİZLİK BAŞLIYOR\n')

  if (deleteAll) {
    const outfitCount = await countRows(
      'SELECT COUNT(*) FROM outfits WHERE user_id = $1',
      [targetUserId],
    )
    const itemCount = await countRows(
      'SELECT COUNT(*) FROM clothing_items WHERE user_id = $1',
      [targetUserId],
    )
    console.log(`Kullanıcı: ${targetUserId}`)
    console.log(`  kombin : ${outfitCount}`)
    console.log(`  parça  : ${itemCount}`)

    if (!isDryRun) {
      // outfit_items ON DELETE CASCADE ile birlikte gider.
      await pool.query('DELETE FROM outfits WHERE user_id = $1', [targetUserId])
      await pool.query('DELETE FROM clothing_items WHERE user_id = $1', [targetUserId])
      console.log('\nSilindi.')
    }

    await pool.end()
    return
  }

  // --- Test artıkları ---
  const nameConditions = TEST_NAME_PATTERNS.map((_, index) => `name LIKE $${index + 1}`).join(' OR ')

  const items = await pool.query(
    `SELECT id, name FROM clothing_items WHERE ${nameConditions}`,
    TEST_NAME_PATTERNS,
  )
  console.log(`Test parçaları: ${items.rowCount}`)
  items.rows.forEach((row) => console.log(`  - ${row.name}`))

  const users = await pool.query(
    'SELECT id, email FROM users WHERE email LIKE $1',
    [TEST_EMAIL_PATTERN],
  )
  console.log(`\nTest kullanıcıları (${TEST_EMAIL_PATTERN}): ${users.rowCount}`)
  users.rows.forEach((row) => console.log(`  - ${row.email}`))

  const orphanOutfits = await pool.query(
    `SELECT o.id, o.occasion FROM outfits o
     WHERE NOT EXISTS (SELECT 1 FROM outfit_items oi WHERE oi.outfit_id = o.id)`,
  )
  console.log(`\nParçasız kombinler: ${orphanOutfits.rowCount}`)

  if (isDryRun) {
    console.log('\nÖnizleme bitti. Silmek için --dry-run olmadan çalıştırın.')
    await pool.end()
    return
  }

  if (items.rowCount > 0) {
    await pool.query(`DELETE FROM clothing_items WHERE ${nameConditions}`, TEST_NAME_PATTERNS)
  }
  if (users.rowCount > 0) {
    // Kullanıcı silinince tercihleri, parçaları ve kombinleri CASCADE ile gider.
    await pool.query('DELETE FROM users WHERE email LIKE $1', [TEST_EMAIL_PATTERN])
  }
  if (orphanOutfits.rowCount > 0) {
    await pool.query(
      `DELETE FROM outfits o
       WHERE NOT EXISTS (SELECT 1 FROM outfit_items oi WHERE oi.outfit_id = o.id)`,
    )
  }

  console.log('\nTemizlik tamamlandı.')
  await pool.end()
}

main().catch((error) => {
  console.error('HATA:', error.message)
  process.exitCode = 1
  pool.end()
})
