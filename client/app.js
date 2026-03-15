function normalizeApiBase(input) {
  const raw = String(input || "").trim()
  if (!raw) return ""
  return raw.replace(/\/+$/, "")
}

function resolveApiBase() {
  const params = new URLSearchParams(location.search)
  const apiFromUrl = params.get("api")
  if (apiFromUrl) {
    const normalized = normalizeApiBase(apiFromUrl)
    if (normalized) localStorage.setItem("apiBase", normalized)
    return normalized
  }
  return normalizeApiBase(localStorage.getItem("apiBase"))
}

const API_BASE = resolveApiBase()

const API = {
  async getConfig() {
    const r = await fetch(`${API_BASE}/api/config`)
    if (!r.ok) throw new Error("CONFIG_FAILED")
    return r.json()
  },
  async login(username) {
    const r = await fetch(`${API_BASE}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data?.error || "LOGIN_FAILED")
    return data
  },
  async submitScore({ username, turns, timeMs }) {
    const r = await fetch(`${API_BASE}/api/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, turns, timeMs }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data?.error || "SUBMIT_FAILED")
    return data
  },
  async getLeaderboard(limit = 10) {
    const r = await fetch(`${API_BASE}/api/leaderboard?limit=${encodeURIComponent(String(limit))}`)
    if (!r.ok) throw new Error("LEADERBOARD_FAILED")
    return r.json()
  },
}

function $(id) {
  return document.getElementById(id)
}

