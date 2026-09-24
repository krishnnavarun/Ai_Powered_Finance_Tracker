import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const minimal = {
  MONGODB_URI: 'mongodb://localhost:27017/paisa-pal',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('loadEnv', () => {
  it('applies defaults when only the required values are set', () => {
    const env = loadEnv(minimal);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 5000,
      CLIENT_URL: 'http://localhost:5173',
      MONGODB_URI: minimal.MONGODB_URI,
      ACCESS_TOKEN_TTL_MINUTES: 15,
      REFRESH_TOKEN_TTL_DAYS: 7,
      BCRYPT_ROUNDS: 12,
    });
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('coerces PORT to a number', () => {
    expect(loadEnv({ ...minimal, PORT: '8080' }).PORT).toBe(8080);
  });

  it('accepts Atlas (mongodb+srv) and Upstash (rediss) URLs', () => {
    const env = loadEnv({
      ...minimal,
      MONGODB_URI: 'mongodb+srv://user:pass@cluster0.example.mongodb.net/paisa-pal',
      REDIS_URL: 'rediss://default:token@example.upstash.io:6379',
    });
    expect(env.REDIS_URL).toMatch(/^rediss:/);
  });

  it('treats empty values as not set', () => {
    const env = loadEnv({ ...minimal, REDIS_URL: '', PORT: '' });
    expect(env.REDIS_URL).toBeUndefined();
    expect(env.PORT).toBe(5000);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(loadEnv(minimal))).toBe(true);
  });

  it('fails when MONGODB_URI is missing', () => {
    expect(() => loadEnv({})).toThrow(/MONGODB_URI: MONGODB_URI is required/);
  });

  it.each([
    [{ MONGODB_URI: 'postgres://localhost/db' }, /MONGODB_URI: must start with mongodb/],
    [{ ...minimal, REDIS_URL: 'http://localhost:6379' }, /REDIS_URL: must start with redis/],
    [{ ...minimal, PORT: 'abc' }, /PORT/],
    [{ ...minimal, NODE_ENV: 'staging' }, /NODE_ENV/],
    [{ ...minimal, CLIENT_URL: 'not a url' }, /CLIENT_URL/],
    [{ ...minimal, LOG_LEVEL: 'loud' }, /LOG_LEVEL/],
  ])('rejects invalid config %j', (source, message) => {
    expect(() => loadEnv(source)).toThrow(message);
  });

  it('requires both JWT secrets', () => {
    expect(() => loadEnv({ MONGODB_URI: minimal.MONGODB_URI })).toThrow(
      /JWT_ACCESS_SECRET is required[\s\S]*JWT_REFRESH_SECRET is required/,
    );
  });

  it('rejects short JWT secrets', () => {
    expect(() => loadEnv({ ...minimal, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET: must be at least 32 characters/,
    );
  });

  it('rejects identical access and refresh secrets', () => {
    expect(() => loadEnv({ ...minimal, JWT_REFRESH_SECRET: minimal.JWT_ACCESS_SECRET })).toThrow(
      /JWT_REFRESH_SECRET: must be different from JWT_ACCESS_SECRET/,
    );
  });

  it('rejects a bcrypt cost outside 4-15', () => {
    expect(() => loadEnv({ ...minimal, BCRYPT_ROUNDS: '20' })).toThrow(/BCRYPT_ROUNDS/);
  });

  it('lists every problem at once', () => {
    expect(() => loadEnv({ PORT: 'abc', NODE_ENV: 'staging' })).toThrow(
      /PORT[\s\S]*NODE_ENV|NODE_ENV[\s\S]*PORT/,
    );
  });
});
