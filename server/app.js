const express = require("express")
const path = require("path")
const store = require("./store/memoryStore")

function normalizeUsername(raw) {
  const name = String(raw || "").trim()
  if (!name) return { ok: false, reason: "EMPTY" }
  if (name.length > 16) return { ok: false, reason: "TOO_LONG" }
  if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]{1,16}$/.test(name)) {
    return { ok: false, reason: "INVALID_CHARS" }
  }
  return { ok: true, username: name }
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value))
}

function createApp({ staticDir } = {}) {
  const app = express()
  app.disable("x-powered-by")
  app.use(express.json({ limit: "64kb" }))

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")
    if (req.method === "OPTIONS") return res.sendStatus(204)
    next()
  })

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true })
  })

  app.get("/api/config", (_req, res) => {
    res.json({
      grid: 4,
      pairs: 8,
      emojis: ["🐶", "🐱", "🦊", "🐼", "🐸", "🐵", "🐯", "🦁", "🐨", "🐰", "🐹", "🐻"],
    })
  })

  app.post("/api/users/login", async (req, res) => {
    const raw = req.body?.username
    if (raw == null || String(raw).trim() === "") {
      return res.json({ mode: "guest" })
    }

    const norm = normalizeUsername(raw)
    if (!norm.ok) {
      return res.status(400).json({ error: "INVALID_USERNAME", reason: norm.reason })
    }

    const user = store.ensureUser(norm.username)
    res.json({ mode: "user", user })
  })

  app.get("/api/users/:username", async (req, res) => {
    const norm = normalizeUsername(req.params.username)
    if (!norm.ok) return res.status(400).json({ error: "INVALID_USERNAME" })

    const user = store.getUser(norm.username)
    if (!user) return res.status(404).json({ error: "NOT_FOUND" })
    res.json({ user })
  })

  app.post("/api/scores", async (req, res) => {
    const norm = normalizeUsername(req.body?.username)
    if (!norm.ok) return res.status(400).json({ error: "INVALID_USERNAME" })

    const turns = Number(req.body?.turns)
    const timeMs = Number(req.body?.timeMs)
    if (!Number.isFinite(turns) || turns <= 0 || turns > 200) {
      return res.status(400).json({ error: "INVALID_TURNS" })
    }
    if (!Number.isFinite(timeMs) || timeMs <= 0 || timeMs > 60 * 60 * 1000) {
      return res.status(400).json({ error: "INVALID_TIME" })
    }

    const result = store.submitScore({ username: norm.username, turns, timeMs })
    res.json(result)
  })

  app.get("/api/leaderboard", async (req, res) => {
    const limit = Number(req.query.limit || 10)
    if (!Number.isFinite(limit)) return res.status(400).json({ error: "INVALID_LIMIT" })
    res.json({ items: store.makeLeaderboard(clamp(1, 100, limit)) })
  })

  if (staticDir) {
    const abs = path.resolve(staticDir)
    app.use(express.static(abs, { index: false, maxAge: "1h" }))
    app.get("/", (_req, res) => {
      res.sendFile(path.join(abs, "index.html"))
    })
  }

  return app
}

module.exports = { createApp }

