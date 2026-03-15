function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value))
}

function calcScoreDelta({ turns, timeMs }) {
  const base = 100
  const turnBonus = clamp(0, 150, (20 - turns) * 10)
  const seconds = Math.ceil(timeMs / 1000)
  const timeBonus = clamp(0, 150, (90 - seconds) * 2)
  return Math.max(0, Math.round(base + turnBonus + timeBonus))
}

function isNewBest(prevTurns, prevTimeMs, turns, timeMs) {
  if (prevTurns == null || prevTimeMs == null) return true
  if (turns < prevTurns) return true
  if (turns > prevTurns) return false
  return timeMs < prevTimeMs
}

const db = {
  users: {},
  games: [],
}

function ensureUser(username) {
  const now = Date.now()
  if (!db.users[username]) {
    db.users[username] = {
      username,
      totalScore: 0,
      bestTurns: null,
      bestTimeMs: null,
      gamesPlayed: 0,
      lastPlayedAt: null,
      createdAt: now,
    }
  }
  return db.users[username]
}

function getUser(username) {
  return db.users[username] || null
}

function makeLeaderboard(limit) {
  const items = Object.values(db.users).map((u) => ({
    username: u.username,
    totalScore: u.totalScore || 0,
    bestTurns: u.bestTurns ?? null,
    bestTimeMs: u.bestTimeMs ?? null,
  }))

  items.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
    const aTurns = a.bestTurns ?? Number.POSITIVE_INFINITY
    const bTurns = b.bestTurns ?? Number.POSITIVE_INFINITY
    if (aTurns !== bTurns) return aTurns - bTurns
    const aTime = a.bestTimeMs ?? Number.POSITIVE_INFINITY
    const bTime = b.bestTimeMs ?? Number.POSITIVE_INFINITY
    return aTime - bTime
  })

  return items.slice(0, clamp(1, 100, limit || 10))
}

function submitScore({ username, turns, timeMs }) {
  const scoreDelta = calcScoreDelta({ turns, timeMs })
  const now = Date.now()
  const user = ensureUser(username)

  user.totalScore = (user.totalScore || 0) + scoreDelta
  user.gamesPlayed = (user.gamesPlayed || 0) + 1
  user.lastPlayedAt = now

  if (isNewBest(user.bestTurns, user.bestTimeMs, turns, timeMs)) {
    user.bestTurns = turns
    user.bestTimeMs = timeMs
  }

  db.games.unshift({
    id: `${now}-${Math.random().toString(16).slice(2, 10)}`,
    username,
    turns,
    timeMs,
    scoreDelta,
    createdAt: now,
  })
  db.games = db.games.slice(0, 2000)

  return { scoreDelta, user, leaderboardTop10: makeLeaderboard(10) }
}

module.exports = {
  ensureUser,
  getUser,
  submitScore,
  makeLeaderboard,
}

