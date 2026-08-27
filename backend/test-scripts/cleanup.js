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

const fs = require('node:fs')
const pool = require('../src/config/database')
const { isEnabled: isVectorStoreEnabled } = require('../src/config/vectorStore')
const { UPLOAD_DIR, SELFIE_UPLOAD_DIR } = require('../src/config/upload')

// Test scriptlerinin ürettiği kayıtlar bu kalıplarla adlandırılır.
const TEST_NAME_PATTERNS = [
  'Test Gomlek',
  'Test Parça %',
  'Temiz Akış %',
  'Renk Testi %',
  'Regresyon Testi',
  'x%',
]
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

  // `clothing_item_embeddings.clothing_item_id` ON DELETE CASCADE taşır, yani
  // yukarıdaki DOĞRUDAN SQL silmesi (satır ~104, gerçek bir HARD DELETE)
  // embedding'i de kendiliğinden götürür. Bu fonksiyonun yakaladığı asıl
  // durum farklı: uygulamanın kendi SOFT DELETE akışı (is_deleted = true)
  // CASCADE'i hiç tetiklemez — normalde `ClothingItemController.delete`
  // vektörü de silmeyi dener ama bu çağrı (Chroma'yken de, pgvector'da da)
  // ASLA FIRLATMAZ; sessizce başarısız olursa öksüz bir kayıt kalabilir. Bu
  // süpürme o payı kapatır.
  await temizleOksuzVektorler()

  // Diskteki fotoğraflar da AYRI bir depodur (dosya sistemi). Kullanıcı
  // silme akışı artık kendi dosyalarını temizliyor (bkz. UserService.deleteUser)
  // ama BURADAKİ doğrudan SQL silmeleri (test parçaları + test kullanıcıları,
  // yukarıda) o akıştan geçmiyor — aynı Chroma-öksüzü mantığının dosya
  // sistemi karşılığı burada gerekiyor.
  await temizleOksuzDosyalar()

  console.log('\nTemizlik tamamlandı.')
  await pool.end()
}

// clothing_item_embeddings'te olup clothing_items'ta (artık) canlı olmayan
// vektörleri siler. ChromaDB döneminde bu iki AYRI depo arasında bir
// karşılaştırma gerektiriyordu (id listesini çekip Postgres'e sorman
// gerekiyordu); artık İKİSİ DE aynı veritabanında olduğu için TEK bir
// anti-join sorgusu yeterli — bkz. CLAUDE.md §9, 2026-08-27 "ChromaDB'den
// pgvector'a geçiş" kaydı.
async function temizleOksuzVektorler() {
  if (!isVectorStoreEnabled()) return

  try {
    const result = await pool.query(`
      DELETE FROM clothing_item_embeddings e
      WHERE NOT EXISTS (
        SELECT 1 FROM clothing_items ci
        WHERE ci.id = e.clothing_item_id AND ci.is_deleted = false
      )
    `)
    if (result.rowCount === 0) {
      console.log('\nVektör tablosu: öksüz kayıt yok.')
      return
    }
    console.log(`\nVektör tablosu: ${result.rowCount} öksüz kayıt silindi.`)
  } catch (error) {
    // Temizlik bir kolaylık aracıdır; vektör tablosu yüzünden çökmemeli.
    console.log(`\nVektör temizliği yapılamadı: ${error.message}`)
  }
}

// Diskte olup Postgres'te (artık) hiçbir satırdan referans edilmeyen
// fotoğrafları siler. Kıyafet fotoğrafları VE selfie'ler ARTIK FARKLI
// klasörlerde (UPLOAD_DIR kökü / UPLOAD_DIR/selfies), bu yüzden iki AYRI
// tarama yapılır — ortak mantık `taraVeSil` içinde.
async function temizleOksuzDosyalar() {
  await taraVeSil({
    dizin: UPLOAD_DIR,
    haric: ['.gitkeep', 'selfies'], // 'selfies' bir alt klasördür, dosya değil
    sorgu: 'SELECT image_url AS url FROM clothing_items WHERE image_url IS NOT NULL',
    etiket: 'Kıyafet fotoğrafları',
  })
  await taraVeSil({
    dizin: SELFIE_UPLOAD_DIR,
    haric: ['.gitkeep'],
    sorgu: 'SELECT skin_tone_photo_url AS url FROM users WHERE skin_tone_photo_url IS NOT NULL',
    etiket: 'Selfie\'ler',
  })
}

// is_deleted FARK ETMEZ: soft-delete edilmiş bir parçanın dosyası normal
// akışta zaten silinmiş olur, ama garanti değildir — referans hâlâ
// duruyorsa dosya SİLİNMEMELİDİR (yanlışlıkla canlı bir kaydı bozmaktan
// iyidir birkaç fazladan dosyayı elde tutmak).
async function taraVeSil({ dizin, haric, sorgu, etiket }) {
  let diskteki
  try {
    diskteki = fs.readdirSync(dizin).filter((name) => !haric.includes(name))
  } catch (error) {
    console.log(`\n${etiket}: temizlik yapılamadı: ${error.message}`)
    return
  }
  if (diskteki.length === 0) return

  const { rows } = await pool.query(sorgu)
  // url her zaman ".../uploads/..." biçiminde saklanır; burada yalnızca
  // dosya adı (basename) karşılaştırılır — klasör kendisi zaten dizin
  // parametresiyle sabitlendiği için yol öneki önemli değildir.
  const referanslar = new Set(rows.map((row) => path.basename(row.url)))

  const oksuzler = diskteki.filter((name) => !referanslar.has(name))
  if (oksuzler.length === 0) {
    console.log(`\n${etiket}: ${diskteki.length} dosya, öksüz yok.`)
    return
  }

  for (const name of oksuzler) {
    try {
      fs.unlinkSync(path.join(dizin, name))
    } catch (error) {
      if (error.code !== 'ENOENT') console.log(`  ${name} silinemedi: ${error.message}`)
    }
  }
  console.log(`\n${etiket}: ${oksuzler.length} öksüz dosya silindi (${diskteki.length} taranmıştı).`)
}

main().catch((error) => {
  console.error('HATA:', error.message)
  process.exitCode = 1
  pool.end()
})
