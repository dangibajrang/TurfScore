import http from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { io as ioClient, type Socket } from 'socket.io-client';
import request from 'supertest';
import { resetEnvCache } from '../config/env.js';
import { createApp } from '../app.js';
import { initSocketIO, setIo } from '../sockets/index.js';
import { SocketEvents } from '../sockets/socket.events.js';
import { User } from '../models/User.js';
import { Team } from '../models/Team.js';
import { Player } from '../models/Player.js';
import { TeamMembership } from '../models/TeamMembership.js';
import { Match } from '../models/Match.js';
import { Delivery } from '../models/Delivery.js';

let mongo: MongoMemoryServer;
let httpServer: http.Server;
let baseUrl: string;

async function register(email: string) {
  const res = await request(baseUrl).post('/api/auth/register').send({
    name: 'Live Scorer',
    email,
    password: 'Password123',
  });
  expect(res.status).toBe(201);
  return res.body.accessToken as string;
}

async function teamWithPlayers(token: string, name: string, n: number) {
  const team = await request(baseUrl)
    .post('/api/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, shortName: name.slice(0, 3).toUpperCase() });
  const players = [];
  for (let i = 0; i < n; i++) {
    const p = await request(baseUrl)
      .post('/api/players')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `${name} P${i}`, role: 'ALL_ROUNDER' });
    await request(baseUrl)
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
  process.env.MONGODB_URI = mongo.getUri('turfscore-p7');
  process.env.CLIENT_URL = 'http://localhost:5190';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-characters!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters!';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.LOG_LEVEL = 'silent';
  resetEnvCache();
  await mongoose.connect(process.env.MONGODB_URI);

  const app = createApp();
  httpServer = http.createServer(app);
  initSocketIO(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = httpServer.address();
  if (!addr || typeof addr === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  setIo(null);
  await new Promise<void>((resolve, reject) => {
    httpServer.close((err) => (err ? reject(err) : resolve()));
  });
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

describe('Phase 7 realtime + public sharing', () => {
  async function liveMatch(token: string) {
    const a = await teamWithPlayers(token, 'Alpha', 3);
    const b = await teamWithPlayers(token, 'Beta', 3);
    const created = await request(baseUrl)
      .post('/api/matches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Live Share Test',
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

  it('rejects public socket join when sharing disabled', async () => {
    const token = await register('sock1@example.com');
    const { match } = await liveMatch(token);
    const enable = await request(baseUrl)
      .post(`/api/matches/${match.id}/live-sharing/enable`)
      .set('Authorization', `Bearer ${token}`);
    expect(enable.status).toBe(200);
    const publicMatchId = enable.body.publicMatchId as string;

    await request(baseUrl)
      .post(`/api/matches/${match.id}/live-sharing/disable`)
      .set('Authorization', `Bearer ${token}`);

    const socket: Socket = ioClient(baseUrl, {
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => resolve());
      socket.on('connect_error', reject);
    });

    const ack = await new Promise<{ ok: boolean; code?: string }>((resolve) => {
      socket.emit(SocketEvents.MATCH_JOIN, { publicMatchId }, (res: { ok: boolean; code?: string }) =>
        resolve(res),
      );
    });
    expect(ack.ok).toBe(false);
    expect(ack.code).toBe('FORBIDDEN');
    socket.close();
  });

  it('broadcasts DELIVERY_RECORDED to public viewer after HTTP delivery', async () => {
    const token = await register('sock2@example.com');
    const { match, a, b } = await liveMatch(token);
    let version = match.version as number;

    const sharing = await request(baseUrl)
      .post(`/api/matches/${match.id}/live-sharing/enable`)
      .set('Authorization', `Bearer ${token}`);
    expect(sharing.status).toBe(200);
    const publicMatchId = sharing.body.publicMatchId as string;

    const pub = await request(baseUrl).get(`/api/public/matches/${publicMatchId}`);
    expect(pub.status).toBe(200);
    expect(pub.body.presentation.totalRuns).toBe(0);

    const viewer: Socket = ioClient(baseUrl, { transports: ['websocket'], forceNew: true });
    await new Promise<void>((resolve, reject) => {
      viewer.on('connect', () => resolve());
      viewer.on('connect_error', reject);
    });
    await new Promise<void>((resolve, reject) => {
      viewer.emit(SocketEvents.MATCH_JOIN, { publicMatchId }, (ack: { ok: boolean }) => {
        if (ack.ok) resolve();
        else reject(new Error('join failed'));
      });
    });

    const eventPromise = new Promise<Record<string, unknown>>((resolve) => {
      viewer.once(SocketEvents.DELIVERY_RECORDED, (payload) => resolve(payload));
    });

    // openings + bowler
    let r = await request(baseUrl)
      .post(`/api/matches/${match.id}/openings`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedVersion: version,
        strikerId: a.players[0].id,
        nonStrikerId: a.players[1].id,
      });
    version = r.body.matchVersion;
    r = await request(baseUrl)
      .post(`/api/matches/${match.id}/bowler`)
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedVersion: version, bowlerId: b.players[0].id });
    version = r.body.matchVersion;

    r = await request(baseUrl)
      .post(`/api/matches/${match.id}/deliveries`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventId: 'rt-1',
        expectedVersion: version,
        batterId: a.players[0].id,
        nonStrikerId: a.players[1].id,
        bowlerId: b.players[0].id,
        batterRuns: 4,
      });
    expect(r.status).toBe(201);

    const payload = await eventPromise;
    expect(payload.version).toBe(r.body.matchVersion);
    expect((payload.state as { score: number }).score).toBe(4);
    expect(payload.eventId).toBe('rt-1');

    const pub2 = await request(baseUrl).get(`/api/public/matches/${publicMatchId}`);
    expect(pub2.body.presentation.totalRuns).toBe(4);
    expect(pub2.body.version).toBe(r.body.matchVersion);

    viewer.close();
  });

  it('blocks public mutation endpoints without auth', async () => {
    const token = await register('sock3@example.com');
    const { match } = await liveMatch(token);
    const denied = await request(baseUrl).post(`/api/matches/${match.id}/deliveries`).send({
      eventId: 'x',
      expectedVersion: 0,
      batterId: match.teamA.playingXi[0].playerId,
      nonStrikerId: match.teamA.playingXi[1].playerId,
      bowlerId: match.teamB.playingXi[0].playerId,
      batterRuns: 1,
    });
    expect(denied.status).toBe(401);
  });
});
