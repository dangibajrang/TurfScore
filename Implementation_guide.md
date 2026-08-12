MASTER CURSOR PROMPT — TURFSCORE

You are a senior product engineer, UI/UX designer, frontend architect, backend architect, database designer, and cricket scoring-system expert.

Build a production-quality full-stack application called:

                         TURFSCORE
              LIVE CRICKET SCORING MADE SIMPLE

The attached reference image is the PRIMARY visual design reference.

IMPORTANT:
The final application should closely reproduce the visual language, layout, spacing, colors, typography, component hierarchy, responsiveness, and overall premium feel of the reference image.

Do NOT merely create a static UI mockup.

Build a REAL, FUNCTIONAL MERN application.

==================================================
1. PRODUCT VISION
==================================================

TurfScore solves a real problem faced while playing cricket at local turfs.

When people play cricket, they currently struggle with:

- remembering runs
- tracking every delivery
- wickets
- overs
- extras
- batsman statistics
- bowler statistics
- partnerships
- fall of wickets
- target
- required run rate
- match result
- player history
- team history
- tournament standings

TurfScore should make live cricket scoring extremely fast and simple.

The scorer should be able to operate the application while standing beside the cricket ground, mostly using one hand.

The application must work beautifully on:

- mobile
- tablet
- desktop

The primary scoring experience should be optimized for mobile/tablet.

==================================================
2. TECH STACK
==================================================

Use:

FRONTEND:
- React
- Vite
- TypeScript
- React Router
- Tailwind CSS
- TanStack Query
- Zustand where appropriate
- React Hook Form
- Zod
- Lucide React
- Recharts where charts are required

BACKEND:
- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- JWT authentication
- bcrypt/argon2 according to best practice
- Socket.IO for realtime scoring

INFRASTRUCTURE:
- Render deployment
- MongoDB Atlas
- environment variables
- production logging
- health checks

TESTING:
- Vitest/Jest
- React Testing Library
- Supertest
- Playwright

Do NOT introduce unnecessary technologies.

Do NOT convert this into Next.js.

Do NOT use Firebase.

Do NOT use Supabase.

Do NOT use PostgreSQL.

This project is intentionally MERN.

==================================================
3. REFERENCE IMAGE — DESIGN REQUIREMENTS
==================================================

Use the attached image as the visual source of truth.

The reference has:

- dark premium sports dashboard
- black/navy background
- deep green accents
- bright TurfScore green
- subtle gradients only where appropriate
- rounded cards
- thin borders
- soft shadows
- compact information density
- excellent spacing
- professional sports-tech appearance
- mobile-first scoring UI
- responsive desktop dashboard
- large score numbers
- clear visual hierarchy

Primary visual identity:

GREEN + DARK NAVY/BLACK

Use approximately:

Background:
#06151A / similar deep dark navy

Primary:
#35D05F / TurfScore green

Secondary:
dark green

Text:
white / off-white

Muted:
gray-green

Danger:
red

Wicket:
red

Wide:
purple

No-ball:
orange

Bye:
blue

Leg-bye:
blue

IMPORTANT:
Do not use excessive gradients.

Do not make the application look like a generic Tailwind dashboard.

Do not make every component a giant card.

Do not use excessive glassmorphism.

The application should feel like:

"premium cricket technology product"

rather than:

"template dashboard".

==================================================
4. BRAND
==================================================

Brand:

TurfScore

Tagline:

LIVE CRICKET SCORING MADE SIMPLE

Logo concept:

Cricket bat + cricket ball + subtle turf/green circular element.

If no actual logo asset exists:

Create a clean temporary SVG/CSS logo.

Do not use random external logos.

Create:

/client/src/assets/branding/

and keep branding assets organized.

==================================================
5. APPLICATION STRUCTURE
==================================================

Create:

/client
/server

Frontend:

client/
  src/
    components/
    features/
      auth/
      dashboard/
      matches/
      scoring/
      teams/
      players/
      statistics/
      tournaments/
      settings/
    pages/
    layouts/
    hooks/
    lib/
    stores/
    services/
    types/
    assets/

Backend:

server/
  src/
    config/
    controllers/
    routes/
    models/
    services/
    middleware/
    validators/
    sockets/
    utils/
    jobs/
    types/

