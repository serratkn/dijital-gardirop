const fs = require('node:fs')
const path = require('node:path')
const tls = require('node:tls')
const { Pool } = require('pg')

// DB_SSL=true olduğunda TLS ile bağlanır (sertifika doğrulaması AÇIK —
// `rejectUnauthorized: false` YAZILMADI, çünkü hem Neon hem Render'ın genel
// uçları geçerli, herkese güvenilen bir CA kullanıyor; doğrulamayı kapatmak
// gereksiz bir MITM riski açardı). Yerel Docker Postgres'te SSL kurulu
// olmadığı için varsayılan `false`'tur — yalnızca .env'de açıkça istenirse
// devreye girer (Neon'a taşınırken eklendi, bkz. CLAUDE.md §9).
//
// YAKALANAN HATA (Render → Neon cutover) — bağlantı "self-signed
// certificate" hatasıyla düşüyordu. Kök sebep TLS zinciriyle İLGİLİ
// DEĞİLDİ: Render'daki `DB_HOST` env değişkeni Neon'a hiç güncellenmemiş,
// hâlâ eski Render-içi Postgres'in dahili adını (`dpg-...`) taşıyordu —
// o dahili sunucu kendinden imzalı bir sertifika kullanıyor, tam da bu
// hatayı üretiyordu. `DB_HOST` Neon'un gerçek adresine düzeltilince sorun
// anında çözüldü.
//
// Bu iz sürerken, TLS zincirinin kendisi için de kalıcı bir sağlamlaştırma
// yapıldı: Neon'un ucu Let's Encrypt'in nispeten yeni bir çapraz-imza
// kökünden geçiyor ("Root YR") ve bazı Node/OpenSSL sürümlerinin gömülü kök
// listesi bunu henüz tanımayabilir. `certs/neon-ca-bundle.pem` bu ara
// sertifikaları taşır ve **Node'un varsayılan kök listesinin YERİNE değil
// YANINA** eklenir (`ca` seçeneği tek başına verilirse varsayılan listenin
// TAMAMEN yerini alır — bu yüzden `tls.rootCertificates` ile birleştirildi).
// Dosya yoksa (`DB_CA_CERT_PATH` boş/geçersizse) sessizce `ssl: true`
// bırakılır — yerel geliştirme ya da başka bir Postgres sağlayıcısı bundan
// etkilenmez.
function resolveSslOption() {
  if (process.env.DB_SSL !== 'true') return false

  const certPath = process.env.DB_CA_CERT_PATH || path.join(__dirname, '..', '..', 'certs', 'neon-ca-bundle.pem')
  try {
    const bundle = fs.readFileSync(certPath, 'utf8')
    const extraCerts = bundle
      .split(/(?=-----BEGIN CERTIFICATE-----)/)
      .map((block) => block.trim())
      .filter(Boolean)
    return { ca: [...tls.rootCertificates, ...extraCerts] }
  } catch {
    // Bundle yok/okunamıyor — yine de bağlan, Node'un kendi kök listesiyle
    // dener (birçok sağlayıcı için zaten yeterlidir).
    return true
  }
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: resolveSslOption(),
})

// pg.Pool emits 'error' when an idle client's connection drops (e.g. DB restarts).
// Without a listener, Node treats it as an unhandled error and kills the process.
pool.on('error', (error) => {
  console.error('Beklenmeyen veritabanı havuzu hatası:', error.message)
})

module.exports = pool
