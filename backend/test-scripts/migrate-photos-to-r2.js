// Var olan kıyafet fotoğraflarını (uploads/ kökündeki yerel dosyalar)
// Cloudflare R2'ye yükler ve clothing_items.image_url'i R2'nin genel adresine
// günceller.
//
// GEREKÇE: Render'ın disk alanı EPHEMERAL'dır — bu özellikten ÖNCE yüklenmiş
// fotoğraflar hâlâ yalnızca yerel diskte duruyor ve bir sonraki deploy'da
// sessizce kaybolabilir (bu risk gerçekten yaşandı, bkz. CLAUDE.md §9).
// Bu script onları R2'ye taşıyıp kaydı günceller; yerel dosya SİLİNMEZ
// (arka plan analizi hâlâ yereldeki kopyayı okuyabilir, bkz. §8).
//
// VARSAYILAN SALT OKUNURDUR (migrate-selfie-photos.js / create-embeddings.js
// ile AYNI kalıp): yalnızca ne yükleneceğini listeler. Gerçekten yüklemek için:
//   node test-scripts/migrate-photos-to-r2.js --uygula
//
// İDEMPOTENTTİR: image_url zaten mutlak bir http(s) adresiyse (R2'ye taşınmış)
// atlanır, script birden fazla kez çalıştırılabilir.
//
// R2 YAPILANDIRILMAMIŞSA (R2_ACCOUNT_ID vb. .env'de boşsa) script anlamlı bir
// mesajla çıkar — hiçbir şeye dokunmadan.

const path = require('node:path')
const fs = require('node:fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const pool = require('../src/config/database')
const { UPLOAD_DIR } = require('../src/config/upload')
const StorageRepository = require('../src/repositories/StorageRepository')

const UYGULA = process.argv.includes('--uygula')

async function main() {
  console.log('\n=== KIYAFET FOTOĞRAFLARINI R2\'YE TAŞIMA ===\n')

  const storageRepository = new StorageRepository()
  if (!storageRepository.isConfigured) {
    console.log(
      'R2 yapılandırılmamış (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / ' +
        'R2_BUCKET_NAME / R2_PUBLIC_URL alanlarının hepsi .env\'de dolu olmalı). Çıkılıyor.',
    )
    await pool.end()
    return
  }

  const { rows } = await pool.query(
    "SELECT id, image_url FROM clothing_items WHERE image_url IS NOT NULL AND image_url NOT LIKE 'http%'",
  )

  if (rows.length === 0) {
    console.log('Taşınacak yerel fotoğraf yok — hepsi zaten R2\'de ya da hiç fotoğraf yok.')
    await pool.end()
    return
  }

  console.log(`${rows.length} yerel fotoğraf bulundu.\n`)

  let tasindi = 0
  let dosyaYok = 0

  for (const row of rows) {
    const dosyaAdi = path.basename(row.image_url)
    const kaynak = path.join(UPLOAD_DIR, dosyaAdi)

    if (!fs.existsSync(kaynak)) {
      console.log(`  [DOSYA BULUNAMADI] ${row.id}: ${kaynak}`)
      dosyaYok += 1
      continue
    }

    console.log(`  ${row.id}: ${row.image_url} → R2/clothing-items/${dosyaAdi}`)

    if (UYGULA) {
      const buffer = fs.readFileSync(kaynak)
      const contentType = dosyaAdi.endsWith('.png')
        ? 'image/png'
        : dosyaAdi.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg'

      // R2'ye ÖNCE yüklenir, veritabanı ANCAK ondan sonra güncellenir — sıra
      // tersine olsaydı ve yükleme patlarsa kayıt artık var olmayan bir R2
      // adresini gösterirdi (migrate-selfie-photos.js'teki "önce yaz, sonra
      // güncelle" disipliniyle aynı gerekçe). Yerel dosya BİLEREK silinmez.
      const publicUrl = await storageRepository.upload(`clothing-items/${dosyaAdi}`, buffer, contentType)
      await pool.query('UPDATE clothing_items SET image_url = $1 WHERE id = $2', [publicUrl, row.id])
      tasindi += 1
    }
  }

  console.log(
    `\n${UYGULA ? 'Taşındı' : 'Taşınacak'}: ${tasindi || rows.length - dosyaYok}, ` +
      `dosya bulunamadı: ${dosyaYok}`,
  )

  if (!UYGULA && rows.length - dosyaYok > 0) {
    console.log('\nGerçekten taşımak için: node test-scripts/migrate-photos-to-r2.js --uygula')
  }

  await pool.end()
}

main().catch(async (error) => {
  console.error('\nBeklenmeyen hata:', error)
  await pool.end().catch(() => {})
  process.exit(1)
})
