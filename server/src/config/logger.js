import pino from 'pino';
import { env } from './env.js';

function defaultLevel() {
  if (env.NODE_ENV === 'test') return 'silent';
  if (env.NODE_ENV === 'production') return 'info';
  return 'debug';
}

const SECRET_KEYS = ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken'];

// Never write credentials or tokens to the logs — at the top level or one object deep.
export const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  ...SECRET_KEYS,
  ...SECRET_KEYS.map((key) => `*.${key}`),
];

export const logger = pino({
  level: env.LOG_LEVEL ?? defaultLevel(),
  redact: { paths: redactPaths, censor: '[redacted]' },
  // Human-readable output while developing; plain JSON lines in production.
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        }
      : undefined,
});
