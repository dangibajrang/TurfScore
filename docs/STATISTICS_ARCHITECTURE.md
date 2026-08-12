# TurfScore — Statistics Architecture (Phase 9)

Statistics are derived from **authoritative completed-match scoring snapshots** (`Match.snapshot.scoring`), not a second cricket engine in React.

## Sources

| Metric | Source |
|--------|--------|
| Player batting / bowling | Innings `batters` / `bowlers` maps inside completed match snapshots |
| Team W/L | `winnerTeamId` + team participation |
| Dashboard top performers | Same aggregation as `/api/statistics/summary` |
| Live scores on cards | Current snapshot innings totals (`scoreSummaryFromMatch`) |

Delivery documents remain the rebuild path for the Phase 5 engine; Phase 9 does **not** re-aggregate thousands of deliveries in Node for every request. Snapshots are written by the scoring service after each authoritative mutation.

## APIs

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/statistics/summary?range=` | Leaderboards + team records |
| GET | `/api/statistics/players/:id?range=` | Career batting/bowling + recent form |
| GET | `/api/statistics/players/:id/matches` | Paginated player match history |
| GET | `/api/statistics/teams/:id?range=` | Team record + recent matches |
| GET | `/api/dashboard/summary` | Metrics, lists, top performers |
| GET | `/api/matches?search&status&teamId&dateFrom&dateTo` | Match history filters |
| GET | `/api/search?q=` | Categorized global search (rate-limited) |

`range`: `ALL_TIME` \| `THIS_MONTH` \| `THIS_YEAR` (filters on `completedAt`).

## Aggregation strategy

1. Load up to **500** completed matches for the authenticated owner (`createdBy`), newest first.
2. Walk each innings’ batter/bowler maps.
3. Compute averages, SR, economy, 50s/100s, highest score, best bowling.
4. Enrich with Player/Team names in a second query.

Authorization: non-ADMIN users only see their own matches/players/teams (same owner filter as the rest of the API).

## Indexes

| Index | Why |
|-------|-----|
| `{ createdBy, status, completedAt }` | Match history + stats range scans |
| Existing `{ createdBy, status, updatedAt }` | List/dashboard |
| Existing Delivery sequence indexes | Scoring engine (not Phase 9 stats path) |

## Caching

- Client: TanStack Query `staleTime` ~60s on statistics summary.
- Live scoring state: **not** aggressively cached (Phase 6/7 rules).
- Invalidate statistics/dashboard queries when matches complete (client invalidation on known flows; soft stale window otherwise).

## Historical data / lifecycle

- Soft-deactivate players/teams — historical scorecards keep embedded XI names and snapshot figures.
- Completed matches are not hard-deleted; only DRAFT/CANCELLED may be deleted.
- Corrections retain Phase 5 audit fields; stats read the latest snapshot.

## Known limitations

1. Sample capped at 500 completed matches per request.
2. Snapshot-based (not live Delivery rebuild) — correct after sync; offline-pending matches do not affect career stats until synchronized and completed.
3. Owner-centric “wins” on the dashboard sum team wins in the sample (typical when the scorer owns both sides).
4. No tournament / NRR / points table (Phase 10).
