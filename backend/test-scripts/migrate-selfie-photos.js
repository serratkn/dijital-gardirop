// Var olan selfie dosyalarını uploads/ kökünden uploads/selfies/'e taşır ve
// veritabanındaki users.skin_tone_photo_url alanını buna göre günceller.
//
// GEREKÇE: selfie artık token'sız /uploads yolundan servis edilmiyor
// (bkz. GET /api/users/skin-tone-analysis/photo, server.js'teki
// '/uploads/selfies' engeli). Bu özellikten ÖNCE analiz yapmış kullanıcıların
// selfie'si hâlâ eski konumda (uploads/ kökü) duruyor olabilir — bu script
// onları yeni klasöre taşır ve kaydı günceller.
//
// VARSAYILAN SALT OKUNURDUR (create-embeddings.js / analyze-existing-items.js
// ile aynı kalıp): yalnızca ne taşınacağını listeler. Gerçekten taşımak için:
//   node test-scripts/migrate-selfie-photos.js --uygula
//
// İDEMPOTENTTİR: yolu zaten "/uploads/selfies/" ile başlayan kayıtlar atlanır,
// script birden fazla kez çalıştırılabilir.

const path = require('node:path')
const fs = require('node:fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const pool = require('../src/config/database')
const { UPLOAD_DIR, SELFIE_UPLOAD_DIR } = require('../src/config/upload')

const UYGULA = process.argv.includes('--uygula')

async function main() {
  console.log('\n=== SELFIE TAŞIMA: uploads/ → uploads/selfies/ ===\n')

  const { rows } = await pool.query(
    'SELECT id, skin_tone_photo_url FROM users WHERE skin_tone_photo_url IS NOT NULL',
  )

  if (rows.length === 0) {
    console.log('Taşınacak selfie kaydı yok.')
    await pool.end()
    return
  }

  console.log(`${rows.length} selfie kaydı bulundu.\n`)

  let tasindi = 0
  let atlandi = 0
  let dosyaYok = 0

  for (const row of rows) {
    const mevcutYol = row.skin_tone_photo_url

    if (mevcutYol.startsWith('/uploads/selfies/')) {
      console.log(`  [zaten taşınmış] ${row.id} → ${mevcutYol}`)
      atlandi += 1
      continue
    }

    const dosyaAdi = path.basename(mevcutYol)
    const kaynak = path.join(UPLOAD_DIR, dosyaAdi)
    const hedef = path.join(SELFIE_UPLOAD_DIR, dosyaAdi)
    const yeniYol = `/uploads/selfies/${dosyaAdi}`

    if (!fs.existsSync(kaynak)) {
      console.log(`  [DOSYA BULUNAMADI] ${row.id}: ${kaynak}`)
      dosyaYok += 1
      continue
    }

    console.log(`  ${row.id}: ${mevcutYol} → ${yeniYol}`)

    if (UYGULA) {
      // Kayıt önce diskte taşınır, DB ANCAK ondan sonra güncellenir — sıra
      // tersine olsaydı (önce DB) ve dosya taşıma patlarsa kayıt olmayan bir
      // yolu gösterirdi (SkinToneService'teki "önce yaz, sonra sil" disipliniyle
      // aynı gerekçe: geri dönüşü olmayan adım en sona bırakılır).
      fs.renameSync(kaynak, hedef)
      await pool.query('UPDATE users SET skin_tone_photo_url = $1 WHERE id = $2', [
        yeniYol,
        row.id,
      ])
      tasindi += 1
    }
  }

  console.log(
    `\n${UYGULA ? 'Taşındı' : 'Taşınacak'}: ${tasindi || rows.length - atlandi - dosyaYok}, ` +
      `zaten taşınmış: ${atlandi}, dosya bulunamadı: ${dosyaYok}`,
  )

  if (!UYGULA && rows.length - atlandi - dosyaYok > 0) {
    console.log('\nGerçekten taşımak için: node test-scripts/migrate-selfie-photos.js --uygula')
  }

  await pool.end()
}

main().catch(async (error) => {
  console.error('\nBeklenmeyen hata:', error)
  await pool.end().catch(() => {})
  process.exit(1)
})
