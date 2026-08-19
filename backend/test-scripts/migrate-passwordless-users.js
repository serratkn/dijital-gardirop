// Auth sistemi öncesinde oluşturulmuş, password_hash'i NULL olan kullanıcıları yönetir.
// Bu kullanıcılar giriş YAPAMAZ (AuthService.login parola özeti olmayan hesabı reddeder).
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/migrate-passwordless-users.js                        # durumu listele (varsayılan)
//   node test-scripts/migrate-passwordless-users.js --set-password <email> <sifre>
//   node test-scripts/migrate-passwordless-users.js --delete-empty         # verisi OLMAYANLARI sil
//   node test-scripts/migrate-passwordless-users.js --delete-all --force   # hepsini sil (VERİ KAYBI)
//
// Varsayılan davranış bilinçli olarak salt okunurdur: bu hesapların bir kısmının
// gerçek kıyafet/kombin verisi olabilir, körlemesine silmek veri kaybı demektir.

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const bcrypt = require('bcrypt')
const pool = require('../src/config/database')

const BCRYPT_ROUNDS = 10
const MIN_PASSWORD_LENGTH = 8

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const valueAfter = (flag) => args[args.indexOf(flag) + 1]

async function listPasswordlessUsers() {
  const result = await pool.query(`
    SELECT u.id, u.email, u.name,
           (SELECT COUNT(*) FROM clothing_items ci WHERE ci.user_id = u.id) AS item_count,
           (SELECT COUNT(*) FROM outfits o WHERE o.user_id = u.id) AS outfit_count
    FROM users u
    WHERE u.password_hash IS NULL
    ORDER BY u.created_at
  `)
  return result.rows
}

async function main() {
  const rows = await listPasswordlessUsers()

  console.log(`Şifresiz (password_hash IS NULL) kullanıcı sayısı: ${rows.length}\n`)
  for (const row of rows) {
    const data = `${row.item_count} parça, ${row.outfit_count} kombin`
    const flag = Number(row.item_count) + Number(row.outfit_count) === 0 ? '(veri yok)' : `(${data})`
    console.log(`  - ${row.email.padEnd(38)} ${flag}`)
  }

  if (rows.length === 0) {
    console.log('Yapılacak bir şey yok: tüm kullanıcıların şifresi tanımlı.')
    await pool.end()
    return
  }

  // --- Şifre atama: hesabı ve verisini korur ---
  if (has('--set-password')) {
    const email = valueAfter('--set-password')?.toLowerCase()
    const password = args[args.indexOf('--set-password') + 2]

    if (!email || !password) {
      console.error('\nKullanım: --set-password <email> <sifre>')
      process.exitCode = 1
      await pool.end()
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`\nŞifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`)
      process.exitCode = 1
      await pool.end()
      return
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const updated = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 AND password_hash IS NULL RETURNING id, email',
      [hash, email],
    )

    if (updated.rowCount === 0) {
      console.error(`\n"${email}" bulunamadı veya zaten bir şifresi var.`)
      process.exitCode = 1
    } else {
      console.log(`\n${updated.rows[0].email} için şifre atandı. Artık giriş yapabilir.`)
    }

    await pool.end()
    return
  }

  // --- Verisi olmayanları sil ---
  if (has('--delete-empty')) {
    const deleted = await pool.query(`
      DELETE FROM users u
      WHERE u.password_hash IS NULL
        AND NOT EXISTS (SELECT 1 FROM clothing_items ci WHERE ci.user_id = u.id)
        AND NOT EXISTS (SELECT 1 FROM outfits o WHERE o.user_id = u.id)
      RETURNING email
    `)
    console.log(`\nSilinen (verisi olmayan) hesap sayısı: ${deleted.rowCount}`)
    deleted.rows.forEach((row) => console.log(`  - ${row.email}`))
    await pool.end()
    return
  }

  // --- Hepsini sil (yıkıcı) ---
  if (has('--delete-all')) {
    if (!has('--force')) {
      console.error(
        '\n--delete-all bu hesapların TÜM kıyafet ve kombinlerini de siler (ON DELETE CASCADE).',
      )
      console.error('Emin olduğunuzu belirtmek için --force ekleyin.')
      process.exitCode = 1
      await pool.end()
      return
    }

    const deleted = await pool.query(
      'DELETE FROM users WHERE password_hash IS NULL RETURNING email',
    )
    console.log(`\nSilinen hesap sayısı: ${deleted.rowCount}`)
    await pool.end()
    return
  }

  console.log('\nSeçenekler:')
  console.log('  --set-password <email> <sifre>   hesabı ve verisini koruyarak şifre ata')
  console.log('  --delete-empty                   yalnızca verisi olmayanları sil')
  console.log('  --delete-all --force             hepsini ve verilerini sil')
  await pool.end()
}

main().catch((error) => {
  console.error('HATA:', error.message)
  process.exitCode = 1
  pool.end()
})
