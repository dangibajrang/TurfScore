# TurfScore — Offline Architecture (Phase 8)

Offline-first scoring for unreliable networks. **The Phase 5 cricket engine on the server remains the only source of truth.**

## Principles

1. Do **not** run a second cricket engine in the browser.
2. Offline mode stores **commands** (delivery / undo / setup) in IndexedDB until they can be submitted.
3. Sync is **ordered per match** by `clientSequence`.
4. Every command has a stable **`eventId`** for idempotent retries.
5. Public viewers only see **server-confirmed** state (Socket.IO after sync).

## Stack

- **Dexie.js** over IndexedDB (`turfscore-offline-v1`)
- Client module: `client/src/features/offline/`

## Schema

### `queue`

| Field | Notes |
|-------|--------|
| `eventId` | UUID-style; reused on retry |
| `matchId` | Match scope |
| `clientSequence` | Monotonic per match (starts ~1001) |
| `commandType` | `DELIVERY` \| `UNDO` \| `SET_OPENINGS` \| `SELECT_BOWLER` \| `SELECT_BATTER` \| `START_INNINGS` |
| `payload` | Command body (no tokens/passwords) |
| `status` | `PENDING` \| `SYNCING` \| `SYNCED` \| `FAILED` |
| `baseExpectedVersion` | Version known when queued |
| `retryCount`, `lastError`, `lastErrorCode` | Diagnostics |
| `serverVersion`, `syncedAt` | After success |
| `deviceId` | Anonymous install id |

### `matchContexts`

Caches last server snapshot + match DTO + local presentation hint for resume.

### `meta`

Stores stable `deviceId` (diagnostics only — not auth).

## Flows

### Online

User action → generate `eventId` → HTTP API → engine → Mongo → Socket.IO.  
If the request fails as a **network** error → same `eventId` is persisted to the queue.

### Offline

User action → generate `eventId` → IndexedDB `PENDING` → local display projection → continue scoring.  
On reconnect → `syncMatchQueue(matchId)` in order.

### Sync worker

- One lock per `matchId` (no concurrent workers for the same match).
- Process `PENDING` / retryable `FAILED` in `clientSequence` order.
- Chain `expectedVersion` from each successful response.
- Exponential backoff + jitter (cap 30s, max 8 retries for network).
- **Do not** queue business errors (`INVALID_*`, `MATCH_COMPLETED`, etc.) as network failures when online.
- `MATCH_VERSION_CONFLICT` → mark `FAILED`, pause match sync, show conflict UI; require explicit retry after refresh.
- `401` → pause sync, keep queue, prompt re-auth (`AUTH_REQUIRED`).

## Local display projection

`localProjection.ts` applies **coarse** scoreboard deltas for UI confidence only.

**Limitations:**

- Not full strike rotation / partnership / FOW / extras legality.
- Undo while offline enqueues an `UNDO` command (does not delete prior queue rows).
- Final totals after sync always come from the server snapshot.

## Undo offline

Queued as `UNDO` so sync order is `DELIVERY` → `UNDO` (server `POST /undo` with version).  
Do not silently delete prior IndexedDB events.

## Edit offline

Editing **server-confirmed** deliveries stays online-only (`PATCH` API).  
Pending deliveries are not arbitrarily rewritten.

## Connectivity

Combines `navigator.onLine` with periodic `/api/health` probes.  
Browser “online” alone is insufficient.

**TanStack Query:** mutations use `networkMode: 'always'` (default Query `online` mode **pauses** `mutationFn` when `navigator.onLine` is false, which would silently drop offline taps). Queries use `offlineFirst`.

## Socket.IO

After sync, HTTP refetch + existing realtime reconnect rules apply.  
Unsynced local scores are **never** broadcast to public viewers.

## Multi-scorer

Offline scoring is safest with **one active scorer device** per match. Version conflicts surface as `SYNC ERROR`.

## Security

Queue never stores passwords, access tokens, or refresh tokens.

## Retention

`SYNCED` rows older than 24h are pruned. `PENDING` / `SYNCING` / `FAILED` are never auto-deleted.

## UI

- `OfflineBanner` on live scoring
- `OfflineScoreBadge` (Synced / Offline · N pending / Sync error)
- `SyncStatusPanel` with failed event list + Retry
- `OfflineResumeCard` on dashboard when pending queues exist

## Known limitations

1. Local projection is approximate — trust server after sync.
2. Strike rotation / crease IDs use a best-effort heuristic so offline taps queue the correct `batterId` for ordered sync; edge cases (complex extras) may still need scorer attention.
3. Server undo cannot target a specific `eventId` (undo last delivery only).
4. IndexedDB unavailable → show error; online scoring still works.
5. Simultaneous multi-device scoring while offline can produce conflicts by design.
6. Full document reload while the browser has **no network** requires a cached app shell (PWA/service worker). Without it, Vite cannot reload `index.html`. Queue data still survives in IndexedDB; resume works once the shell loads (online or via cache). E2E validates persistence via IndexedDB inspection + sync after reconnect.
