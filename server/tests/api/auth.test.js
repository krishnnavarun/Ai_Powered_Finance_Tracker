import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { User } from '../../src/models/User.js';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from '../../src/services/token.service.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';

const asha = { name: 'Asha Rao', email: 'asha@example.com', password: 'biryani2024' };

let app;

beforeAll(startTestDB);
afterAll(stopTestDB);
// A fresh app per test also gives fresh rate-limit counters.
beforeEach(() => {
  app = createApp();
});
afterEach(clearTestDB);

// "pp_rt=abc; Path=/api/auth; HttpOnly; ..." → the full Set-Cookie line for the refresh cookie.
function refreshSetCookie(res) {
  return (res.headers['set-cookie'] ?? []).find((line) => line.startsWith('pp_rt='));
}

// → "pp_rt=abc", ready to send back in a Cookie header.
function refreshCookie(res) {
  return refreshSetCookie(res)?.split(';')[0];
}

const register = (body = asha) => request(app).post('/api/auth/register').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);
const refresh = (cookie) => {
  const req = request(app).post('/api/auth/refresh');
  return cookie ? req.set('Cookie', cookie) : req;
};
const me = (token) => request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

describe('POST /api/auth/register', () => {
  it('creates the user and starts a session', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      name: 'Asha Rao',
      email: 'asha@example.com',
      currency: 'INR',
      monthStartDay: 1,
      timezone: 'Asia/Kolkata',
      settings: { aiEnabled: true, digestEmail: true, budgetAlerts: true, theme: 'system' },
      onboardingDone: false,
    });
    expect(res.body.data.user.id).toMatch(/^[a-f0-9]{24}$/);
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('never returns the password hash or internal fields', async () => {
    const { user } = (await register()).body.data;
    expect(user).not.toHaveProperty('passwordHash');
    expect(user).not.toHaveProperty('_id');
    expect(user).not.toHaveProperty('__v');
  });

  it('stores a bcrypt hash, not the password', async () => {
    await register();
    const stored = await User.findOne({ email: asha.email }).select('+passwordHash');
    expect(stored.passwordHash).not.toBe(asha.password);
    expect(await bcrypt.compare(asha.password, stored.passwordHash)).toBe(true);
    expect(bcrypt.getRounds(stored.passwordHash)).toBe(env.BCRYPT_ROUNDS);
  });

  it('sets a secure refresh cookie scoped to /api/auth', async () => {
    const cookie = refreshSetCookie(await register());
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Max-Age=604800/); // 7 days
  });

  it('normalises the email to lower case', async () => {
    const res = await register({ ...asha, email: '  Asha@Example.COM ' });
    expect(res.body.data.user.email).toBe('asha@example.com');
  });

  it('rejects a duplicate email with 409 EMAIL_TAKEN', async () => {
    await register();
    const res = await register({ ...asha, email: 'ASHA@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it.each([
    ['short', 'at least 8 characters'],
    ['onlyletters', 'must contain a number'],
    ['12345678', 'must contain a letter'],
    ['a1'.repeat(40), 'too long'],
  ])('rejects weak password %j', async (password, message) => {
    const res = await register({ ...asha, password });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toContainEqual({
      path: 'password',
      message: expect.stringContaining(message),
    });
  });

  it('lists every invalid field at once', async () => {
    const res = await register({ name: '', email: 'not-an-email' });
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('ignores extra fields instead of saving them', async () => {
    await register({ ...asha, onboardingDone: true, currency: 'USD' });
    const stored = await User.findOne({ email: asha.email });
    expect(stored.onboardingDone).toBe(false);
    expect(stored.currency).toBe('INR');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('logs in with the right password', async () => {
    const res = await login({ email: asha.email, password: asha.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(asha.email);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(refreshCookie(res)).toBeTruthy();
  });

  it('accepts the email in any case', async () => {
    const res = await login({ email: 'ASHA@EXAMPLE.COM', password: asha.password });
    expect(res.status).toBe(200);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await login({ email: asha.email, password: 'wrong-pass1' });
    const unknownEmail = await login({ email: 'nobody@example.com', password: asha.password });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        code: 'INVALID_CREDENTIALS',
        message: 'Incorrect email or password',
      });
      expect(refreshCookie(res)).toBeUndefined();
    }
  });

  it('blocks MongoDB operator injection in the email field', async () => {
    const res = await login({ email: { $gt: '' }, password: asha.password });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('limits login attempts to 5 per minute per IP', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await login({ email: asha.email, password: 'wrong-pass1' });
      expect(res.status).toBe(401);
    }
    const blocked = await login({ email: asha.email, password: asha.password });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(blocked.headers).toHaveProperty('ratelimit-policy');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid access token', async () => {
    const { accessToken, user } = (await register()).body.data;
    const res = await me(accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual(user);
  });

  it('requires a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a garbage token', async () => {
    expect((await me('not.a.token')).status).toBe(401);
  });

  it('says TOKEN_EXPIRED for an expired token so the client can refresh', async () => {
    const { user } = (await register()).body.data;
    const expired = jwt.sign({}, env.JWT_ACCESS_SECRET, {
      subject: user.id,
      expiresIn: -10,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    const res = await me(expired);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects a token signed with another secret', async () => {
    const { user } = (await register()).body.data;
    const forged = jwt.sign({}, 'x'.repeat(40), {
      subject: user.id,
      expiresIn: '15m',
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    const res = await me(forged);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an unsigned ("alg: none") token', async () => {
    const { user } = (await register()).body.data;
    const unsigned = jwt.sign({ sub: user.id }, null, {
      algorithm: 'none',
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    expect((await me(unsigned)).status).toBe(401);
  });

  it('rejects the token of a deleted account', async () => {
    const { accessToken, user } = (await register()).body.data;
    await User.deleteOne({ _id: user.id });
    expect((await me(accessToken)).status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns a new access token and rotates the refresh cookie', async () => {
    const first = refreshCookie(await register());
    const res = await refresh(first);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(asha.email);
    expect((await me(res.body.data.accessToken)).status).toBe(200);
    const second = refreshCookie(res);
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('keeps working through several rotations', async () => {
    let cookie = refreshCookie(await register());
    for (let i = 0; i < 3; i++) {
      const res = await refresh(cookie);
      expect(res.status).toBe(200);
      cookie = refreshCookie(res);
    }
  });

  it('requires the refresh cookie', async () => {
    const res = await refresh();
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('rejects an unknown refresh token and clears the cookie', async () => {
    const res = await refresh('pp_rt=made-up-token');
    expect(res.status).toBe(401);
    expect(refreshSetCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('detects reuse of an old token and ends the whole session', async () => {
    const stolen = refreshCookie(await register());
    const legit = refreshCookie(await refresh(stolen)); // the real user refreshes

    // Attacker replays the old token.
    const replay = await refresh(stolen);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // The real user's current token was revoked too — everyone must log in again.
    const after = await refresh(legit);
    expect(after.status).toBe(401);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
  });

  it('rejects an expired refresh token', async () => {
    const cookie = refreshCookie(await register());
    await RefreshToken.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    expect((await refresh(cookie)).status).toBe(401);
  });

  it('stores only a hash of the refresh token', async () => {
    const raw = refreshCookie(await register()).slice('pp_rt='.length);
    const stored = await RefreshToken.findOne();
    expect(stored.tokenHash).not.toBe(raw);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token and clears the cookie', async () => {
    const cookie = refreshCookie(await register());

    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(refreshSetCookie(res)).toMatch(/pp_rt=;/);

    const after = await refresh(cookie);
    expect(after.status).toBe(401);
    // A logged-out token is simply invalid — not treated as theft.
    expect(after.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('succeeds even without a cookie', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });

  it('only ends this device’s session', async () => {
    const phone = refreshCookie(await register());
    const laptop = refreshCookie(await login({ email: asha.email, password: asha.password }));

    await request(app).post('/api/auth/logout').set('Cookie', phone);

    expect((await refresh(laptop)).status).toBe(200);
  });
});
