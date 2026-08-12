# Phase 9 — Real-world feedback

Prioritized issues from Phases 6–8 usage, docs, and code review. Fix **P0/P1** before cosmetic work.

## P0 — blocks real match usage

| ID | Issue | Notes |
|----|--------|------|
| P0-1 | Offline queue + strike rotation / version recovery | Addressed in Phase 8; keep regression-tested. |
| P0-2 | Accidental wide vs no-ball | Scorer feedback: extras sheets must stay fast and unmistakable; keypad must not feel “stuck submitting”. |
| P0-3 | Lost confidence after network blip | Offline banner + pending count must remain obvious (Phase 8). |

## P1 — major usability

| ID | Issue | Plan |
|----|--------|------|
| P1-1 | Match history hard to scan | List shows status but not scores; no search UI despite API support. |
| P1-2 | Dashboard cards not clickable | Live / upcoming / recent rows should open match detail. |
| P1-3 | Player “Matches” tab empty | Career match history stub — blocks “how did I bat last week?” |
| P1-4 | Team “Matches” tab stub | Still says Phase 4; no team W/L on team page. |
| P1-5 | Career stats incomplete | Snapshot sample capped (40/80 matches); missing 50s/100s/best/HS. |
| P1-6 | No team statistics API | Only summary table on `/statistics`. |
| P1-7 | WhatsApp / share for completed matches | Live share exists; completed scorecard share/print weak. |
| P1-8 | Mobile scorer density | Large sheets / bowler pick can obscure keypad (watch during polish). |

## P2 — important improvements

| ID | Issue | Plan |
|----|--------|------|
| P2-1 | Leaderboards: only top runs/wickets | Add SR / economy / range filters (month/year). |
| P2-2 | Match filters: date range / team | Extend list API + UI. |
| P2-3 | Dashboard “wins” / top performers | Metrics beyond raw counts. |
| P2-4 | Printable scorecard | `@media print` + Print action. |
| P2-5 | Empty / error polish | Consistent empty states on history & stats. |
| P2-6 | Global search | Categorized matches / teams / players. |

## P3 — nice-to-have

| ID | Issue |
|----|--------|
| P3-1 | Sparkline recent form |
| P3-2 | Soft-archive completed matches |
| P3-3 | PWA app shell for offline reload |
| P3-4 | Delivery-level career rebuild (vs snapshots) for very large histories |

## Scorer / product quotes (from Phase 9 brief)

- “I accidentally pressed wide instead of no-ball.” → keep extras clear; undo/edit remain first-class.
- “Players want to see their individual statistics.” → player profile + leaderboards.
- “The captain wants the score link on WhatsApp.” → copy/share live + completed scorecard links.

## Priority order for this phase

1. Match history UX (scores, search, filters, cards)
2. Player career stats + match history
3. Team stats + matches
4. Dashboard analytics + top performers
5. Leaderboards polish
6. Scorecard share/print
7. Empty/error/a11y polish
8. Docs + tests + E2E
