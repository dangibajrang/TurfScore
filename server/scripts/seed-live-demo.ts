/**
 * Seeds a ready-to-score LIVE match for manual realtime testing.
 *
 * Usage:
 *   npx tsx scripts/seed-live-demo.ts
 *
 * Env overrides (optional):
 *   DEMO_EMAIL / DEMO_PASSWORD
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadEnv, resetEnvCache } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { Match } from '../src/models/Match.js';
import { Player } from '../src/models/Player.js';
import { Team } from '../src/models/Team.js';
import { TeamMembership } from '../src/models/TeamMembership.js';
import { User } from '../src/models/User.js';
import type { AuthContext } from '../src/middleware/auth.js';
import { createAndStartMatch } from '../src/services/matchService.js';
import {
  enableLiveSharing,
  getLiveSharing,
} from '../src/services/liveSharingService.js';
import {
  recordDelivery,
  selectBowler,
  setOpenings,
} from '../src/services/scoringService.js';

const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'bajrangdangi937@gmail.com').toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Bajrang@9754';
const MATCH_NAME = 'Demo Live — RCC vs Warriors';

const teamANames = [
  'Rahul Sharma',
  'Sahil Khan',
  'Vikram Patel',
  'Arjun Mehta',
  'Karan Das',
  'Dev Malhotra',
];
const teamBNames = [
  'Amit Verma',
  'Rohit Singh',
  'Nikhil Rao',
  'Imran Ali',
  'Suresh Nair',
  'Farhan Qureshi',
];

async function upsertTeamWithPlayers(
  ownerId: string,
  teamName: string,
  shortName: string,
  playerNames: string[],
) {
  const team = await Team.findOneAndUpdate(
    { name: teamName, createdBy: ownerId },
    {
      name: teamName,
      shortName,
      city: 'Local Turf',
      createdBy: ownerId,
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const players = [];
  for (const name of playerNames) {
    const player = await Player.findOneAndUpdate(
      { name, createdBy: ownerId },
      {
        name,
        role: 'ALL_ROUNDER',
        battingStyle: 'RIGHT_HAND',
        bowlingStyle: 'RIGHT_ARM_MEDIUM',
        teamId: team._id,
        createdBy: ownerId,
        isActive: true,
        status: 'ACTIVE',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    players.push(player);
    await TeamMembership.findOneAndUpdate(
      { teamId: team._id, playerId: player._id, status: 'ACTIVE' },
      {
        teamId: team._id,
        playerId: player._id,
        status: 'ACTIVE',
        joinedAt: new Date(),
        createdBy: ownerId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  team.playerIds = players.map((p) => p._id);
  team.captainId = players[0]!._id;
  await team.save();

  return { team, players };
}

async function main() {
  resetEnvCache();
  const env = loadEnv();
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo data in production');
  }

  await connectDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await User.findOneAndUpdate(
    { email: DEMO_EMAIL },
    {
      name: 'Bajrang Dangi',
      email: DEMO_EMAIL,
      passwordHash,
      role: 'USER',
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const ownerId = String(user._id);
  const auth: AuthContext = { id: ownerId, role: 'USER' };

  // Remove previous demo match so re-seed is clean
  const existing = await Match.findOne({ name: MATCH_NAME, createdBy: user._id });
  if (existing) {
    await Match.deleteOne({ _id: existing._id });
  }

  const { team: rcc, players: rccPlayers } = await upsertTeamWithPlayers(
    ownerId,
    'RCC',
    'RCC',
    teamANames,
  );
  const { team: warriors, players: warPlayers } = await upsertTeamWithPlayers(
    ownerId,
    'Warriors',
    'WAR',
    teamBNames,
  );

  const xiA = rccPlayers.map((p, i) => ({
    playerId: String(p._id),
    battingOrder: i + 1,
    isCaptain: i === 0,
    isWicketKeeper: i === 1,
  }));
  const xiB = warPlayers.map((p, i) => ({
    playerId: String(p._id),
    battingOrder: i + 1,
    isCaptain: i === 0,
    isWicketKeeper: i === 1,
  }));

  const match = await createAndStartMatch(auth, {
    name: MATCH_NAME,
    venue: 'Turf Arena — Demo',
    scheduledAt: new Date().toISOString(),
    teamA: { teamId: String(rcc._id), playingXi: xiA },
    teamB: { teamId: String(warriors._id), playingXi: xiB },
    rules: {
      overs: 5,
      ballsPerOver: 6,
      playersPerSide: 6,
      maxOversPerBowler: 2,
      powerplayEnabled: false,
      superOverEnabled: false,
    },
    toss: {
      wonByTeamId: String(rcc._id),
      decision: 'BAT',
    },
  });

  let version = match.version;
  await setOpenings(auth, match.id, {
    expectedVersion: version,
    strikerId: String(rccPlayers[0]!._id),
    nonStrikerId: String(rccPlayers[1]!._id),
  });
  version += 1;

  await selectBowler(auth, match.id, {
    expectedVersion: version,
    bowlerId: String(warPlayers[0]!._id),
  });
  version += 1;

  // Seed a few deliveries so the scoreboard is not empty
  const seedBalls: Array<{ batterRuns: number; wide?: number }> = [
    { batterRuns: 1 },
    { batterRuns: 4 },
    { batterRuns: 0 },
    { batterRuns: 6 },
    { batterRuns: 0, wide: 1 },
    { batterRuns: 2 },
  ];

  let strikerId = String(rccPlayers[0]!._id);
  let nonStrikerId = String(rccPlayers[1]!._id);
  const bowlerId = String(warPlayers[0]!._id);
  let totalRuns = 0;

  for (const ball of seedBalls) {
    const res = await recordDelivery(auth, match.id, {
      expectedVersion: version,
      eventId: randomUUID(),
      batterId: strikerId,
      nonStrikerId,
      bowlerId,
      batterRuns: ball.batterRuns,
      extras: ball.wide ? { wide: ball.wide } : undefined,
    });
    version = res.matchVersion;
    totalRuns =
      res.state.innings[res.state.currentInningsIndex]?.totalRuns ?? totalRuns;
    const inn = res.state.innings[res.state.currentInningsIndex];
    if (inn?.strikerId) strikerId = inn.strikerId;
    if (inn?.nonStrikerId) nonStrikerId = inn.nonStrikerId;
  }

  await enableLiveSharing(auth, match.id);
  const sharing = await getLiveSharing(auth, match.id);

  const clientUrl = env.CLIENT_URL.replace(/\/$/, '');
  const publicPath = sharing.publicPath ?? `/live/${sharing.publicMatchId}`;

  console.log('\n=== TurfScore LIVE DEMO READY ===');
  console.log(`Login:     ${DEMO_EMAIL}`);
  console.log(`Password:  (the password you provided)`);
  console.log(`App:       ${clientUrl}/login`);
  console.log(`Match:     ${clientUrl}/matches/${match.id}`);
  console.log(`Scoring:   ${clientUrl}/matches/${match.id}/live`);
  console.log(`Public:    ${clientUrl}${publicPath}`);
  console.log(`Score now: ${totalRuns} runs (seeded sample balls)`);
  console.log('=================================\n');

  logger.info(
    {
      email: DEMO_EMAIL,
      matchId: match.id,
      publicMatchId: sharing.publicMatchId,
      publicUrl: sharing.publicUrl,
    },
    'Live demo seed complete',
  );
}

main()
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'Live demo seed failed');
    console.error(err);
    try {
      await disconnectDatabase();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