Keep business logic out of React components.

Keep controllers thin.

Put cricket calculations inside dedicated services.

==================================================
6. CORE USER JOURNEY
==================================================

The primary user journey:

Register/Login
        ↓
Dashboard
        ↓
Create Team
        ↓
Add Players
        ↓
Create Match
        ↓
Select Teams
        ↓
Select Overs
        ↓
Select Venue
        ↓
Select Playing XI
        ↓
Toss
        ↓
Start Match
        ↓
LIVE SCORING
        ↓
Complete Innings
        ↓
Second Innings
        ↓
Match Result
        ↓
Professional Scorecard
        ↓
Player Statistics
        ↓
Match History

Every step must actually work.

==================================================
7. AUTHENTICATION
==================================================

Implement:

- Register
- Login
- Logout
- Current user
- Protected routes
- Refresh/session strategy appropriate for the architecture
- Password hashing
- validation
- error handling

User fields:

- name
- email
- phone optional
- profile image optional
- createdAt
- updatedAt

Roles:

USER
ADMIN

Design authorization so it can later support:

ORGANIZATION_ADMIN
SCORER
COACH

without rewriting the architecture.

==================================================
8. DASHBOARD
==================================================

Desktop dashboard should closely resemble the lower-left dashboard in the reference image.

Sidebar:

- Dashboard
- Matches
- Teams
- Players
- Statistics
- Live Matches
- Settings

Bottom:

User avatar
User name
View Profile

Main dashboard:

Top metric cards:

- Live Matches
- Completed Matches
- Teams
- Players

Main content:

LIVE MATCHES

Show:

RCC vs Warriors
128/4
8.2 overs

Opponent score:

127/8
10 overs

Status:

LIVE

Show required runs.

UPCOMING MATCHES

Show:

Teams
Date
Time
Venue

RECENT MATCHES

Show:

teams
result
date

TOP PERFORMERS

Show:

player
runs/wickets

CALENDAR

Small monthly calendar like the reference.

==================================================
9. MOBILE HOME
==================================================

Mobile UI should closely resemble the reference phone dashboard.

Top:

TurfScore logo

Greeting:

Hi, Arjun

CTA:

+ Create Match

Sections:

Live Matches
Upcoming Matches
Recent Matches

Bottom navigation:

Home
Matches
Teams
Players
More

Use a compact mobile-first design.

==================================================
10. CREATE MATCH
==================================================

Create a multi-step flow.

Step 1:

Match Name

Team A

Team B

Overs

Venue

Date

Time

Step 2:

Select Playing XI

Team A players

Team B players

Step 3:

Toss

Who won toss?

Bat / Bowl

Step 4:

Confirm match

Show summary.

Start Match button.

Validation must prevent impossible configurations.

==================================================
11. MATCH MODEL
==================================================

Design a robust MongoDB schema.

Match should contain:

- name
- teamA
- teamB
- venue
- overs
- matchType
- date
- toss
- innings
- currentInnings
- status
- winner
- result
- createdBy
- timestamps

Statuses:

DRAFT
UPCOMING
LIVE
COMPLETED
ABANDONED
CANCELLED

Do not store everything redundantly.

==================================================
12. CRICKET SCORING ENGINE
==================================================

This is the MOST IMPORTANT part of the application.

Create a dedicated scoring engine.

Do NOT put cricket calculations directly inside React components.

Create something like:

server/src/services/cricket/

ScoringEngine
InningsEngine
OverEngine
PlayerStatsEngine
MatchResultEngine

The engine must support:

0
1
2
3
4
5
6

WIDE

NO BALL

BYE

LEG BYE

WICKET

WICKET + RUNS

MULTIPLE RUNS

==================================================
13. DELIVERY MODEL
==================================================

Each delivery should contain enough information to reconstruct the innings.

Example:

deliveryNumber
overNumber
ballNumber
batter
nonStriker
bowler

runs:

batterRuns
extrasRuns
totalRuns

extras:

wide
noBall
bye
legBye

wicket:

isWicket
wicketType
playerOut
fielder

timestamp

eventId

createdBy

Do not design the system in a way that makes score reconstruction impossible.

==================================================
14. CRICKET RULE ENGINE
==================================================

