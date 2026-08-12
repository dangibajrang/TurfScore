import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { resetEnvCache } from '../config/env.js';
import { User } from '../models/User.js';
import { RefreshSession } from '../models/RefreshSession.js';
import { apiRouter } from '../routes/index.js';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import { REFRESH_COOKIE_NAME } from '../services/auth/cookies.js';

let mongo: MongoMemoryServer;

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongo.getUri('turfscore-auth-test');
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
  await Promise.all([User.deleteMany({}), RefreshSession.deleteMany({})]);
});

describe('Auth API', () => {
  const app = buildTestApp();

  describe('POST /api/auth/register', () => {
    it('registers a valid user and returns safe payload', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.role).toBe('USER');
      expect(res.body.accessToken).toBeTypeOf('string');
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects duplicate email', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'dupe@example.com',
        password: 'Password123',
      });
      const res = await request(app).post('/api/auth/register').send({
        name: 'Other',
        email: 'dupe@example.com',
        password: 'Password123',
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_EMAIL');
    });

    it('rejects invalid email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'not-an-email',
        password: 'Password123',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects weak password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'weak@example.com',
        password: 'short',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Login User',
        email: 'login@example.com',
        passwordHash: await bcrypt.hash('Password123', 4),
        role: 'USER',
        isActive: true,
      });
    });

    it('logs in with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'Password123',
      });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.accessToken).toBeTypeOf('string');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects invalid credentials with generic message', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@example.com',
        password: 'WrongPass1',
      });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('rejects malformed request', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'not-email',
        password: '',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('rejects without authentication', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('returns user with valid token', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        name: 'Me User',
        email: 'me@example.com',
        password: 'Password123',
      });
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${reg.body.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('me@example.com');
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('rejects invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(res.status).toBe(401);
      expect(['INVALID_TOKEN', 'TOKEN_EXPIRED']).toContain(res.body.error.code);
    });
  });

  describe('roles', () => {
    it('denies USER on ADMIN route and allows ADMIN', async () => {
      const userReg = await request(app).post('/api/auth/register').send({
        name: 'Normal',
        email: 'userrole@example.com',
        password: 'Password123',
      });

      const denied = await request(app)
        .get('/api/auth/admin-check')
        .set('Authorization', `Bearer ${userReg.body.accessToken}`);
      expect(denied.status).toBe(403);

      await User.create({
        name: 'Admin',
        email: 'adminrole@example.com',
        passwordHash: await bcrypt.hash('Password123', 4),
        role: 'ADMIN',
        isActive: true,
      });
      const adminLogin = await request(app).post('/api/auth/login').send({
        email: 'adminrole@example.com',
        password: 'Password123',
      });
      const allowed = await request(app)
        .get('/api/auth/admin-check')
        .set('Authorization', `Bearer ${adminLogin.body.accessToken}`);
      expect(allowed.status).toBe(200);
      expect(allowed.body.ok).toBe(true);
    });
  });

  describe('refresh + logout', () => {
    it('refreshes with valid cookie and rejects reused rotated token', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        name: 'Refresh User',
        email: 'refresh@example.com',
        password: 'Password123',
      });
      const cookies = reg.headers['set-cookie'] as string[] | string;
      const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      const refreshed = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader);
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.accessToken).toBeTypeOf('string');

      // Old cookie should no longer work after rotation
      const reuse = await request(app).post('/api/auth/refresh').set('Cookie', cookieHeader);
      expect(reuse.status).toBe(401);
    });

    it('rejects invalid refresh', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `${REFRESH_COOKIE_NAME}=invalid.token.value`);
      expect(res.status).toBe(401);
    });

    it('logout clears cookie and invalidates session', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        name: 'Logout User',
        email: 'logout@example.com',
        password: 'Password123',
      });
      const cookies = reg.headers['set-cookie'] as string[] | string;
      const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      const out = await request(app).post('/api/auth/logout').set('Cookie', cookieHeader);
      expect(out.status).toBe(200);

      const refreshAfter = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader);
      expect(refreshAfter.status).toBe(401);
    });
  });

  describe('forgot + reset password', () => {
    it('issues a reset link and updates password', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Reset User',
        email: 'reset@example.com',
        password: 'Password123',
      });

      const forgot = await request(app).post('/api/auth/forgot-password').send({
        email: 'reset@example.com',
      });
      expect(forgot.status).toBe(200);
      expect(forgot.body.message).toMatch(/password reset/i);
      expect(forgot.body.devResetUrl).toMatch(/\/reset-password\?token=/);

      const token = new URL(forgot.body.devResetUrl as string).searchParams.get('token');
      expect(token).toBeTruthy();

      const reset = await request(app).post('/api/auth/reset-password').send({
        token,
        password: 'NewPass456',
      });
      expect(reset.status).toBe(200);

      const oldLogin = await request(app).post('/api/auth/login').send({
        email: 'reset@example.com',
        password: 'Password123',
      });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app).post('/api/auth/login').send({
        email: 'reset@example.com',
        password: 'NewPass456',
      });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.accessToken).toBeTypeOf('string');
    });

    it('does not reveal whether email exists', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({
        email: 'missing@example.com',
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/password reset/i);
      expect(res.body.devResetUrl).toBeUndefined();
    });

    it('rejects invalid reset token', async () => {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: 'a'.repeat(40),
        password: 'NewPass456',
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
    });
  });

  describe('change password', () => {
    it('updates password when current password is correct', async () => {
      const reg = await request(app).post('/api/auth/register').send({
        name: 'Change User',
        email: 'change@example.com',
        password: 'Password123',
      });
      const token = reg.body.accessToken as string;

      const changed = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'Password123',
          newPassword: 'BetterPass99',
        });
      expect(changed.status).toBe(200);

      const oldLogin = await request(app).post('/api/auth/login').send({
        email: 'change@example.com',
        password: 'Password123',
      });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app).post('/api/auth/login').send({
        email: 'change@example.com',
        password: 'BetterPass99',
      });
      expect(newLogin.status).toBe(200);
    });
  });
});
