# TurfScore — Implementation Plan

> Phase 0 deliverable. Source specs: `Implementation_guide.md`, `TurfScore_Image.png`.
> Development is **phase-by-phase**. Stop for review after each phase.

## 1. Product

TurfScore is a production MERN app for live cricket scoring at local turfs: fast mobile/tablet scoring, professional scorecards, player/team stats, realtime viewers, and offline-first sync.

**Stack (locked):** React + Vite + TypeScript, Express + TypeScript, MongoDB + Mongoose, Socket.IO, Tailwind, TanStack Query, Zustand, RHF + Zod, Lucide. Deploy on Render + Atlas. No Next.js, Firebase, Supabase, or Postgres.

## 2. Architecture overview

```
Delivery Events (append-only, eventId)
        ↓
  Scoring Engine (pure, deterministic)
        ↓
  Derived Match State (denormalized snapshot + version)
        ↓
  Scorecard / Statistics / (later) Tournament Data
```

**API layering:** Route → Controller → Validation → Service → Domain Engine → Repository/Model.

**Frontend layering:** UI → Feature hooks → API/service → Backend. React displays authoritative state; **no cricket math in components**. Controllers stay thin. Models do not contain scoring calculations.

## 3. Folder structure

```
/client
  src/
    assets/branding/
    components/ui/
    features/{auth,dashboard,matches,scoring,teams,players,statistics,settings}/
    layouts/
    pages/
    hooks/
    lib/
    stores/
    services/
    styles/
    types/
/server
  src/
    config/
    controllers/
    routes/
    models/
    services/          # later: cricket/ engine
    middleware/
    validators/
    sockets/           # prepared; realtime in Phase 7
    utils/
    jobs/
    types/
/docs
```

## 4. Database design (Phase 1 models)

### Models in Phase 1

| Model | Purpose |
|-------|---------|
| User | Auth identity, profile, role |
| Team | Named squads, roster refs |
| Player | Person, role, optional team |
| Match | Fixture + rules + snapshot + version |
| Delivery | Append-only scoring events (source of truth) |

**Tournament models are deferred to Phase 10.**

### MatchRules (on Match)

Configurable per match; scoring engine (Phase 5) reads these — never hardcode overs/player counts in app logic.

```
overs, ballsPerOver (default 6), playersPerSide (default 11),
maxOversPerBowler?, powerplayEnabled?, powerplayOvers?,
superOverEnabled?, customRules?
```

Supports turf formats: 5 / 6 / 8 / 10 / 12 / 15 / 20 overs without engine rewrites.

### Match

- status: `DRAFT | UPCOMING | LIVE | COMPLETED | ABANDONED | CANCELLED`
- teams, venue, date/time, toss
- rules (MatchRules)
- innings[] + current snapshot (rebuildable from deliveries)
- **version** (optimistic concurrency for scoring mutations)
- createdBy, timestamps

### Delivery

- **eventId** (unique per match — idempotency)
- matchId, innings, over, ball, **sequence**
- batter, nonStriker, bowler
- runs (batter / extras / total)
- extras (wide, noBall, bye, legBye)
- wicket (isWicket, type, playerOut, fielder, …)
- createdBy, timestamps
- Extensible for Phase 5 engine; append-only for normal scoring

### Indexes (planned)

- Delivery: unique `{ matchId, eventId }`; `{ matchId, sequence }`
- Match: `{ status, date }`, `{ createdBy }`
- Player: `{ teamId }`, text/name as needed
- User: unique `email`

## 5. Scoring engine architecture (Phase 5+)

Pure / testable module (no Express, Mongoose, Socket.IO, or React):

```
(CurrentMatchState, DeliveryCommand) → (NewMatchState, DeliveryResult)
```

Services: ScoringEngine, InningsEngine, OverEngine, PlayerStatsEngine, MatchResultEngine, **ReconstructFromDeliveries**.

**Idempotency:** duplicate `eventId` → return existing state, no double apply.

**Optimistic concurrency:** client sends expected `matchVersion`; stale → `MATCH_VERSION_CONFLICT`.

**Audit (extensible):** undo/edit designed so who/when/old/new/reason can be stored later without schema redesign.