function pad2(n) {
  return String(n).padStart(2, "0")
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${pad2(m)}:${pad2(s)}`
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

function createDeck({ pairs, emojis }) {
  const pick = shuffle(emojis).slice(0, pairs)
  const cards = []
  for (let i = 0; i < pick.length; i += 1) {
    const emoji = pick[i]
    const pairKey = `p${i}`
    cards.push({ id: `${pairKey}-a`, emoji, pairKey, faceUp: false, matched: false })
    cards.push({ id: `${pairKey}-b`, emoji, pairKey, faceUp: false, matched: false })
  }
  return shuffle(cards)
}

const state = {
  view: "game",
  user: { mode: "guest", username: null, totalScore: null, bestTurns: null, bestTimeMs: null },
  config: null,
  game: {
    cards: [],
    firstId: null,
    secondId: null,
    locked: false,
    turns: 0,
    matched: 0,
    startAt: null,
    elapsedMs: 0,
    timer: null,
    status: "idle",
    resolveToken: 0,
  },
  leaderboard: { items: [], loading: false },
}

function setToast(text) {
  const el = $("toast")
  if (!text) {
    el.classList.add("hidden")
    el.textContent = ""
    return
  }
  el.textContent = text
  el.classList.remove("hidden")
  window.clearTimeout(el._t)
  el._t = window.setTimeout(() => {
    el.classList.add("hidden")
  }, 2200)
}

function setApiStatus(text) {
  const el = $("apiStatus")
  el.textContent = text || ""
}

function showLoginModal(show) {
  const modal = $("loginModal")
  modal.classList.toggle("hidden", !show)
  modal.classList.toggle("flex", show)
  $("loginError").classList.add("hidden")
}

function showVictoryModal(show) {
  const modal = $("victoryModal")
  modal.classList.toggle("hidden", !show)
  modal.classList.toggle("flex", show)
}

function updateUserUI() {
  const badge = $("userBadge")
  const name = $("userName")

  if (state.user.mode === "user" && state.user.username) {
    badge.classList.remove("hidden")
    badge.classList.add("flex")
    name.textContent = state.user.username
    $("totalScore").textContent = String(state.user.totalScore ?? 0)
    $("bestTurns").textContent = state.user.bestTurns == null ? "-" : String(state.user.bestTurns)
    $("bestTime").textContent = state.user.bestTimeMs == null ? "-" : formatTime(state.user.bestTimeMs)
    return
  }

  badge.classList.add("hidden")
  badge.classList.remove("flex")
  name.textContent = ""
  $("totalScore").textContent = "-"
  $("bestTurns").textContent = "-"
  $("bestTime").textContent = "-"
}

function setView(next) {
  state.view = next
  $("gameView").classList.toggle("hidden", next !== "game")
  $("leaderboardView").classList.toggle("hidden", next !== "leaderboard")
}

function stopTimer() {
  if (state.game.timer) {
    window.clearInterval(state.game.timer)
    state.game.timer = null
  }
}

function startTimerIfNeeded() {
  if (state.game.timer) return
  if (state.game.startAt == null) state.game.startAt = Date.now()
  state.game.timer = window.setInterval(() => {
    state.game.elapsedMs = Date.now() - state.game.startAt
    $("time").textContent = formatTime(state.game.elapsedMs)
  }, 250)
}

function resetGame() {
  stopTimer()
  state.game.firstId = null
  state.game.secondId = null
  state.game.locked = false
  state.game.turns = 0
  state.game.matched = 0
  state.game.startAt = null
  state.game.elapsedMs = 0
  state.game.status = "idle"
  state.game.resolveToken += 1
  $("turns").textContent = "0"
  $("time").textContent = "00:00"
  showVictoryModal(false)

  const cfg = state.config || { pairs: 8, emojis: ["🐶", "🐱", "🦊", "🐼", "🐸", "🐵", "🐯", "🦁"] }
  state.game.cards = createDeck({ pairs: cfg.pairs || 8, emojis: cfg.emojis || [] })
  $("progress").textContent = `0 / ${state.game.cards.length}`
  renderBoard()
}

function renderBoard() {
  const board = $("board")
  board.innerHTML = ""

  for (const card of state.game.cards) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className =
      "group relative aspect-square rounded-2xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
    btn.disabled = state.game.locked || card.matched || card.faceUp || state.game.status === "victory"
    btn.setAttribute("aria-label", "卡片")
    btn.dataset.cardId = card.id
    btn.addEventListener("click", onCardClick)

    const inner = document.createElement("div")
    inner.className = "card-inner card-3d absolute inset-0 rounded-2xl"
    if (card.faceUp || card.matched) inner.classList.add("is-flipped")

    const back = document.createElement("div")
    back.className =
      "card-face absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-2xl ring-1 ring-white/10"
    back.textContent = "✦"

    const front = document.createElement("div")
    front.className =
      "card-face card-front absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-slate-900 text-3xl ring-1 ring-indigo-400/30"
    front.textContent = card.emoji

    if (card.matched) {
      front.classList.add("is-matched")
      front.classList.add("ring-emerald-400/40")
    }

    inner.appendChild(back)
    inner.appendChild(front)
    btn.appendChild(inner)
    board.appendChild(btn)
  }
}

function findCard(id) {
  return state.game.cards.find((c) => c.id === id)
}

function onCardClick(e) {
  const id = e.currentTarget?.dataset?.cardId
  if (!id) return
  if (state.game.locked) return
  if (state.game.status === "victory") return

  const card = findCard(id)
  if (!card || card.matched || card.faceUp) return

  startTimerIfNeeded()
  state.game.status = "running"

  card.faceUp = true
  if (!state.game.firstId) {
    state.game.firstId = id
    renderBoard()
    return
  }

  if (!state.game.secondId) {
    state.game.secondId = id
    state.game.turns += 1
    $("turns").textContent = String(state.game.turns)
    state.game.locked = true
    renderBoard()

    const a = findCard(state.game.firstId)
    const b = findCard(state.game.secondId)
    const token = (state.game.resolveToken += 1)
    window.setTimeout(async () => {
      if (token !== state.game.resolveToken) return
      if (!a || !b) return

      if (a.pairKey === b.pairKey) {
        a.matched = true
        b.matched = true
        state.game.matched += 2
        state.game.firstId = null
        state.game.secondId = null
        state.game.locked = false
        $("progress").textContent = `${state.game.matched} / ${state.game.cards.length}`
        renderBoard()
        if (state.game.matched === state.game.cards.length) {
          await onVictory()
        }
        return
      }

      window.setTimeout(() => {
        if (token !== state.game.resolveToken) return
        a.faceUp = false
        b.faceUp = false
        state.game.firstId = null
        state.game.secondId = null
        state.game.locked = false
        renderBoard()
      }, 550)
    }, 260)
  }
}

async function onVictory() {
  stopTimer()
  state.game.elapsedMs = Date.now() - (state.game.startAt || Date.now())
  state.game.status = "victory"
  $("victoryTurns").textContent = String(state.game.turns)
  $("victoryTime").textContent = formatTime(state.game.elapsedMs)
  $("victoryScore").textContent = "-"
  showVictoryModal(true)

  if (state.user.mode !== "user" || !state.user.username) {
    setToast("游客模式：未提交排行榜。输入用户名可累计积分。")
    return
  }

  setApiStatus("提交成绩中…")
  try {
    const result = await API.submitScore({
      username: state.user.username,
      turns: state.game.turns,
      timeMs: state.game.elapsedMs,
    })

    $("victoryScore").textContent = `+${result.scoreDelta}`
    state.user.totalScore = result.user.totalScore
    state.user.bestTurns = result.user.bestTurns
    state.user.bestTimeMs = result.user.bestTimeMs
    updateUserUI()
    state.leaderboard.items = result.leaderboardTop10 || []
    if (state.view === "leaderboard") renderLeaderboard()
    setToast("成绩已提交并更新排行榜")
    setApiStatus("")
  } catch {
    setApiStatus("成绩提交失败（仍可本地游玩）")
    setToast("成绩提交失败")
  }
}

function renderLeaderboard() {
  const tbody = $("leaderboardBody")
  tbody.innerHTML = ""

  const items = state.leaderboard.items || []
  if (!items.length) {
    $("leaderboardHint").textContent = "暂无数据：登录后通关即可上榜。"
    return
  }
  $("leaderboardHint").textContent = ""

  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]
    const tr = document.createElement("tr")
    tr.className = "text-slate-200"
    tr.innerHTML = `
      <td class="py-3 pr-4 text-slate-300">${i + 1}</td>
      <td class="py-3 pr-4 font-medium">${it.username}</td>
      <td class="py-3 pr-4">${it.totalScore}</td>
      <td class="py-3 pr-4">${it.bestTurns == null ? "-" : it.bestTurns}</td>
      <td class="py-3 pr-4">${it.bestTimeMs == null ? "-" : formatTime(it.bestTimeMs)}</td>
    `
    tbody.appendChild(tr)
  }
}

async function refreshLeaderboard() {
  state.leaderboard.loading = true
  $("leaderboardHint").textContent = "加载中…"
  try {
    const data = await API.getLeaderboard(10)
    state.leaderboard.items = data.items || []
    renderLeaderboard()
  } catch {
    $("leaderboardHint").textContent = "加载失败，请稍后重试。"
  } finally {
    state.leaderboard.loading = false
  }
}

async function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement("textarea")
  ta.value = text
  ta.style.position = "fixed"
  ta.style.top = "-1000px"
  document.body.appendChild(ta)
  ta.select()
  document.execCommand("copy")
  document.body.removeChild(ta)
}

function wireEvents() {
  $("navGame").addEventListener("click", () => setView("game"))
  $("navLeaderboard").addEventListener("click", async () => {
    setView("leaderboard")
    await refreshLeaderboard()
  })
  $("refreshLeaderboard").addEventListener("click", refreshLeaderboard)

  $("restart").addEventListener("click", () => {
    resetGame()
    setToast("已重新洗牌")
  })

  $("switchUser").addEventListener("click", () => {
    state.user = { mode: "guest", username: null, totalScore: null, bestTurns: null, bestTimeMs: null }
    updateUserUI()
    resetGame()
    showLoginModal(true)
  })

  $("share").addEventListener("click", async () => {
    if (state.user.mode !== "user" || !state.user.username) {
      setToast("登录后可生成带用户名的分享链接")
      showLoginModal(true)
      return
    }

    const urlParams = new URLSearchParams()
    urlParams.set("u", state.user.username)
    if (API_BASE) urlParams.set("api", API_BASE)
    const url = `${location.origin}${location.pathname}?${urlParams.toString()}`
    try {
      await copyText(url)
      setToast("分享链接已复制")
    } catch {
      setToast(url)
    }
  })

  $("closeLogin").addEventListener("click", () => showLoginModal(false))
  $("guestBtn").addEventListener("click", () => {
    state.user = { mode: "guest", username: null, totalScore: null, bestTurns: null, bestTimeMs: null }
    updateUserUI()
    resetGame()
    showLoginModal(false)
    setToast("已进入游客模式")
  })

  $("loginBtn").addEventListener("click", async () => {
    const input = $("usernameInput")
    const username = String(input.value || "").trim()
    const err = $("loginError")
    err.classList.add("hidden")
    err.textContent = ""

    try {
      setApiStatus("登录中…")
      const data = await API.login(username)
      if (data.mode !== "user") throw new Error("LOGIN_FAILED")
      state.user = {
        mode: "user",
        username: data.user.username,
        totalScore: data.user.totalScore,
        bestTurns: data.user.bestTurns,
        bestTimeMs: data.user.bestTimeMs,
      }
      updateUserUI()
      resetGame()
      showLoginModal(false)
      setToast("登录成功，通关将自动上榜")
      setApiStatus("")
    } catch {
      setApiStatus("")
      err.textContent = "用户名不合法：1-16位，支持中英数字与 _-"
      err.classList.remove("hidden")
    }
  })

  $("closeVictory").addEventListener("click", () => {
    showVictoryModal(false)
  })
  $("playAgain").addEventListener("click", () => {
    resetGame()
    showVictoryModal(false)
  })
}

async function bootstrap() {
  wireEvents()

  const params = new URLSearchParams(location.search)
  const u = params.get("u")
  if (u) $("usernameInput").value = u

  try {
    setApiStatus("连接服务中…")
    state.config = await API.getConfig()
    setApiStatus("")
  } catch {
    setApiStatus("API 不可用（仍可本地游玩）")
  }

  updateUserUI()
  resetGame()
  showLoginModal(true)
}

bootstrap()
