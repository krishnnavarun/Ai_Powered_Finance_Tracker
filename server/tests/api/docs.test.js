import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

describe('API docs', () => {
  it('serves an OpenAPI description built from the validators', async () => {
    const res = await request(createApp()).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    const login = res.body.paths['/auth/login'].post;
    expect(login.security).toEqual([]);
    expect(login.requestBody.content['application/json'].schema.required).toEqual(
      expect.arrayContaining(['email', 'password']),
    );
    expect(res.body.paths['/transactions'].get.parameters.map((p) => p.name)).toEqual(
      expect.arrayContaining(['from', 'to', 'q', 'page']),
    );
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(50);
  });

  it('shows the browsable reference', async () => {
    const res = await request(createApp()).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Paisa Pal API');
  });
});
