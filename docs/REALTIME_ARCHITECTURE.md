# TurfScore Realtime Architecture (Phase 7)

## Overview

Scoring remains **HTTP-only** through the Phase 5 cricket engine. Socket.IO distributes **authoritative** post-commit state to viewers. Socket handlers never calculate cricket scores.

```
Scorer UI ──HTTP──► Scoring API ──► Cricket Engine ──► MongoDB
                                           │
                                           └──► Socket.IO rooms ──► Viewers
```

## Rooms

- Room name: `match:<mongoMatchId>`
- Join via client event `MATCH_JOIN` with either:
  - `{ matchId }` (authenticated owner/admin), or
  - `{ publicMatchId }` (public viewer when `publicLiveEnabled`)

## Authentication

- Socket handshake may include Bearer / `auth.token` (scorer).
- Anonymous sockets are allowed as **viewers** only.
- Public join requires `publicLiveEnabled === true`.
- Scorers still authorize mutations only via HTTP (`requireAuth` + ownership).

## Events (server → client)

| Event | When |
|-------|------|
| `MATCH_JOINED` | Successful room join ack companion |
| `MATCH_STARTED` | Match started |
| `DELIVERY_RECORDED` | After delivery commit |
| `DELIVERY_UPDATED` | After delivery edit rebuild |
| `DELIVERY_UNDONE` | After undo rebuild |
| `WICKET_RECORDED` | Delivery result.wicket |
| `OVER_COMPLETED` | Delivery result.overCompleted |
| `INNINGS_COMPLETED` | Innings ended |
| `INNINGS_STARTED` | Second innings started |
| `MATCH_COMPLETED` | Match finished |
| `MATCH_STATE_UPDATED` | Companion state channel (most mutations) |
| `LIVE_SHARING_DISABLED` | Scorer stopped public sharing |
| `VIEWER_COUNT` | Room size changed |

Client → server: `MATCH_JOIN`, `MATCH_LEAVE` only.

## Payload

Includes `matchId`, `publicMatchId`, `eventId?`, `version`, `presentation`, compact `state`, optional `delivery` / `result`, `timestamp`. No tokens, passwords, or private user fields.

## Versioning

- Every mutation increments `match.version`.
- Clients ignore `incoming.version <= local.version`.
- If `incoming.version > local.version + 1`, refetch HTTP snapshot (public or scoring API).
- Scorers apply HTTP response first; ignore socket echoes for the same `eventId` / version.

## Public sharing

- `publicLiveEnabled` default **false**
- `publicMatchId` format: `TS-XXXXXXXX` (non-enumerable)
- Enable: `POST /api/matches/:id/live-sharing/enable`
- Disable: `POST /api/matches/:id/live-sharing/disable`
- Public snapshot: `GET /api/public/matches/:publicMatchId`
- Public scorecard: `GET /api/public/matches/:publicMatchId/scorecard`
- Viewer UI: `/live/:publicMatchId` (no keypad)

## Reconnect

On reconnect: re-join room + HTTP refetch authoritative state. Do not invent missed deliveries from socket backlog.

## Render / CORS

- Socket.IO CORS origin = `CLIENT_URL` (credentials enabled).
- Vite proxies `/api` and `/socket.io` (ws) to the API in development.
- Single-node Socket.IO is assumed for first Render deploy. Structure allows a Redis adapter later without changing room names.

## Scaling limitation

Horizontal scale requires a Socket.IO adapter (e.g. Redis). Not implemented in Phase 7.
