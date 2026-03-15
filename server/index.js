const path = require("path")
const { createApp } = require("./app")

const port = Number(process.env.PORT || 5173)
const clientDir = path.resolve(__dirname, "../client")

const app = createApp({
  staticDir: clientDir,
})

app.listen(port, () => {
  process.stdout.write(`Server running on http://localhost:${port}\n`)
})

