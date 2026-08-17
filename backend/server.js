require('dotenv').config()


const express = require('express')
const cors = require('cors')
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

app.use('/api', healthRoutes)
app.use('/api', categoryRoutes)
app.use('/api', userRoutes)
app.use('/api', stylePreferenceRoutes)
app.use('/api', clothingItemRoutes)
app.use('/api', outfitRoutes)

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`)
})
