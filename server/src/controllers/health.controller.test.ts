import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../config/database.js', () => ({
  getDatabaseStatus: () => ({
    readyState: 1,
    readyStateLabel: 'connected',
  }),
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}));

vi.mock('../config/env.js', () => ({
  loadEnv: () => ({
    NODE_ENV: 'test',
    PORT: 15190,
    MONGODB_URI: 'mongodb://127.0.0.1:27017/turfscore-test',
    CLIENT_URL: 'http://localhost:5190',
    JWT_ACCESS_SECRET: 'test-access-secret-min-32-characters!!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-characters!',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    LOG_LEVEL: 'silent',
  }),
}));

describe('GET /api/health', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(async () => {
    const mod = await import('../app.js');
    app = mod.createApp();
  });

  it('returns ok when database is connected', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('turfscore-api');
    expect(res.body.database.status).toBe('connected');
  });

  it('also responds on /health alias', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
