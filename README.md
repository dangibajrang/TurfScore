# TurfScore

Live cricket scoring for local turfs — score matches in real time, share scorecards, and track team/player statistics.

## Stack

| Layer | Tech |
|-------|------|
| Client | React 19, Vite, TypeScript, Tailwind, TanStack Query, Zustand, React Hook Form + Zod |
| Server | Express 5, TypeScript, MongoDB + Mongoose, Socket.IO, JWT auth |
| Realtime | Socket.IO (live scoring / public viewers) |

## Project layout

```
TurfScore/
├── client/          # Frontend (port 5190)
├── server/          # API (port 15190)
├── docs/            # Implementation plan
└── README.md
```

## Prerequisites

- **Node.js 20+** ([nodejs.org](https://nodejs.org/))
- **MongoDB** — either:
  - Local MongoDB on `mongodb://127.0.0.1:27017/turfscore`, or
  - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) URI, or
  - In-memory Mongo (no install) via `npm run dev:memory` on the server

## Quick start

Open **two terminals**.

### 1. API server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

- API: http://localhost:15190  
- Health: http://localhost:15190/api/health  

Edit `server/.env` if needed:

```env
PORT=15190
MONGODB_URI=mongodb://127.0.0.1:27017/turfscore
CLIENT_URL=http://localhost:5190
JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars!!
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-chars!
```

**No local MongoDB?** Use an in-memory database:

```bash
cd server
npm install
npm run dev:memory
```

### 2. Web client

```bash
cd client
npm install
npm run dev
```

- App: http://localhost:5190  
- Vite proxies `/api`, `/uploads`, and `/socket.io` to the API on port 15190.

Register a new account in the UI, or seed demo users (below).

### Optional: seed demo data

```bash
cd server
npm run seed
```

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `Password123!` | ADMIN |
| `arjun@example.com` | `Password123!` | USER |

`npm run seed:reset` wipes collections then re-seeds (**dev only**).

## Features

- Auth (register, login, profile, password reset link in dev)
- Teams & players (with optional photo upload; soft-deactivate preserves history)
- Match create / edit / start / complete + match history (search, filters, cards)
- Live scoring, undo/edit deliveries, scorecard (print + share)
- Public live viewer (Socket.IO)
- Offline-first scoring with queued sync (Phase 8)
- Player & team career statistics, leaderboards, dashboard analytics
- Global search (matches / teams / players)

## Useful scripts

| Location | Command | Purpose |
|----------|---------|---------|
| `server/` | `npm run dev` | API with file watch |
| `server/` | `npm run dev:memory` | API + in-memory Mongo |
| `server/` | `npm run seed` | Seed demo users/data |
| `server/` | `npm test` | Unit tests |
| `server/` | `npm run build` | Compile to `dist/` |
| `client/` | `npm run dev` | Vite dev server |
| `client/` | `npm run build` | Production build |
| `client/` | `npm test` | Unit tests |
| `client/` | `npm run test:e2e` | Playwright E2E (needs servers) |

## Upload to GitHub

1. Create a new empty repository on GitHub (do **not** add a README if you already have this one).
2. From the project root:

```bash
git init
git add .
git commit -m "Initial commit: TurfScore MERN live cricket scoring"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

**Never commit** `server/.env`, `client/.env`, `node_modules/`, or `server/uploads/` — they are gitignored.

## Share as a ZIP

A clean archive (without `node_modules`, secrets, or build output) can be created from the project root. Recipients should:

1. Unzip the folder  
2. Follow **Quick start** above (`npm install` in both `server/` and `client/`)  
3. Copy `server/.env.example` → `server/.env` and set `MONGODB_URI`  

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `EADDRINUSE` on API port | Another Node process is using that port — stop it, or change `PORT` in `server/.env` |
| MongoDB / Atlas connection error | Check `MONGODB_URI`, network access, or use `npm run dev:memory` |
| Client API errors / proxy refused | Start the server first; confirm it listens on the `PORT` in `server/.env` (default 15190) |
| Blank statistics | Complete at least one scored match — stats are rebuilt from match snapshots |

## Docs

- `docs/IMPLEMENTATION_PLAN.md` — architecture and phase plan  
- `docs/STATISTICS_ARCHITECTURE.md` — Phase 9 stats sources, indexes, caching  
- `docs/PHASE_9_FEEDBACK.md` — prioritized real-match UX feedback  
- `docs/OFFLINE_ARCHITECTURE.md` — offline queue + sync  
- `docs/REALTIME_ARCHITECTURE.md` — Socket.IO live sharing  
- `Implementation_guide.md` — full product guide  

## License

Private / unlicensed unless you add one.
