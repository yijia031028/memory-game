const path = require("path")
const { createApp } = require("../server/app")

const app = createApp({
  staticDir: path.resolve(__dirname, "../client"),
})

module.exports = (req, res) => {
  app(req, res)
}

