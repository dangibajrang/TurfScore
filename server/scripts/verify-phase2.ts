/**
 * Phase 2 manual verification harness (self-contained memory Mongo + ephemeral port).
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { resetEnvCache } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Team } from '../src/models/Team.js';
import { Match } from '../src/models/Match.js';
import { Player } from '../src/models/Player.js';
import { RefreshSession } from '../src/models/RefreshSession.js';

async function seedMinimal() {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const admin = await User.create({
    name: 'TurfScore Admin',
    email: 'admin@example.com',
    passwordHash,
    role: 'ADMIN',
    isActive: true,
  });
  const arjun = await User.create({
    name: 'Arjun Kumar',
    email: 'arjun@example.com',
    passwordHash,
    role: 'USER',
    isActive: true,
  });
  const rcc = await Team.create({ name: 'RCC', shortName: 'RCC', createdBy: arjun._id });
  const warriors = await Team.create({ name: 'Warriors', shortName: 'WAR', createdBy: arjun._id });
  await Player.create({
    name: 'Rahul Sharma',
    role: 'BATSMAN',
    battingStyle: 'RIGHT_HAND',
    teamId: rcc._id,
    createdBy: arjun._id,
  });
  await Match.create({
    name: 'RCC vs Warriors',
    status: 'LIVE',
    teamA: { teamId: rcc._id, playingXi: [] },
    teamB: { teamId: warriors._id, playingXi: [] },
    venue: 'Turf Arena 1',
    rules: {
      overs: 10,
      ballsPerOver: 6,
      playersPerSide: 11,
      customRules: { seedFixture: true },
    },
    version: 0,
    createdBy: arjun._id,
    correctionMeta: { seedFixture: true },
  });
  return { admin, arjun };
}

function cookieFrom(res: Response): string {
  const raw = res.headers.getSetCookie?.() ?? [];
  return raw.map((c) => c.split(';')[0]).join('; ');
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'development';
  process.env.MONGODB_URI = mongod.getUri('turfscore-verify');
  process.env.CLIENT_URL = 'http://localhost:5190';
  process.env.JWT_ACCESS_SECRET = 'verify-access-secret-min-32-characters!';
  process.env.JWT_REFRESH_SECRET = 'verify-refresh-secret-min-32-characters';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.LOG_LEVEL = 'silent';
  process.env.PORT = '5055';
  resetEnvCache();

  await mongoose.connect(process.env.MONGODB_URI);
  await seedMinimal();

  const app = createApp();
  const server = app.listen(5055);
  const base = 'http://127.0.0.1:5055';

  const results: string[] = [];
  const check = (label: string, ok: boolean, detail = '') => {
    results.push(`${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`);
    if (!ok) throw new Error(label);
  };

  try {
    const health = await fetch(`${base}/api/health`);
    const healthBody = (await health.json()) as { status: string };
    check('/health ok', health.status === 200 && healthBody.status === 'ok');

    const reg = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Player',
        email: 'newplayer@example.com',
        password: 'Password123',
      }),
    });
    const regBody = (await reg.json()) as {
      accessToken: string;
      user: { email: string; passwordHash?: string };
    };
    check('register creates account', reg.status === 201, regBody.user.email);
    check('register hides passwordHash', regBody.user.passwordHash === undefined);
    const regCookie = cookieFrom(reg);

    const me1 = await fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${regBody.accessToken}` },
    });
    const me1Body = (await me1.json()) as { email: string; passwordHash?: string };
    check('/me authenticated', me1.status === 200 && me1Body.email === 'newplayer@example.com');
    check('/me hides passwordHash', me1Body.passwordHash === undefined);

    const meNoAuth = await fetch(`${base}/api/auth/me`);
    check('/me without auth rejected', meNoAuth.status === 401);

    const refresh = await fetch(`${base}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: regCookie },
    });
    const refreshBody = (await refresh.json()) as { accessToken: string };
    check('refresh issues access token', refresh.status === 200 && !!refreshBody.accessToken);

    const logout = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: regCookie },
    });
    check('logout succeeds', logout.status === 200);

    const refreshAfterLogout = await fetch(`${base}/api/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: regCookie },
    });
    check('refresh after logout rejected', refreshAfterLogout.status === 401);

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'Password123!' }),
    });
    const loginBody = (await login.json()) as {
      accessToken: string;
      user: { role: string; passwordHash?: string };
    };
    check('admin login', login.status === 200 && loginBody.user.role === 'ADMIN');
    check('login hides passwordHash', loginBody.user.passwordHash === undefined);

    const adminCheck = await fetch(`${base}/api/auth/admin-check`, {
      headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    });
    check('admin role access', adminCheck.status === 200);

    const userLogin = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arjun@example.com', password: 'Password123!' }),
    });
    const userBody = (await userLogin.json()) as { accessToken: string };
    const userAdmin = await fetch(`${base}/api/auth/admin-check`, {
      headers: { Authorization: `Bearer ${userBody.accessToken}` },
    });
    check('user denied admin', userAdmin.status === 403);

    const teams = await Team.countDocuments();
    const players = await Player.countDocuments();
    const matches = await Match.countDocuments();
    check('seeded teams exist', teams >= 2, String(teams));
    check('seeded players exist', players >= 1, String(players));
    check('seeded matches exist', matches >= 1, String(matches));

    console.log('\n=== Phase 2 manual verification ===');
    for (const line of results) console.log(line);
    console.log('ALL CHECKS PASSED\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    await mongod.stop();
    await RefreshSession.deleteMany({}).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
