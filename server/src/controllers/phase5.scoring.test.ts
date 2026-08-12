import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { resetEnvCache } from '../config/env.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { Player } from '../models/Player.js';
import { TeamMembership } from '../models/TeamMembership.js';
import { Match } from '../models/Match.js';
import { Delivery } from '../models/Delivery.js';
import { apiRouter } from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';

let mongo: MongoMemoryServer;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function register(app: express.Express, email: string) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Scorer',
    email,
    password: 'Password123',
  });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

async function teamWithPlayers(app: express.Express, token: string, name: string, n: number) {
  const team = await request(app)
    .post('/api/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, shortName: name.slice(0, 3).toUpperCase() });
  const players = [];
  for (let i = 0; i < n; i++) {
    const p = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${name} P${i}`, role: 'ALL_ROUNDER' });
    await request(app)
      .post(`/api/teams/${team.body.id}/players/${p.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    players.push(p.body);
  }
  return { team: team.body, players };
}

function xi(players: Array<{ id: string }>) {
  return players.map((p, i) => ({
    playerId: p.id,
    battingOrder: i + 1,
    role: 'ALL_ROUNDER',
    isWicketKeeper: i === 0,
  }));
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri('turfscore-p5');
  process.env.CLIENT_URL = 'http://localhost:5190';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-characters!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters!';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.LOG_LEVEL = 'silent';
  resetEnvCache();
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
  resetEnvCache();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Team.deleteMany({}),
    Player.deleteMany({}),
    TeamMembership.deleteMany({}),
    Match.deleteMany({}),
    Delivery.deleteMany({}),
  ]);
});

