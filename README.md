# 记忆翻牌（全栈版）

前端：原生 HTML/CSS/JS + Tailwind CDN

后端：Node.js + Express（本地运行） / Vercel Functions（线上运行）

存储：内存存储（演示用，Vercel 冷启动可能清空排行榜）

功能：用户名登录（无密码/游客）、胜利自动提交成绩、个人积分与最佳、全局 Top10 排行榜、分享链接。

## 本地运行（一个命令启动）

```bash
npm install
npm start
```

打开 `http://localhost:5173`。

开发模式（自动重启）：

```bash
npm run dev
```

## API

- `GET /api/config`
- `POST /api/users/login` `{ username?: string }`
- `POST /api/scores` `{ username, turns, timeMs }`
- `GET /api/leaderboard?limit=10`

## 部署到 Vercel

直接导入仓库部署即可（已提供 `api/index.js` 与 `vercel.json` 重写规则）。

注意：本版本排行榜是“内存存储”，部署在 Vercel 上可能在冷启动/扩缩容后丢失数据；适合演示与联调。
