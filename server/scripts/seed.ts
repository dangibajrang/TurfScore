import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { loadEnv } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { Match } from '../src/models/Match.js';
import { Player } from '../src/models/Player.js';
import { RefreshSession } from '../src/models/RefreshSession.js';
import { Team } from '../src/models/Team.js';
import { User } from '../src/models/User.js';
import { Delivery } from '../src/models/Delivery.js';
import { TeamMembership } from '../src/models/TeamMembership.js';
import bcrypt from 'bcrypt';

const DEV_PASSWORD = 'Password123!';

type SeedOptions = {
  reset: boolean;
};

async function seed(options: SeedOptions) {
  const env = loadEnv();
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to run seed in production');
  }

  await connectDatabase();

  if (options.reset) {
    logger.warn('Resetting development collections…');
    await Promise.all([
      User.deleteMany({}),
      Team.deleteMany({}),
      Player.deleteMany({}),
      Match.deleteMany({}),
      Delivery.deleteMany({}),
      RefreshSession.deleteMany({}),
      TeamMembership.deleteMany({}),
    ]);
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  const admin = await User.findOneAndUpdate(
    { email: 'admin@example.com' },
    {
      name: 'TurfScore Admin',
      email: 'admin@example.com',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const arjun = await User.findOneAndUpdate(
    { email: 'arjun@example.com' },
    {
      name: 'Arjun Kumar',
      email: 'arjun@example.com',
      passwordHash,
      role: 'USER',
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const ownerId = arjun._id;

  const teamDefs = [
    { name: 'RCC', shortName: 'RCC' },
    { name: 'Warriors', shortName: 'WAR' },
    { name: 'Titans', shortName: 'TIT' },
    { name: 'Challengers', shortName: 'CHL' },
  ] as const;

  const teams = [];
  for (const def of teamDefs) {
    const team = await Team.findOneAndUpdate(
      { name: def.name, createdBy: ownerId },
      {
        name: def.name,
        shortName: def.shortName,
        createdBy: ownerId,
        isActive: true,
        city: 'Local Turf',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    teams.push(team);
  }

  const [rcc, warriors, titans, challengers] = teams;

  const playerDefs = [
    {
      name: 'Rahul Sharma',
      role: 'BATTER' as const,
      battingStyle: 'RIGHT_HAND' as const,
      bowlingStyle: 'RIGHT_ARM_MEDIUM' as const,
      teamId: rcc._id,
    },
    {
      name: 'Amit Verma',
      role: 'BOWLER' as const,
      battingStyle: 'RIGHT_HAND' as const,
      bowlingStyle: 'RIGHT_ARM_FAST' as const,
      teamId: rcc._id,
    },
    {
      name: 'Rohit Singh',
      role: 'ALL_ROUNDER' as const,
      battingStyle: 'RIGHT_HAND' as const,
      bowlingStyle: 'RIGHT_ARM_SPIN' as const,
      teamId: warriors._id,
    },
    {
      name: 'Sahil Khan',
      role: 'WICKET_KEEPER' as const,
      battingStyle: 'LEFT_HAND' as const,
      bowlingStyle: 'LEFT_ARM_SPIN' as const,
      teamId: warriors._id,
    },
    {
      name: 'Arjun Kumar',
      role: 'BATTER' as const,
      battingStyle: 'RIGHT_HAND' as const,
      bowlingStyle: 'RIGHT_ARM_MEDIUM' as const,
      teamId: titans._id,
    },
  ];

  const players = [];
  for (const def of playerDefs) {
    const player = await Player.findOneAndUpdate(
      { name: def.name, createdBy: ownerId },
      {
        ...def,
        createdBy: ownerId,
        isActive: true,
        status: 'ACTIVE',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    players.push(player);
  }

  // Keep team.playerIds + memberships consistent
  for (const team of [rcc, warriors, titans]) {
    const roster = players.filter((p) => String(p.teamId) === String(team._id));
    await Team.findByIdAndUpdate(team._id, {
      playerIds: roster.map((p) => p._id),
      captainId: roster[0]?._id,
    });
    for (const p of roster) {
      await TeamMembership.findOneAndUpdate(
        { teamId: team._id, playerId: p._id, status: 'ACTIVE' },
        {
          teamId: team._id,
          playerId: p._id,
          status: 'ACTIVE',
          joinedAt: new Date(),
          createdBy: ownerId,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }

  const defaultRules = {
    overs: 10,
    ballsPerOver: 6,
    playersPerSide: 11,
    maxOversPerBowler: 2,
    powerplayEnabled: false,
    superOverEnabled: false,
    customRules: {
      seedFixture: true,
      note: 'Development fixture — scores are placeholders, not engine-generated',
    },
  };

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  await Match.findOneAndUpdate(
    { name: 'RCC vs Warriors', createdBy: ownerId },
    {
      name: 'RCC vs Warriors',
      status: 'LIVE',
      teamA: { teamId: rcc._id, playingXi: [] },
      teamB: { teamId: warriors._id, playingXi: [] },
      venue: 'Turf Arena 1',
      scheduledAt: now,
      startedAt: now,
      rules: defaultRules,
      version: 0,
      snapshot: {
        currentInningsIndex: 1,
        scoreSummary: {
          note: 'DEV_FIXTURE',
          display: 'Placeholder only — scoring engine not implemented',
        },
      },
      resultText: undefined,
      createdBy: ownerId,
      correctionMeta: { seedFixture: true },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await Match.findOneAndUpdate(
    { name: 'Titans vs Challengers', createdBy: ownerId },
    {
      name: 'Titans vs Challengers',
      status: 'UPCOMING',
      teamA: { teamId: titans._id, playingXi: [] },
      teamB: { teamId: challengers._id, playingXi: [] },
      venue: 'Greenfield Turf',
      scheduledAt: tomorrow,
      rules: { ...defaultRules, overs: 12 },
      version: 0,
      snapshot: {
        scoreSummary: { note: 'DEV_FIXTURE' },
      },
      createdBy: ownerId,
      correctionMeta: { seedFixture: true },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await Match.findOneAndUpdate(
    { name: 'Warriors vs Titans', createdBy: ownerId },
    {
      name: 'Warriors vs Titans',
      status: 'COMPLETED',
      teamA: { teamId: warriors._id, playingXi: [] },
      teamB: { teamId: titans._id, playingXi: [] },
      venue: 'Turf Arena 2',
      scheduledAt: yesterday,
      startedAt: yesterday,
      completedAt: yesterday,
      rules: defaultRules,
      version: 0,
      snapshot: {
        scoreSummary: {
          note: 'DEV_FIXTURE',
          display: 'Result placeholder — not engine-generated',
        },
      },
      winnerTeamId: warriors._id,
      resultText: 'Warriors won (development fixture)',
      createdBy: ownerId,
      correctionMeta: { seedFixture: true },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  logger.info(
    {
      admin: admin.email,
      user: arjun.email,
      password: DEV_PASSWORD,
      teams: teamDefs.map((t) => t.name),
      players: playerDefs.map((p) => p.name),
    },
    'Development seed complete',
  );

  console.log('\n=== TurfScore Dev Seed ===');
  console.log('ADMIN  admin@example.com / Password123!');
  console.log('USER   arjun@example.com / Password123!');
  console.log('Teams: RCC, Warriors, Titans, Challengers');
  console.log('Matches: LIVE, UPCOMING, COMPLETED fixtures (marked DEV_FIXTURE)');
  console.log('==========================\n');
}

const reset = process.argv.includes('--reset');

seed({ reset })
  .then(async () => {
    await disconnectDatabase();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'Seed failed');
    try {
      await disconnectDatabase();
    } catch {
      /* ignore */
    }
    process.exit(1);
  });
