require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')

const pool = require('./src/config/database')
const { UPLOAD_DIR } = require('./src/config/upload')
const UserRepository = require('./src/repositories/UserRepository')
const EmailRepository = require('./src/repositories/EmailRepository')
const { AuthService } = require('./src/services/AuthService')
const createAuthenticate = require('./src/middleware/authenticate')
const createAuthRoutes = require('./src/routes/authRoutes')

const healthRoutes = require('./src/routes/healthRoutes')
const categoryRoutes = require('./src/routes/categoryRoutes')
const userRoutes = require('./src/routes/userRoutes')
const skinToneRoutes = require('./src/routes/skinToneRoutes')
const statsRoutes = require('./src/routes/statsRoutes')
const stylePreferenceRoutes = require('./src/routes/stylePreferenceRoutes')
const clothingItemRoutes = require('./src/routes/clothingItemRoutes')
const outfitRoutes = require('./src/routes/outfitRoutes')
const weatherRoutes = require('./src/routes/weatherRoutes')

const app = express()
const PORT = process.env.PORT || 3001

// helmet'in VARSAYILANI Cross-Origin-Resource-Policy'yi 'same-origin' yapar;
// bu, kıyafet fotoğraflarının FARKLI bir origin'den (web :5173, Android
// 10.0.2.2) <img> ile yüklenmesini KIRAR. Fotoğraflar zaten bilinçli olarak
// cross-origin ve token'sız servis ediliyor (tahmin edilemez UUID adı) — bu
// yeni bir zayıflatma değil, MEVCUT tasarımın doğal sonucu. Geri kalan tüm
// helmet varsayılanları (CSP, X-Frame-Options, HSTS vb.) olduğu gibi kalır.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// CORS artık SINIRLI: eskiden cors() hiçbir origin kısıtlaması yapmıyordu
// (herhangi bir web sitesi tarayıcıdan bu API'ye istek atabilirdi). İzin
// verilen origin'ler .env'deki CORS_ALLOWED_ORIGINS'ten (virgülle ayrılmış)
// okunur ve geliştirme + Capacitor varsayılanlarına EKLENİR — üzerine
// YAZILMAZ, aksi hâlde .env'i eksik dolduran biri kendi web ya da Android
// bağlantısını koparırdı.
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173', // web geliştirme (Vite dev sunucusu)
  'http://localhost', // Capacitor Android (capacitor.config.json > androidScheme: 'http')
  'capacitor://localhost', // Capacitor iOS varsayılan şeması
]

function resolveAllowedOrigins() {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]))
}

const allowedOrigins = resolveAllowedOrigins()

app.use(
  cors({
    origin(origin, callback) {
      // Origin header'ı OLMAYAN istekler (curl, sunucu-sunucu çağrıları,
      // Postman) reddedilmez: CORS zaten yalnızca TARAYICI kaynaklı isteklere
      // uygulanan bir tarayıcı davranışıdır, bu istemciler onun kapsamı dışında.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('CORS: bu origin için izin verilmiyor'))
    },
  }),
)

app.use(express.json())

// Auth altyapısı uygulamada tek örnektir: token'ı imzalayan ve doğrulayan
// aynı servis olmalıdır. EmailRepository, "şifremi unuttum" e-postaları için
// — RESEND_API_KEY tanımlı değilse AuthService bunu sessizce atlar (bkz.
// AuthService constructor'ı ve #sendResetEmail).
const authService = new AuthService(
  new UserRepository(pool),
  new EmailRepository(process.env.RESEND_API_KEY, process.env.RESEND_FROM_ADDRESS),
)
const authenticate = createAuthenticate(authService)

// Selfie'ler ASLA statik olarak servis edilmez — bu blok, aşağıdaki genel
// '/uploads' static middleware'inden ÖNCE mount edilmelidir (sıra kritik:
// Express middleware'leri tanım sırasına göre dener; bu satır sonra gelseydi
// static handler zaten yanıt vermiş olurdu). Tek okuma yolu, kimliği
// req.userId'den okuyan token'lı GET /api/users/skin-tone-analysis/photo'dur.
// Kıyafet fotoğrafları buna TABİ DEĞİLDİR ve eskisi gibi token'sız kalır —
// bu bilinçli bir ödünleşme (dosya adı tahmin edilemez UUID), CLAUDE.md'de var.
app.use('/uploads/selfies', (req, res) => {
  res.status(404).json({ error: 'Bulunamadı' })
})

// Yüklenen kıyafet fotoğrafları. Token gerektirmez: dosya adları rastgele UUID
// olduğu için tahmin edilemez, ayrıca <img> etiketleri Authorization başlığı
// gönderemez. (uploads/selfies/ yukarıdaki blokla bu middleware'e hiç ulaşmaz.)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d' }))

// --- Korumasız uçlar ---
app.use('/api', healthRoutes) // izleme için açık kalmalı
app.use('/api', createAuthRoutes(authService, authenticate))

// --- Korumalı uçlar ---
// Buradan sonraki her istek geçerli bir Bearer token ister ve
// controller'lar kullanıcı kimliğini yalnızca req.userId'den okur.
app.use('/api', authenticate, categoryRoutes)
// SIRA ÖNEMLİ: skinToneRoutes, userRoutes'TAN ÖNCE gelmelidir.
// userRoutes `GET /users/:id` tanımlıyor; sonra mount edilseydi Express
// "/users/skin-tone-analysis" yolundaki metni bir id sanıp o handler'a
// düşürürdü (ve UUID doğrulaması 404/400 verirdi).
app.use('/api', authenticate, skinToneRoutes)
app.use('/api', authenticate, userRoutes)
app.use('/api', authenticate, statsRoutes)
app.use('/api', authenticate, stylePreferenceRoutes)
app.use('/api', authenticate, clothingItemRoutes)
app.use('/api', authenticate, outfitRoutes)
// Hava durumu da korumalı: aksi hâlde API anahtarımız herkese açık bir
// hava durumu vekiline dönüşürdü.
app.use('/api', authenticate, weatherRoutes)

// CORS reddi Express'in varsayılan hata işleyicisine düşerse çıplak bir 500
// (HTML gövdeli) dönerdi — bu hem yanıltıcı (500 "bizim kodumuz patladı"
// demektir, oysa bu beklenen bir ret) hem de istemci için JSON olmayan bir
// gövde. Cors middleware'inin fırlattığı hatayı burada yakalayıp anlamlı bir
// 403 + JSON'a çeviriyoruz. Dört parametreli imza ZORUNLU — Express bunu
// yalnızca bu şekilde bir hata işleyici olarak tanır.
app.use((error, req, res, next) => {
  if (error?.message?.startsWith('CORS:')) {
    res.status(403).json({ error: 'Bu origin için erişim izni yok' })
    return
  }
  next(error)
})

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`)
})
