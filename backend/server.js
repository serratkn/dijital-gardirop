require('dotenv').config()

const express = require('express')
const cors = require('cors')
const healthRoutes = require('./src/routes/healthRoutes')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api', healthRoutes)

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`)
})