Implement correct handling for:

LEGAL BALL

WIDE

NO BALL

BYE

LEG BYE

WICKET

BOUNDARY

MULTIPLE RUNS

OVER COMPLETION

INNINGS COMPLETION

TARGET

REQUIRED RUN RATE

MATCH COMPLETION

Important:

Wide and no-ball must NOT incorrectly increment legal-ball count.

Byes and leg-byes count as legal deliveries unless another supported rule changes this.

No-ball + wicket must be handled correctly.

No-ball + runs must be handled correctly.

Wide + wicket should be handled according to supported cricket rules.

Do not assume every wicket means the delivery is legal.

Create unit tests for these cases.

==================================================
15. SCORING SCREEN
==================================================

The live scoring screen must closely match the reference image.

Header:

Back
RCC vs Warriors
LIVE badge
10 Overs Match

Main score:

RCC
127/8
10.0 Overs

vs

Warriors
128/4
8.2 Overs

Show:

Run Rate
Required Run Rate
Target
Current Partnership

Current batsmen:

Rahul 45 (23)

Sahil 12 (8)

Current bowler:

Amit

1.2 - 0 - 12 - 1

Current over:

1
4
0
W
2
6
0

Recent balls sidebar on desktop.

Partnership section.

Required runs section.

==================================================
16. SCORING BUTTONS
==================================================

Make scoring extremely fast.

Primary buttons:

0
1
2
3
4
6

WICKET

Secondary:

WIDE
NO BALL
BYE
LEG BYE

UNDO

The scorer must be able to score a ball with minimal interaction.

Buttons should be large enough for touch screens.

==================================================
17. WICKET FLOW
==================================================

Click WICKET.

Open modal/bottom sheet:

Dismissed Player

Wicket Type:

Bowled
Caught
LBW
Run Out
Stumped
Hit Wicket
Retired Hurt
Other

If caught:

Select fielder.

If run out:

Select player out.

Then select replacement batsman.

Validate batting order.

==================================================
18. EXTRAS FLOW
==================================================

WIDE:

Ask number of wides if needed.

NO BALL:

Allow:

No-ball + bat runs

No-ball + extra runs

No-ball + wicket

BYE:

Select bye runs.

LEG BYE:

Select leg-bye runs.

Every action must update:

team score
batter score
bowler figures
extras
overs
partnership
required runs

correctly.

==================================================
19. UNDO
==================================================

UNDO must be safe.

When clicked:

Show last delivery.

Example:

Undo 6 — Over 8.2

Allow confirmation.

After undo:

recalculate the affected state.

Do NOT manually subtract random values.

Prefer rebuilding affected state from delivery history or use a deterministic reversible command system.

==================================================
20. EDIT DELIVERY
==================================================

After scoring, authorized scorer can edit a delivery.

Example:

8.2

6 → 4

Recalculate:

score
batter
bowler
overs
partnership
statistics
result

Show audit information.

==================================================
21. SCORECARD
==================================================

Create professional scorecard similar to reference.

Tabs:

Team A
Team B

Batting:

Player
R
B
4s
6s
SR

Bowling:

Bowler
O
M
R
W
Econ

Extras

Total

Fall of wickets

Partnerships

Over summary

Use responsive tables.

On mobile, intelligently transform tables rather than creating unusable horizontal layouts.

==================================================
22. PLAYER PROFILE
==================================================

Create player profile matching the reference.

Header:

Profile image
Rahul Sharma
Right Hand Batsman

Tabs:

Overview
Batting
Bowling
Matches

Career Statistics:

Matches
Runs
Average
Strike Rate
50s
100s
Best
4s
6s
Wickets
Best Bowling
Economy

Use charts where useful.

==================================================
23. TEAMS
==================================================

Team features:

Create team
Edit team
Logo
Description
Players
Captain
Vice Captain

Team page:

Team overview
Players
Matches
Statistics
Tournaments

==================================================
24. PLAYERS
==================================================

Player features:

Create
Edit
Search
Filter

Fields:

name
profile image
role

roles:

BATTER
BOWLER
ALL_ROUNDER
WICKET_KEEPER

Batting style:

RIGHT_HAND
LEFT_HAND

Bowling style:

RIGHT_ARM_FAST
RIGHT_ARM_MEDIUM
RIGHT_ARM_SPIN
LEFT_ARM_FAST
LEFT_ARM_MEDIUM
LEFT_ARM_SPIN

==================================================
25. MATCH HISTORY
==================================================

Create:

/matches

Filters:

Live
Upcoming
Completed

Search:

team
player
match name

Match card:

Teams
Scores
Result
Date
Venue

==================================================
26. STATISTICS
==================================================

Player leaderboard:

Most Runs
Most Wickets
Best Strike Rate
Best Average
Most Sixes
Most Fours

Bowling:

Most Wickets
Best Economy
Best Bowling
Best Average

Team:

Wins
Losses
Win %

==================================================
27. REALTIME SCORING
==================================================

Use Socket.IO.

When scorer records:

1 run

all connected viewers should see the updated score immediately.

Events:

MATCH_STARTED
DELIVERY_RECORDED
DELIVERY_UPDATED
DELIVERY_UNDONE
WICKET
OVER_COMPLETED
INNINGS_COMPLETED
MATCH_COMPLETED

Do not send entire massive objects unnecessarily.

Use efficient event payloads.

==================================================
28. LIVE VIEWER
==================================================

Anyone authorized to view a live match can see:

Score
Overs
Current batsmen
Current bowler
Recent balls
Partnership
Required runs

Viewer should NOT see scorer controls.

==================================================
29. OFFLINE-FIRST SCORING
==================================================

This is critical.

If scorer loses internet:

The scorer should continue scoring.

Store pending delivery events locally using IndexedDB.

When connection returns:

Synchronize pending events.

Show:

OFFLINE

SYNCING

SYNCED

SYNC ERROR

Do not lose scores.

Prevent duplicate event submission using eventId/idempotency keys.

==================================================
30. CONNECTION RECOVERY
==================================================

If connection drops:

Show:

Connection lost.
Scores are being saved on this device.

When connection returns:

Syncing...

Then:

All scores synced.

==================================================
31. MATCH RECOVERY
==================================================

If scorer closes the browser during a match:

On reopening:

Active match found.

RCC vs Warriors

8.2 overs

[Resume Match]

Do not silently discard local state.

==================================================
32. TOURNAMENTS
==================================================

Implement:

Create tournament
Teams
Fixtures
Points table
Leaderboard
Knockout
League
Final

Tournament types:

LEAGUE
KNOCKOUT
LEAGUE_PLUS_KNOCKOUT

Points table:

Played
Won
Lost
NR
Points
NRR

==================================================
33. TOURNAMENT UI
==================================================

Tournament page:

Header
Logo
Status
Teams

Tabs:

Overview
Matches
Points Table
Leaderboard
Teams
Statistics

Use premium sports UI.

==================================================
34. RESPONSIVE DESIGN
==================================================

Desktop:

Persistent sidebar.

Tablet:

Compact sidebar.

Mobile:

Bottom navigation.

Scoring screen:

Mobile:
Full-screen scoring experience.

Desktop:
Three-column layout:

LEFT:
Current match / batsmen

CENTER:
Scoring controls

RIGHT:
Recent balls / partnership / required runs

==================================================
35. MOBILE DESIGN
==================================================

The mobile UI must look close to the top phones in the reference image.

Use:

- large touch targets
- compact cards
- fixed scoring controls where appropriate
- clear hierarchy
- no tiny buttons
- no desktop tables squeezed onto mobile

Minimum touch target:

44px.

==================================================
36. DESKTOP DESIGN
==================================================

The desktop dashboard should resemble the lower part of the reference image.

Layout:

Sidebar
Main content
Optional right-side widgets

Use 12-column grid where appropriate.

==================================================
37. NAVIGATION
==================================================

Desktop:

Dashboard
Matches
Teams
Players
Statistics
Live Matches
Settings

Future-ready sections:

Tournaments
Academy
Community
Marketplace
Bookings
Analytics

Only display modules that are actually implemented.

==================================================
38. LOADING STATES
==================================================

Every async screen must have:

Skeleton
Loading state
Empty state
Error state
Retry

Never leave blank screens.

==================================================
39. ERROR HANDLING
==================================================

Backend standardized response:

{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "..."
  }
}

