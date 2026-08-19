require('dotenv').config()

const express = require('express')
const cors = require('cors')

const pool = require('./src/config/database')
const { UPLOAD_DIR } = require('./src/config/upload')
const UserRepository = require('./src/repositories/UserRepository')
const { AuthService } = require('./src/services/AuthService')
const createAuthenticate = require('./src/middleware/authenticate')
const createAuthRoutes = require('./src/routes/authRoutes')

const healthRoutes = require('./src/routes/healthRoutes')
const categoryRoutes = require('./src/routes/categoryRoutes')
const userRoutes = require('./src/routes/userRoutes')
const stylePreferenceRoutes = require('./src/routes/stylePreferenceRoutes')
const clothingItemRoutes = require('./src/routes/clothingItemRoutes')
const outfitRoutes = require('./src/routes/outfitRoutes')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Auth altyapısı uygulamada tek örnektir: token'ı imzalayan ve doğrulayan
// aynı servis olmalıdır.
const authService = new AuthService(new UserRepository(pool))
const authenticate = createAuthenticate(authService)

// Yüklenen fotoğraflar. Token gerektirmez: dosya adları rastgele UUID olduğu
// için tahmin edilemez, ayrıca <img> etiketleri Authorization başlığı gönderemez.
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d' }))

// --- Korumasız uçlar ---
app.use('/api', healthRoutes) // izleme için açık kalmalı
app.use('/api', createAuthRoutes(authService, authenticate))

// --- Korumalı uçlar ---
// Buradan sonraki her istek geçerli bir Bearer token ister ve
// controller'lar kullanıcı kimliğini yalnızca req.userId'den okur.
app.use('/api', authenticate, categoryRoutes)
app.use('/api', authenticate, userRoutes)
app.use('/api', authenticate, stylePreferenceRoutes)
app.use('/api', authenticate, clothingItemRoutes)
app.use('/api', authenticate, outfitRoutes)

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`)
})
