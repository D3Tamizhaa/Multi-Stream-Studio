import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

const PORT = process.env.PORT || 3000
const HOST = '0.0.0.0'

const distPath = path.join(__dirname, 'dist')

app.use(express.static(distPath))

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Multi Stream Studio'
  })
})

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`)
})