describe('Phase 5 scoring API', () => {
  const app = buildApp();

  async function liveMatch(token: string) {
    const a = await teamWithPlayers(app, token, 'Alpha', 3);
    const b = await teamWithPlayers(app, token, 'Beta', 3);
    const created = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Score Test',
        venue: 'Arena',
        teamA: { teamId: a.team.id, playingXi: xi(a.players) },
        teamB: { teamId: b.team.id, playingXi: xi(b.players) },
        rules: { overs: 2, ballsPerOver: 6, playersPerSide: 3, maxOversPerBowler: 1 },
        toss: { wonByTeamId: a.team.id, decision: 'BAT' },
        startNow: true,
      });
    expect(created.status).toBe(201);
    return { match: created.body, a, b };
  }

  it('records deliveries with version concurrency and idempotency', async () => {
    const token = await register(app, 'score@example.com');
    const { match, a, b } = await liveMatch(token);
    let version = match.version as number;

    const open = await request(app)
      .post(`/api/matches/${match.id}/openings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: version,
        strikerId: a.players[0].id,
        nonStrikerId: a.players[1].id,
      });
    expect(open.status).toBe(200);
    version = open.body.matchVersion;

    const bowl = await request(app)
      .post(`/api/matches/${match.id}/bowler`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: version, bowlerId: b.players[0].id });
    expect(bowl.status).toBe(200);
    version = bowl.body.matchVersion;

    const eventId = 'evt-1';
    const d1 = await request(app)
      .post(`/api/matches/${match.id}/deliveries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventId,
        expectedVersion: version,
        batterId: a.players[0].id,
        nonStrikerId: a.players[1].id,
        bowlerId: b.players[0].id,
        batterRuns: 4,
      });
    expect(d1.status).toBe(201);
    expect(d1.body.result.totalRuns).toBe(4);
    version = d1.body.matchVersion;

    const dup = await request(app)
      .post(`/api/matches/${match.id}/deliveries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventId,
        expectedVersion: version,
        batterId: a.players[0].id,
        nonStrikerId: a.players[1].id,
        bowlerId: b.players[0].id,
        batterRuns: 4,
      });
    expect(dup.status).toBe(200);
    expect(dup.body.duplicate).toBe(true);

    const stale = await request(app)
      .post(`/api/matches/${match.id}/deliveries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventId: 'evt-2',
        expectedVersion: version - 1,
        batterId: a.players[0].id,
        nonStrikerId: a.players[1].id,
        bowlerId: b.players[0].id,
        batterRuns: 1,
      });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('MATCH_VERSION_CONFLICT');

    const striker = d1.body.state.innings[0].strikerId;
    const non = d1.body.state.innings[0].nonStrikerId;
    const wide = await request(app)
      .post(`/api/matches/${match.id}/deliveries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventId: 'evt-wide',
        expectedVersion: version,
        batterId: striker,
        nonStrikerId: non,
        bowlerId: b.players[0].id,
        batterRuns: 0,
        extras: { wide: 1 },
      });
    expect(wide.status).toBe(201);
    expect(wide.body.result.isLegalBall).toBe(false);
    version = wide.body.matchVersion;

    const undo = await request(app)
      .post(`/api/matches/${match.id}/undo`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: version });
    expect(undo.status).toBe(200);
    expect(undo.body.state.innings[0].totalRuns).toBe(4);

    const scorecard = await request(app)
      .get(`/api/matches/${match.id}/scorecard`)
      .set('Authorization', `Bearer ${token}`);
    expect(scorecard.status).toBe(200);
    expect(scorecard.body.innings[0].totalRuns).toBe(4);
  });

  it('blocks unauthorized scoring (IDOR)', async () => {
    const a = await register(app, 'owner5@example.com');
    const b = await register(app, 'intruder5@example.com');
    const { match } = await liveMatch(a);
    const denied = await request(app)
      .post(`/api/matches/${match.id}/openings`)
      .set('Authorization', `Bearer ${b}`)
      .send({
        expectedVersion: match.version,
        strikerId: match.teamA.playingXi[0].playerId,
        nonStrikerId: match.teamA.playingXi[1].playerId,
      });
    expect(denied.status).toBe(403);
  });

  it('edits a delivery and rebuilds state', async () => {
    const token = await register(app, 'edit@example.com');
    const { match, a, b } = await liveMatch(token);
    let version = match.version as number;

    const open = await request(app)
      .post(`/api/matches/${match.id}/openings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: version,
        strikerId: a.players[0].id,
        nonStrikerId: a.players[1].id,
      });
    version = open.body.matchVersion;

    const bowl = await request(app)
      .post(`/api/matches/${match.id}/bowler`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: version, bowlerId: b.players[0].id });
    version = bowl.body.matchVersion;

    const d1 = await request(app)
      .post(`/api/matches/${match.id}/deliveries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventId: 'edit-1',
        expectedVersion: version,
        batterId: a.players[0].id,
        nonStrikerId: a.players[1].id,
        bowlerId: b.players[0].id,
        batterRuns: 1,
      });
    expect(d1.status).toBe(201);
    version = d1.body.matchVersion;
    const deliveryId = String(d1.body.delivery.id ?? d1.body.delivery._id);

    const patched = await request(app)
      .patch(`/api/matches/${match.id}/deliveries/${deliveryId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: version,
        batterId: a.players[0].id,
        nonStrikerId: a.players[1].id,
        bowlerId: b.players[0].id,
        batterRuns: 4,
        reason: 'misclick',
      });
    expect(patched.status).toBe(200);
    expect(patched.body.state.innings[0].totalRuns).toBe(4);
    expect(patched.body.state.innings[0].batters[a.players[0].id].fours).toBe(1);
  });

  it('starts second innings after first completes', async () => {
    const token = await register(app, 'innings@example.com');
    const { match, a, b } = await liveMatch(token);
    let version = match.version as number;

    let r = await request(app)
      .post(`/api/matches/${match.id}/openings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: version,
        strikerId: a.players[0].id,
        nonStrikerId: a.players[1].id,
      });
    version = r.body.matchVersion;

    r = await request(app)
      .post(`/api/matches/${match.id}/bowler`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: version, bowlerId: b.players[0].id });
    version = r.body.matchVersion;

    // 2 overs × 6 balls — bowl all dots then switch bowler mid-way
    for (let over = 0; over < 2; over++) {
      if (over === 1) {
        r = await request(app)
          .post(`/api/matches/${match.id}/bowler`)
          .set('Authorization', `Bearer ${token}`)
          .send({ expectedVersion: version, bowlerId: b.players[1].id });
        expect(r.status).toBe(200);
        version = r.body.matchVersion;
      }
      for (let ball = 0; ball < 6; ball++) {
        const scoring = await request(app)
          .get(`/api/matches/${match.id}/scoring`)
          .set('Authorization', `Bearer ${token}`);
        const inn = scoring.body.state.innings[0];
        r = await request(app)
          .post(`/api/matches/${match.id}/deliveries`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            eventId: `i1-o${over}-b${ball}`,
            expectedVersion: version,
            batterId: inn.strikerId,
            nonStrikerId: inn.nonStrikerId,
            bowlerId: inn.currentBowlerId,
            batterRuns: over === 0 && ball === 0 ? 1 : 0,
          });
        expect(r.status).toBe(201);
        version = r.body.matchVersion;
      }
    }

    expect(r.body.result.inningsCompleted).toBe(true);

    const start2 = await request(app)
      .post(`/api/matches/${match.id}/innings/start`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: version,
        strikerId: b.players[0].id,
        nonStrikerId: b.players[1].id,
        bowlerId: a.players[0].id,
      });
    expect(start2.status).toBe(200);
    expect(start2.body.state.currentInningsIndex).toBe(1);
    expect(start2.body.state.target).toBe(2);
  });
});