Frontend should show friendly messages.

Never expose stack traces.

==================================================
40. VALIDATION
==================================================

Use Zod on frontend.

Use validation middleware on backend.

Validate:

- email
- passwords
- player names
- match settings
- overs
- teams
- players
- scoring events

==================================================
41. AUTHORIZATION
==================================================

Users can modify only resources they are authorized to modify.

Prevent IDOR.

Never trust:

req.params.id

without authorization checks.

==================================================
42. DATABASE INDEXING
==================================================

Create appropriate indexes for:

users.email
matches.createdBy
matches.status
matches.date
deliveries.matchId
players.name
teams.name

Only add indexes based on actual query requirements.

==================================================
43. API DESIGN
==================================================

REST API.

Examples:

POST /api/auth/register
POST /api/auth/login
GET /api/auth/me

GET /api/matches
POST /api/matches
GET /api/matches/:id
PATCH /api/matches/:id

POST /api/matches/:id/start
POST /api/matches/:id/deliveries
POST /api/matches/:id/undo
PATCH /api/matches/:id/deliveries/:deliveryId
POST /api/matches/:id/complete

GET /api/players
POST /api/players

GET /api/teams
POST /api/teams

GET /api/statistics

GET /api/tournaments
POST /api/tournaments

Keep API structure consistent.

==================================================
44. SECURITY
==================================================

Implement:

- password hashing
- JWT/session security
- Helmet
- CORS
- rate limiting
- request validation
- secure cookies where architecture permits
- NoSQL injection protection
- XSS protection
- safe file upload
- environment variables

Never commit secrets.

==================================================
45. PERFORMANCE
==================================================

Optimize:

- React rendering
- API calls
- database queries
- indexes
- pagination
- Socket.IO payloads
- image loading

Use React.memo only when justified.

Avoid premature optimization.

==================================================
46. ACCESSIBILITY
==================================================

Support:

- keyboard navigation
- focus states
- semantic HTML
- accessible dialogs
- accessible buttons
- readable contrast
- screen-reader labels

Do not sacrifice accessibility for visual similarity.

==================================================
47. EMPTY STATES
==================================================

Examples:

No matches yet.

Create your first match.

No teams yet.

Create your first team.

No players yet.

Add players to your team.

Make these visually polished.

==================================================
48. DASHBOARD QUICK ACTIONS
==================================================

Create:

+ Create Match

Create Team

Add Player

View Live Matches

View Statistics

On mobile, make Create Match extremely prominent.

==================================================
49. NOTIFICATIONS
==================================================

Basic notification infrastructure.

Possible events:

Match starting
Match completed
Tournament fixture
Player achievement

Keep architecture extensible.

==================================================
50. SHARE SCORECARD
==================================================

After completed match:

Share Scorecard.

Generate a public shareable route:

/scorecard/:matchId

Public scorecard should show:

teams
score
winner
batting
bowling
result

No private user information.

==================================================
51. PUBLIC MATCH VIEW
==================================================

Create beautiful public scorecard.

It should be shareable through:

WhatsApp
social media
copy link

Use Open Graph metadata if architecture permits.

==================================================
52. DARK THEME
==================================================

The reference is primarily dark.

Make dark mode the primary experience.

If light mode is implemented:

Do NOT simply invert colors.

Create a proper light theme.

==================================================
53. MICRO INTERACTIONS
==================================================

Use subtle animation for:

score changes
wicket
boundary
match completion
tab transitions
loading

Do NOT over-animate.

A six can have a subtle celebration.

A wicket can have a subtle red pulse.

==================================================
54. SCORE ANIMATION
==================================================

When score changes:

Animate the number slightly.

Example:

127 → 133

Do not use huge distracting animations.

==================================================
55. WICKET UI
==================================================

When wicket happens:

Show:

WICKET

Player name

Wicket type

Bowler

Optional subtle animation.

==================================================
56. BOUNDARY UI
==================================================

For 4:

FOUR

For 6:

SIX

Use subtle visual feedback.

==================================================
57. MATCH COMPLETION
==================================================

Show:

WINNER

RCC won by 6 wickets.

Then:

View Scorecard

Share Scorecard

View Player Stats

==================================================
58. CRICKET DATA CONSISTENCY
==================================================

