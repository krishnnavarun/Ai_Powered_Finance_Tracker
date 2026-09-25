import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { resetLLMAfterEach, useFakeLLM, useNoLLM } from '../helpers/fakeLLM.js';

let asha;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  asha = await signUp(createApp(), { name: 'Asha' });
});
afterEach(clearTestDB);
resetLLMAfterEach();

describe('GET /api/ai/status', () => {
  it('reports a configured provider and the user’s switch', async () => {
    useFakeLLM({});
    const res = await asha.get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ enabled: true, configured: true, provider: 'fake' });

    await asha.patch('/api/users/me/settings').send({ aiEnabled: false });
    const off = await asha.get('/api/ai/status');
    expect(off.body.data.enabled).toBe(false);
  });

  it('says when AI is not set up on the server', async () => {
    useNoLLM();
    const res = await asha.get('/api/ai/status');
    expect(res.body.data).toEqual({ enabled: true, configured: false, provider: null });
  });

  it('needs a login', async () => {
    const res = await asha.get('/api/ai/status').set('Authorization', '');
    expect(res.status).toBe(401);
  });
});