**Phase 5 gate:** comprehensive rule tests (balls, extras, wickets, edge cases) must pass before Phase 6 UI.

## 6. Realtime architecture (Phase 7) — COMPLETE

Socket.IO rooms `match:<matchId>`. Scoring stays HTTP → engine → Mongo → **then** broadcast. Public live viewer `/live/:publicMatchId` (`TS-…`, `publicLiveEnabled` opt-in). See `docs/REALTIME_ARCHITECTURE.md`. **Stop here; do not start Phase 8 offline.**

## 7. Offline architecture (Phase 8) — COMPLETE

IndexedDB (Dexie) delivery/command queue with ordered per-match sync, `eventId` idempotency, conflict/auth pause, and live-scoring UI indicators. See `docs/OFFLINE_ARCHITECTURE.md`.

## 7b. Statistics & history (Phase 9) — COMPLETE

Match history search/filters, player/team career stats from match snapshots, dashboard analytics, printable scorecards. See `docs/STATISTICS_ARCHITECTURE.md` and `docs/PHASE_9_FEEDBACK.md`. **Do not start Phase 10 (tournaments) without review.**

## 8. Authentication architecture (Phase 2+)

JWT access (Bearer) + refresh (httpOnly cookie), bcrypt passwords, roles `USER` / `ADMIN`, protected routes. Guest = local-only until login. **Not implemented in Phase 1.**

## 9. API conventions

- REST under `/api/*`
- Zod validation at boundary
- Consistent error shape: `{ error: { code, message, details? } }`
- Health: `GET /health`
- Thin controllers; domain logic in services/engine

## 10. Testing strategy

- Unit: pure cricket engine (highest priority, Phase 5 gate)
- Integration: API + Supertest
- Component: React Testing Library for critical UI
- E2E: Playwright scorer happy path (later)
- After each phase: build + available tests before review stop

## 11. Render deployment strategy (Phase 11)

- API: Render Web Service (Node)
- Client: Render Static Site (Vite build)
- MongoDB Atlas
- Env vars only via platform secrets; `.env.example` documented
- Health check path `/health`

## 12. Security strategy

Helmet, CORS allowlist, rate limiting, Zod input validation, password hashing (Phase 2), no secrets in repo, NoSQL injection-safe Mongoose usage, XSS-safe React defaults.

## 13. Design system (Phase 1)

Visual source of truth: `TurfScore_Image.png`.

| Token | Value |
|-------|--------|
| Background | `#06151A` |
| Surface | `#0F1C20` / elevated `#152428` |
| Primary | `#35D05F` |
| Danger / wicket / live | red |
| Extras accents | purple / orange / blue per guide |
| Text | white / muted gray-green |

Desktop: left sidebar. Mobile: bottom nav. Tablet: hybrid (sidebar or condensed shell by breakpoint). Recreate with real components — never use the screenshot as a background.

## 14. Phase roadmap

| Phase | Scope | Stop? |
|-------|--------|-------|
| 0 | This document | Done |
| 1 | Foundation, 5 models, shells, UI kit | Done |
| 2 | Auth + seed | Done |
| 3 | Teams/players/dashboard data | Done |
| 4 | Create match wizard | Done |
| 5 | Pure scoring engine + tests | Done |
| 6 | Scoring UI + scorecard | Done |
| **7** | Realtime + live viewer | **Done** |
| **8** | Offline sync | **Done** — see `docs/OFFLINE_ARCHITECTURE.md` |
| **9** | Stats/history/polish | **Done** — see `docs/STATISTICS_ARCHITECTURE.md`, `docs/PHASE_9_FEEDBACK.md` |
| 10 | Tournament models + UI | After review |
| 11 | E2E, docs, Render | After review |


## 15. Phase 1 acceptance

- `/client` and `/server` build cleanly
- Models: User, Team, Player, Match (with MatchRules + version), Delivery (with eventId)
- No Tournament model
- No scoring engine, no fake dashboard data, no fake scoring buttons
- `/health` works; Mongo connect + graceful shutdown correct
- Responsive shells at 320–1440px breakpoints
