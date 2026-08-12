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

async function makeTeamWithPlayers(
  app: express.Express,
  token: string,
  teamName: string,
  playerNames: string[],
) {
  const team = await request(app)
    .post('/api/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: teamName, shortName: teamName.slice(0, 3).toUpperCase() });
  expect(team.status).toBe(201);
  const players = [];
  for (const name of playerNames) {
    const p = await request(app)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, role: 'ALL_ROUNDER' });
    expect(p.status).toBe(201);
    const add = await request(app)
      .post(`/api/teams/${team.body.id}/players/${p.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(add.status).toBe(200);
    players.push(p.body);
  }
  return { team: team.body, players };
}

function xi(players: Array<{ id: string }>, wkIndex = 0) {
  return players.map((p, i) => ({
    playerId: p.id,
    battingOrder: i + 1,
    role: 'ALL_ROUNDER' as const,
    isWicketKeeper: i === wkIndex,
    isCaptain: i === 0,
  }));
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri('turfscore-p4');
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

describe('Phase 4 matches', () => {
  const app = buildApp();

  it('creates draft and lists matches', async () => {
    const token = await register(app, 'm@example.com');
    const a = await makeTeamWithPlayers(app, token, 'Alpha', ['A1', 'A2']);
    const b = await makeTeamWithPlayers(app, token, 'Beta', ['B1', 'B2']);

    const created = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sunday Clash',
        venue: 'Green Arena',
        teamA: { teamId: a.team.id },
        teamB: { teamId: b.team.id },
        rules: { overs: 10, ballsPerOver: 6, playersPerSide: 2 },
        status: 'DRAFT',
      });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('DRAFT');

    const list = await request(app)
      .get('/api/matches?status=DRAFT')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.total).toBe(1);
  });

  it('rejects same team twice', async () => {
    const token = await register(app, 'same@example.com');
    const a = await makeTeamWithPlayers(app, token, 'Solo', ['S1', 'S2']);
    const res = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad',
        venue: 'X',
        teamA: { teamId: a.team.id },
        teamB: { teamId: a.team.id },
        rules: { overs: 10, ballsPerOver: 6, playersPerSide: 2 },
      });
    expect(res.status).toBe(400);
  });

  it('blocks unauthorized team use (IDOR)', async () => {
    const aToken = await register(app, 'owner-a@example.com', 'OwnerA');
    const bToken = await register(app, 'owner-b@example.com', 'OwnerB');
    const a = await makeTeamWithPlayers(app, aToken, 'ASide', ['A1', 'A2']);
    const b = await makeTeamWithPlayers(app, bToken, 'BSide', ['B1', 'B2']);
    const res = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${aToken}`)
      .send({
        name: 'Steal',
        venue: 'X',
        teamA: { teamId: a.team.id },
        teamB: { teamId: b.team.id },
        rules: { overs: 10, ballsPerOver: 6, playersPerSide: 2 },
      });
    expect(res.status).toBe(403);
  });

  it('starts a fully configured match', async () => {
    const token = await register(app, 'start@example.com');
    const a = await makeTeamWithPlayers(app, token, 'RCC', ['Rahul', 'Amit']);
    const b = await makeTeamWithPlayers(app, token, 'Warriors', ['Sahil', 'Arjun']);

    const created = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Turf Clash',
        venue: 'Green Arena',
        scheduledAt: new Date().toISOString(),
        teamA: { teamId: a.team.id, playingXi: xi(a.players) },
        teamB: { teamId: b.team.id, playingXi: xi(b.players) },
        rules: { overs: 10, ballsPerOver: 6, playersPerSide: 2, maxOversPerBowler: 2 },
        toss: { wonByTeamId: b.team.id, decision: 'BAT' },
        startNow: true,
      });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('LIVE');
    expect(created.body.version).toBe(1);
    expect(created.body.innings).toHaveLength(1);
    expect(created.body.firstInnings.battingTeamId).toBe(b.team.id);
    expect(created.body.teamA.playingXi).toHaveLength(2);
  });

  it('rejects start with incomplete XI', async () => {
    const token = await register(app, 'badxi@example.com');
    const a = await makeTeamWithPlayers(app, token, 'T1', ['P1', 'P2']);
    const b = await makeTeamWithPlayers(app, token, 'T2', ['P3', 'P4']);
    const draft = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Incomplete',
        venue: 'X',
        teamA: { teamId: a.team.id },
        teamB: { teamId: b.team.id },
        rules: { overs: 10, ballsPerOver: 6, playersPerSide: 2 },
      });
    const start = await request(app)
      .post(`/api/matches/${draft.body.id}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(start.status).toBe(400);
  });

  it('rejects powerplay > overs on startNow', async () => {
    const token = await register(app, 'pp@example.com');
    const a = await makeTeamWithPlayers(app, token, 'PA', ['A1', 'A2']);
    const b = await makeTeamWithPlayers(app, token, 'PB', ['B1', 'B2']);
    const res = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'PP',
        venue: 'X',
        teamA: { teamId: a.team.id, playingXi: xi(a.players) },
        teamB: { teamId: b.team.id, playingXi: xi(b.players) },
        rules: {
          overs: 10,
          ballsPerOver: 6,
          playersPerSide: 2,
          powerplayEnabled: true,
          powerplayOvers: 20,
        },
        toss: { wonByTeamId: a.team.id, decision: 'BOWL' },
        startNow: true,
      });
    expect(res.status).toBe(400);
  });

  it('rejects invalid toss team', async () => {
    const token = await register(app, 'toss@example.com');
    const a = await makeTeamWithPlayers(app, token, 'TA', ['A1', 'A2']);
    const b = await makeTeamWithPlayers(app, token, 'TB', ['B1', 'B2']);
    const outsider = await makeTeamWithPlayers(app, token, 'TC', ['C1', 'C2']);
    const res = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Toss bad',
        venue: 'X',
        teamA: { teamId: a.team.id, playingXi: xi(a.players) },
        teamB: { teamId: b.team.id, playingXi: xi(b.players) },
        rules: { overs: 10, ballsPerOver: 6, playersPerSide: 2 },
        toss: { wonByTeamId: outsider.team.id, decision: 'BAT' },
        startNow: true,
      });
    expect(res.status).toBe(400);
  });

  it('blocks IDOR on match update', async () => {
    const a = await register(app, 'ma@example.com', 'Alice');
    const b = await register(app, 'mb@example.com', 'Bob');
    const ta = await makeTeamWithPlayers(app, a, 'OwnA', ['A1', 'A2']);
    const tb = await makeTeamWithPlayers(app, a, 'OwnB', ['B1', 'B2']);
    const match = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${a}`)
      .send({
        name: 'Private',
        venue: 'X',
        teamA: { teamId: ta.team.id },
        teamB: { teamId: tb.team.id },
        rules: { overs: 10, ballsPerOver: 6, playersPerSide: 2 },
      });
    const denied = await request(app)
      .patch(`/api/matches/${match.body.id}`)
      .set('Authorization', `Bearer ${b}`)
      .send({ name: 'Hacked' });
    expect(denied.status).toBe(403);
  });

  it('cannot start an already LIVE match', async () => {
    const token = await register(app, 'live@example.com');
    const a = await makeTeamWithPlayers(app, token, 'LA', ['A1', 'A2']);
    const b = await makeTeamWithPlayers(app, token, 'LB', ['B1', 'B2']);
    const live = await request(app)
      .post('/api/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Live',
        venue: 'X',
        teamA: { teamId: a.team.id, playingXi: xi(a.players) },
        teamB: { teamId: b.team.id, playingXi: xi(b.players) },
        rules: { overs: 10, ballsPerOver: 6, playersPerSide: 2 },
        toss: { wonByTeamId: a.team.id, decision: 'BAT' },
        startNow: true,
      });
    const again = await request(app)
      .post(`/api/matches/${live.body.id}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(409);
  });
});