The score must be derived from deliveries.

Do NOT independently mutate:

score
batter runs
bowler runs

in unrelated places.

Create one authoritative scoring calculation layer.

Whenever practical:

deliveries → innings state → scorecard → statistics

==================================================
59. SCORE RECONSTRUCTION
==================================================

Implement a mechanism to reconstruct an innings from delivery history.

This will be used for:

undo
edit
recovery
validation
analytics

==================================================
60. TESTING
==================================================

Write tests for cricket engine.

Minimum tests:

0
1
2
3
4
6

wide

no ball

bye

leg bye

wicket

run-out

caught

bowled

stumped

over completion

innings completion

target chase

match completion

undo

delivery edit

duplicate delivery

offline sync

reconnection

==================================================
61. E2E TESTS
==================================================

Create Playwright tests:

Register

Login

Create Team

Add Players

Create Match

Start Match

Score deliveries

Wicket

Undo

Complete innings

Complete match

View scorecard

View player statistics

==================================================
62. SEED DATA
==================================================

Create development seed:

Users
Teams
Players
Matches

Example:

RCC

Warriors

Titans

Challengers

Rahul Sharma

Amit Verma

Rohit Singh

etc.

Create realistic cricket data.

==================================================
63. API DOCUMENTATION
==================================================

Create:

/docs/API.md

Document endpoints.

==================================================
64. README
==================================================

Create professional README.

Include:

Product overview

Screenshots placeholder

Features

Architecture

Tech stack

Local setup

Environment variables

Run frontend

Run backend

Testing

Deployment

Render deployment

MongoDB Atlas setup

==================================================
65. ENVIRONMENT VARIABLES
==================================================

Create:

.env.example

Example:

MONGODB_URI=
JWT_SECRET=
CLIENT_URL=
SERVER_URL=
NODE_ENV=
PORT=

Do not put real secrets.

==================================================
66. RENDER DEPLOYMENT
==================================================

Prepare for Render.

Frontend:

Build:

npm run build

Serve appropriately.

Backend:

npm run start

Create health endpoint:

GET /health

Response:

{
  "status": "ok"
}

Ensure CORS supports production frontend URL.

==================================================
67. CODE QUALITY
==================================================

Use:

TypeScript strict mode.

Avoid:

any

unless genuinely required.

Avoid:

huge components

duplicate logic

magic strings

hardcoded API URLs

business logic inside UI components.

==================================================
68. COMPONENT DESIGN SYSTEM
==================================================

Create reusable components:

Button
Card
Badge
Modal
Drawer
Input
Select
Avatar
Tabs
Table
Skeleton
EmptyState
Toast
ConfirmDialog

Create cricket components:

ScoreCard
ScoreBoard
BallButton
OverSummary
PlayerRow
BowlerRow
PartnershipCard
RecentBalls
RunRateCard
RequiredRunsCard
WicketDialog

==================================================
69. UI FILE ORGANIZATION
==================================================

Prefer:

features/scoring/components/

over:

components/Everything.tsx

Keep components small.

==================================================
70. DESIGN TOKENS
==================================================

Create central theme tokens.

Example:

--background
--surface
--surface-elevated
--border
--primary
--primary-hover
--text
--text-muted
--danger
--warning
--info

Use them consistently.

==================================================
71. REFERENCE IMAGE MATCHING
==================================================

Use the attached reference image continuously while implementing.

Compare:

- spacing
- card radius
- sidebar width
- typography
- button size
- color
- score hierarchy
- mobile layout
- desktop layout

Do not simply copy the screenshot as an image.

Recreate it using real HTML/CSS/React components.

The UI should look like the same product shown in the reference.

==================================================
72. RESPONSIVE BREAKPOINTS
==================================================

At minimum test:

320px
375px
390px
430px
768px
1024px
1280px
1440px

No horizontal overflow.

==================================================
73. MOBILE SCORING PRIORITY
==================================================

Most important screen:

LIVE SCORING

It must be usable:

- outdoors
- in bright light
- with one hand
- quickly
- repeatedly
- under pressure

Buttons must be visually distinct.

==================================================
74. DESKTOP SCORING
==================================================

Desktop should support:

scorer

and

live audience/viewer

simultaneously.

