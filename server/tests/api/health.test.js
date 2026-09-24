import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/db.js';

// Uses a real (in-memory) MongoDB, so no local database or Docker is needed.
let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connectDB(mongo.getUri());
});

afterAll(async () => {
  await disconnectDB();
  await mongo?.stop();
});

describe('GET /api/health (database connected)', () => {
  it('returns 200 with Mongo up', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { status: 'ok', services: { mongo: 'up', redis: 'disabled' } },
    });
  });
});
