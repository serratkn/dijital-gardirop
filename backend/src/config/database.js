const { Pool } = require('pg')

// DB_SSL=true olduğunda TLS ile bağlanır (sertifika doğrulaması AÇIK —
// `rejectUnauthorized: false` YAZILMADI, çünkü hem Neon hem Render'ın genel
// uçları geçerli, herkese güvenilen bir CA kullanıyor; doğrulamayı kapatmak
// gereksiz bir MITM riski açardı). Yerel Docker Postgres'te SSL kurulu
// olmadığı için varsayılan `false`'tur — yalnızca .env'de açıkça istenirse
// devreye girer (Neon'a taşınırken eklendi, bkz. CLAUDE.md §9).
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? true : false,
})

// pg.Pool emits 'error' when an idle client's connection drops (e.g. DB restarts).
// Without a listener, Node treats it as an unhandled error and kills the process.
pool.on('error', (error) => {
  console.error('Beklenmeyen veritabanı havuzu hatası:', error.message)
})

module.exports = pool