Scorer controls on main area.

Recent balls and match context on right.

==================================================
75. CRICKET EDGE CASES
==================================================

Handle:

- last ball of over
- last legal ball despite wides/no-balls
- innings ends on wicket
- innings ends on target reached
- all-out
- retirement
- no-ball wicket
- run-out on no-ball
- wide + wicket according to supported rules
- byes
- leg-byes
- striker/non-striker changes
- batsman rotation
- odd runs
- boundaries
- match tied
- abandoned match
- incomplete innings
- manual correction

If a rule is ambiguous:

Make it explicit in the domain model and UI.

==================================================
76. DO NOT FAKE FUNCTIONALITY
==================================================

Do not create buttons that do nothing.

Every visible action should either:

- work
- be intentionally disabled with an explanation
- or not exist yet

No fake charts.

No fake backend responses.

No hardcoded score updates.

No simulated authentication.

No mock-only scoring engine.

==================================================
77. IMPLEMENTATION STRATEGY
==================================================

Do NOT attempt to write thousands of files blindly.

First:

1. Inspect repository.
2. Identify existing code.
3. Create architecture.
4. Build database models.
5. Build backend APIs.
6. Build scoring engine.
7. Build frontend design system.
8. Build authentication.
9. Build dashboard.
10. Build teams/players.
11. Build match creation.
12. Build scoring.
13. Build scorecard.
14. Build statistics.
15. Build realtime.
16. Build offline sync.
17. Build tournaments.
18. Build tests.
19. Polish UI.
20. Prepare Render deployment.

If the repository already contains working code:

PRESERVE IT.

Do not rewrite working features unnecessarily.

==================================================
78. DEVELOPMENT RULE
==================================================

After every major module:

Run:

npm run build

Run tests.

Fix errors before moving forward.

Do not accumulate hundreds of TypeScript errors.

==================================================
79. FINAL QUALITY BAR
==================================================

The application should feel comparable to a polished commercial sports application.

A user should be able to:

1. Register
2. Create a team
3. Add players
4. Create a 10-over match
5. Select playing XI
6. Conduct toss
7. Start match
8. Score every delivery
9. Record wides
10. Record no-balls
11. Record byes
12. Record leg-byes
13. Record wickets
14. Undo a delivery
15. Edit a delivery
16. Complete innings
17. Complete match
18. View scorecard
19. View player statistics
20. View match history
21. Share scorecard
22. View live match from another device

Everything must work end-to-end.

==================================================
80. FINAL VISUAL TARGET
==================================================

The final UI should visually communicate:

                 TURFSCORE

        LIVE CRICKET SCORING MADE SIMPLE

Dark premium cricket interface.

Green primary accent.

Professional dashboard.

Beautiful mobile scoring.

Professional scorecards.

Clear player statistics.

Fast scoring controls.

Realtime live matches.

Offline-first scoring.

Responsive design.

The result should look like a real startup product, not a coding tutorial.

==================================================
81. IMPORTANT CURSOR AGENT BEHAVIOR
==================================================

Before writing code:

Inspect the repository.

Then create:

/docs/IMPLEMENTATION_PLAN.md

with:

Architecture
Database schema
API structure
Frontend structure
Scoring engine design
Realtime architecture
Offline architecture
Testing strategy
Deployment strategy

Then implement.

If something already exists, improve it rather than replacing it.

When you encounter an architectural decision, prefer:

simplicity
correctness
maintainability
testability
production reliability

over unnecessary complexity.

==================================================
82. FINAL OUTPUT
==================================================

At the end provide:

1. What was implemented
2. Files created
3. Files modified
4. Database models
5. API endpoints
6. Cricket scoring rules implemented
7. Realtime implementation
8. Offline implementation
9. Authentication
10. Tests created
11. Tests executed
12. Build result
13. Known limitations
14. Environment variables required
15. Render deployment instructions
16. Suggested next improvements

IMPORTANT:

Do not claim something is implemented if it is not.

Do not claim tests passed unless you actually ran them.

Do not claim deployment succeeded unless you actually verified it.

==================================================

START NOW.

First inspect the repository and the attached reference image.

Then create the implementation plan.

Then begin implementation in dependency order.

Build a REAL TurfScore application, not a mockup.