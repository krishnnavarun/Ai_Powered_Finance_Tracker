import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { startTestDB, stopTestDB } from '../helpers/db.js';

beforeAll(startTestDB);
afterAll(stopTestDB);

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
