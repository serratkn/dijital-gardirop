const fs = require('node:fs')
const path = require('node:path')
const { Pool } = require('pg')

// DB_SSL=true olduğunda TLS ile bağlanır (sertifika doğrulaması AÇIK —
// `rejectUnauthorized: false` YAZILMADI, çünkü hem Neon hem Render'ın genel
// uçları geçerli, herkese güvenilen bir CA kullanıyor; doğrulamayı kapatmak
// gereksiz bir MITM riski açardı). Yerel Docker Postgres'te SSL kurulu
// olmadığı için varsayılan `false`'tur — yalnızca .env'de açıkça istenirse
// devreye girer (Neon'a taşınırken eklendi, bkz. CLAUDE.md §9).
//
// YAKALANAN HATA — Render'da bağlantı "self-signed certificate" hatasıyla
// düşüyordu, Neon'un sertifikası GEÇERSİZ olduğu için DEĞİL: Neon'un
// zinciri Let's Encrypt'in nispeten yeni bir çapraz-imza kökünden geçiyor
// ("Root YR") ve Render'ın Node çalışma zamanının gömülü kök sertifika
// listesi bunu henüz tanımıyordu (yerel makinede — güncel bir kök listesiyle
// — sorunsuz doğrulanıyordu). Çözüm doğrulamayı GEVŞETMEK değil, ara
// sertifikaları AÇIKÇA sağlamaktı: `certs/neon-ca-bundle.pem` bu zinciri
// taşır. Dosya yoksa (`DB_CA_CERT_PATH` boş/geçersizse) sessizce `ssl: true`
// bırakılır — yerel geliştirme ya da başka bir Postgres sağlayıcısı bundan
// etkilenmez.
// GEÇİCİ TEŞHİS — Render'daki canlı bağlantı hatasını /health üzerinden
// gözlemlemek için (sunucu loglarına erişim yok). Sorun çözülünce
// `dgSslDebug` ataması ve HealthService'teki okunması kaldırılabilir.
function resolveSslOption() {
  const debug = { dbSslEnv: process.env.DB_SSL, certPath: null, certRead: false, certError: null, certCount: 0 }

  if (process.env.DB_SSL !== 'true') {
    resolveSslOption.debug = debug
    return false
  }

  const certPath = process.env.DB_CA_CERT_PATH || path.join(__dirname, '..', '..', 'certs', 'neon-ca-bundle.pem')
  debug.certPath = certPath
  try {
    const bundle = fs.readFileSync(certPath, 'utf8')
    // TEK BİRLEŞİK STRING DEĞİL, DİZİ olarak geçiriliyor — Render'da (farklı
    // Node/OpenSSL sürümü) tek bir string içine art arda eklenmiş birden
    // fazla PEM bloğu sessizce yalnızca İLKİNİ yükledi (yerelde çalışıyordu,
    // Render'da "self-signed certificate" ile düşüyordu — /health'teki
    // certCount doğruydu ama TLS yalnızca ilk sertifikayı kullanıyordu).
    // `ca: [cert1, cert2, ...]` Node'un resmi olarak önerdiği, sürümden
    // bağımsız çalışan biçim.
    const ca = bundle
      .split(/(?=-----BEGIN CERTIFICATE-----)/)
      .map((block) => block.trim())
      .filter(Boolean)
    debug.certRead = true
    debug.certCount = ca.length
    resolveSslOption.debug = debug
    return { ca }
  } catch (error) {
    // Bundle yok/okunamıyor — yine de bağlan, Node'un kendi kök listesiyle
    // dener (birçok sağlayıcı için zaten yeterlidir).
    debug.certError = error.message
    resolveSslOption.debug = debug
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

pool.dgSslDebug = resolveSslOption.debug

// pg.Pool emits 'error' when an idle client's connection drops (e.g. DB restarts).
// Without a listener, Node treats it as an unhandled error and kills the process.
pool.on('error', (error) => {
  console.error('Beklenmeyen veritabanı havuzu hatası:', error.message)
})

module.exports = pool
