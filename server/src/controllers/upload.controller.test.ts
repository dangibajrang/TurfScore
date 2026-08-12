/**
 * @vitest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../app.js';
import { resetEnvCache } from '../config/env.js';
import { UPLOADS_DIR } from '../middleware/upload.js';

describe('image uploads + profile image', () => {
  let mongo: MongoMemoryServer;
  let agent: ReturnType<typeof request.agent>;
  let accessToken = '';

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    resetEnvCache();
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-characters!!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters!';
    process.env.CLIENT_URL = 'http://localhost:5190';
    resetEnvCache();
    await mongoose.connect(mongo.getUri());
    const app = createApp();
    agent = request.agent(app);

    const register = await agent.post('/api/auth/register').send({
      name: 'Uploader',
      email: 'uploader@example.com',
      password: 'Password123!',
    });
    expect(register.status).toBe(201);
    accessToken = register.body.accessToken as string;
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('uploads an image and sets it on the user profile', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const upload = await agent
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('image', png, { filename: 'dot.png', contentType: 'image/png' });

    expect(upload.status).toBe(201);
    expect(upload.body.url).toMatch(/^\/uploads\//);

    const patch = await agent
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ profileImageUrl: upload.body.url });

    expect(patch.status).toBe(200);
    expect(patch.body.profileImage).toBe(upload.body.url);

    const filename = path.basename(upload.body.url as string);
    expect(fs.existsSync(path.join(UPLOADS_DIR, filename))).toBe(true);
  });
});
