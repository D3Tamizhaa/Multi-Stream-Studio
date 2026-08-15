import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

const PORT = process.env.PORT || 3000
const HOST = '0.0.0.0'

const distPath = path.join(__dirname, 'dist')

// Serve React/Vite build
app.use(express.static(distPath))

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Multi Stream Studio'
  })
})

// React SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, HOST, () => {
  console.log(`Multi Stream Studio running on ${HOST}:${PORT}`)
})
