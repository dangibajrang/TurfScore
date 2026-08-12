# TurfScore Cricket Scoring Engine

Phase 5 domain documentation. The engine is the authoritative calculator for live scoring. Delivery events are the source of truth; match snapshots are denormalized caches that must be reconstructible.

## Architecture

```
DeliveryCommand
      ↓
Validation (XI, overs, extras, wickets)
      ↓
ScoringEngine.applyDelivery (pure)
      ↓
New MatchState + DeliveryResult
      ↓
Persist Delivery + Match.snapshot.scoring
```

**Location:** `server/src/services/cricket/`

The engine has **no** dependency on React, Express, Socket.IO, or browser APIs. MongoDB access lives in `scoringService.ts`.

## Domain model

| Type | Role |
|------|------|
| `MatchState` | Full live match: rules, innings[], target, result, version |
| `InningsState` | Score, wickets, legalBalls, striker/non-striker/bowler, batters/bowlers maps, FOW, partnerships |
| `DeliveryCommand` | What happened (not computed totals) |
| `DeliveryResult` | Flags: legal ball, over/innings/match complete, needs new batter/bowler |
| `MatchRules` | overs, ballsPerOver, playersPerSide, maxOversPerBowler, powerplay*, superOver* |

Overs are **never** stored as floats. Use integer `legalBalls`; display via `formatOvers(legalBalls, ballsPerOver)` → `"8.2"`.

## Delivery lifecycle

1. Match must be `LIVE`.
2. Opening batters: `POST /api/matches/:id/openings`
3. Current bowler: `POST /api/matches/:id/bowler`
4. Each ball: `POST /api/matches/:id/deliveries` with `eventId` + `expectedVersion`
5. On wicket without `nextBatterId`: `needsNewBatter` → `POST .../batter`
6. On over complete: `needsNewBowler` → select bowler again
7. After innings 1: `POST .../innings/start` for innings 2
8. Chase / all-out / overs → match result

## Legal balls

A delivery is **legal** unless it is a **wide** or **no-ball**.

- Legal ball increments `legalBalls` and `ballsInCurrentOver`
- Over completes when `ballsInCurrentOver === rules.ballsPerOver`
- Wide / no-ball on “last ball” does **not** finish the over

## Extras

| Extra | Team | Batter | Bowler conceded | Legal ball |
|-------|------|--------|-----------------|------------|
| Wide | +wide | 0 | +wide | No |
| No-ball | +noBall + bat runs | bat runs | +noBall + bat runs | No |
| Bye | +bye | 0 | 0 | Yes |
| Leg-bye | +legBye | 0 | 0 | Yes |

Categories are stored separately; `totalExtras = wide + noBall + bye + legBye (+ penalty)`.

## Wickets

Supported: `BOWLED`, `CAUGHT`, `LBW`, `STUMPED`, `RUN_OUT`, `HIT_WICKET`, `RETIRED_HURT`, `OTHER`.

- Bowled/caught/LBW/stumped/hit-wicket **invalid** on no-ball
- Catch/stumping require `fielderId`
- `RETIRED_HURT` does not increment all-out wickets
- Max wickets = `playersPerSide - 1`

## Strike rotation

1. Apply completed runs for the delivery (including additional runs off wide / byes / `runsCompleted` on run-out).
2. Odd → swap striker/non-striker.
3. If over completes → swap again (end of over).

## Bowler limits

`maxOversPerBowler` (default `ceil(overs/5)`). Enforced when selecting a bowler for a new over.

## Maidens

When an over completes, if the bowler’s `currentOverRuns === 0` across `ballsPerOver` legal balls → maiden += 1. Byes/leg-byes do not add to bowler runs.

## Innings / match completion

Innings ends when:

- `legalBalls >= overs * ballsPerOver`, or
- `wickets >= playersPerSide - 1`, or
- second innings `totalRuns >= target`

Target after innings 1: `firstInningsRuns + 1`.

Results: win by runs, win by wickets, tie. Super over is deferred.

## Undo

`POST /api/matches/:id/undo` with `expectedVersion`:

1. Mark latest non-undone delivery `isUndone`
2. Rebuild state from setup events + remaining deliveries
3. Persist snapshot; bump version

Do **not** subtract scores manually.

## Edit

`PATCH /api/matches/:id/deliveries/:deliveryId` stores audit (`previous`, reason), then rebuilds.

## Idempotency

Unique index `{ matchId, eventId }`. Duplicate `eventId` returns the existing delivery without double-applying.

## Concurrency

Clients send `expectedVersion`. Mismatch → `409 MATCH_VERSION_CONFLICT`. Successful mutation → `version += 1`.

## Reconstruction

`POST /api/matches/:id/rebuild` and internal undo/edit paths replay:

setup events (openings, bowler, replacement, startSecond) + deliveries → `MatchState`

`validateMatchSnapshot(stored, reconstructed)` compares runs/wickets/legalBalls.

## API map

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/matches/:id/scoring` | Engine state |
| GET | `/api/matches/:id/scorecard` | Scorecard DTO |
| POST | `/api/matches/:id/openings` | Opening batters |
| POST | `/api/matches/:id/bowler` | Current bowler |
| POST | `/api/matches/:id/batter` | Replacement batter |
| POST | `/api/matches/:id/deliveries` | Record delivery |
| POST | `/api/matches/:id/undo` | Undo last delivery |
| PATCH | `/api/matches/:id/deliveries/:deliveryId` | Edit + rebuild |
| POST | `/api/matches/:id/innings/start` | Start 2nd innings |
| POST | `/api/matches/:id/rebuild` | Force rebuild |

## Phase 6 note

No scoring UI in Phase 5. Phase 6 consumes these APIs for the keypad / live scorer.
