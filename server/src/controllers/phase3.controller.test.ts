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

async function register(app: express.Express, email: string, name = 'Owner') {
  const res = await request(app).post('/api/auth/register').send({
    name,
    email,
    password: 'Password123',
  });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri('turfscore-p3');
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
  ]);
});

describe('Phase 3 teams/players/dashboard', () => {
  const app = buildApp();

  it('creates and lists teams for owner', async () => {
    const token = await register(app, 'owner@example.com');
    const created = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'RCC', shortName: 'rcc', description: 'Local side' });
    expect(created.status).toBe(201);
    expect(created.body.shortName).toBe('RCC');

    const list = await request(app)
      .get('/api/teams')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].name).toBe('RCC');
  });

  it('rejects invalid team name', async () => {
    const token = await register(app, 'v@example.com');
    const res = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'A' });
    expect(res.status).toBe(400);
  });

  it('blocks IDOR on team update', async () => {
    const a = await register(app, 'a@example.com', 'Alice');
    const b = await register(app, 'b@example.com', 'Bob');
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    const team = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${a}`)
      .send({ name: 'Titans' });
    expect(team.status).toBe(201);
    const denied = await request(app)
      .patch(`/api/teams/${team.body.id}`)
      .set('Authorization', `Bearer ${b}`)
      .send({ name: 'Hacked' });
    expect(denied.status).toBe(403);
  });

  it('creates players, searches case-insensitively, filters role', async () => {
    const token = await register(app, 'p@example.com');
    await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Rahul Sharma', role: 'BATTER', battingStyle: 'RIGHT_HAND' });
    await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Amit Verma', role: 'BOWLER', bowlingStyle: 'RIGHT_ARM_FAST' });

    const search = await request(app)
      .get('/api/players?search=rahul')
      .set('Authorization', `Bearer ${token}`);
    expect(search.body.total).toBe(1);
    expect(search.body.items[0].name).toBe('Rahul Sharma');

    const bowlers = await request(app)
      .get('/api/players?role=BOWLER')
      .set('Authorization', `Bearer ${token}`);
    expect(bowlers.body.total).toBe(1);
  });

  it('blocks IDOR on player update', async () => {
    const a = await register(app, 'pa@example.com');
    const b = await register(app, 'pb@example.com');
    const player = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${a}`)
      .send({ name: 'Solo', role: 'BATTER' });
    const denied = await request(app)
      .patch(`/api/players/${player.body.id}`)
      .set('Authorization', `Bearer ${b}`)
      .send({ name: 'Nope' });
    expect(denied.status).toBe(403);
  });

  it('manages roster, captain and vice captain rules', async () => {
    const token = await register(app, 'roster@example.com');
    const team = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Warriors' });
    const p1 = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'One', role: 'BATTER' });
    const p2 = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Two', role: 'BOWLER' });

    const add = await request(app)
      .post(`/api/teams/${team.body.id}/players/${p1.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(add.status).toBe(200);

    await request(app)
      .post(`/api/teams/${team.body.id}/players/${p2.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    const dup = await request(app)
      .post(`/api/teams/${team.body.id}/players/${p1.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(dup.status).toBe(409);

    const cap = await request(app)
      .patch(`/api/teams/${team.body.id}/captain`)
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: p1.body.id });
    expect(cap.status).toBe(200);
    expect(cap.body.captainId).toBe(p1.body.id);

    const same = await request(app)
      .patch(`/api/teams/${team.body.id}/vice-captain`)
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: p1.body.id });
    expect(same.status).toBe(400);

    const vice = await request(app)
      .patch(`/api/teams/${team.body.id}/vice-captain`)
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: p2.body.id });
    expect(vice.status).toBe(200);

    const remove = await request(app)
      .delete(`/api/teams/${team.body.id}/players/${p2.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(remove.status).toBe(200);
    expect(remove.body.viceCaptainId).toBeNull();
  });

  it('rejects captain not on team', async () => {
    const token = await register(app, 'cap@example.com');
    const team = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'XI' });
    const outsider = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Out', role: 'BATTER' });
    const res = await request(app)
      .patch(`/api/teams/${team.body.id}/captain`)
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: outsider.body.id });
    expect(res.status).toBe(400);
  });

  it('returns dashboard summary with real counts', async () => {
    const token = await register(app, 'dash@example.com');
    await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dash Team' });
    await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dash Player', role: 'ALL_ROUNDER' });

    const user = await User.findOne({ email: 'dash@example.com' });
    const team = await Team.findOne({ name: 'Dash Team' });
    await Match.create({
      name: 'Live Demo',
      status: 'LIVE',
      teamA: { teamId: team!._id, playingXi: [] },
      teamB: { teamId: team!._id, playingXi: [] },
      rules: { overs: 10, ballsPerOver: 6, playersPerSide: 11 },
      version: 0,
      createdBy: user!._id,
      correctionMeta: { seedFixture: true },
    });

    const dash = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(dash.status).toBe(200);
    expect(dash.body.metrics.teams).toBe(1);
    expect(dash.body.metrics.players).toBe(1);
    expect(dash.body.metrics.liveMatches).toBe(1);
    expect(dash.body.liveMatches[0].isDevelopmentFixture).toBe(true);
  });

  it('requires auth for dashboard', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('soft-deletes teams and deactivates players', async () => {
    const token = await register(app, 'del@example.com');
    const team = await request(app)
      .post('/api/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Gone' });
    const player = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inactive', role: 'BATTER' });

    const delTeam = await request(app)
      .delete(`/api/teams/${team.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delTeam.status).toBe(200);

    const getTeam = await request(app)
      .get(`/api/teams/${team.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getTeam.status).toBe(404);

    const delPlayer = await request(app)
      .delete(`/api/players/${player.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delPlayer.status).toBe(200);

    const list = await request(app)
      .get('/api/players')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.total).toBe(0);
  });
});
