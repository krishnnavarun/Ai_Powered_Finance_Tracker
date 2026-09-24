import request from 'supertest';

let counter = 0;

// Registers a fresh user and returns helpers for making authenticated requests:
//   const asha = await signUp(app);
//   await asha.get('/api/wallets');
//   await asha.post('/api/wallets').send({ ... });
export async function signUp(app, overrides = {}) {
  counter += 1;
  const body = {
    name: 'Test User',
    email: `user${counter}-${Date.now()}@example.com`,
    password: 'password123',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 201) {
    throw new Error(`signUp failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  const { user, accessToken } = res.body.data;
  const withAuth = (req) => req.set('Authorization', `Bearer ${accessToken}`);

  return {
    user,
    accessToken,
    get: (url) => withAuth(request(app).get(url)),
    post: (url) => withAuth(request(app).post(url)),
    patch: (url) => withAuth(request(app).patch(url)),
    delete: (url) => withAuth(request(app).delete(url)),
  };
}
