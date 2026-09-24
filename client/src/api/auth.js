import { api } from './client';

// Thin wrappers around the /auth endpoints. Each returns the `data` part of the response.

export async function login({ email, password }) {
  const res = await api.post('/auth/login', { email, password });
  return res.data.data; // { user, accessToken }
}

export async function register({ name, email, password }) {
  const res = await api.post('/auth/register', { name, email, password });
  return res.data.data; // { user, accessToken }
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function fetchMe() {
  const res = await api.get('/auth/me');
  return res.data.data.user;
}
