import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { redactPaths } from '../../src/config/logger.js';

// Builds a logger with the app's redaction rules that writes JSON lines into an array.
function captureLogger() {
  const lines = [];
  const stream = { write: (line) => lines.push(JSON.parse(line)) };
  const log = pino({ redact: { paths: redactPaths, censor: '[redacted]' } }, stream);
  return { log, lines };
}

describe('logger redaction', () => {
  it('hides secrets at the top level', () => {
    const { log, lines } = captureLogger();
    log.info({ password: 'secret123', token: 'abc', email: 'a@b.com' }, 'login');
    expect(lines[0]).toMatchObject({
      password: '[redacted]',
      token: '[redacted]',
      email: 'a@b.com',
    });
  });

  it('hides secrets one object deep', () => {
    const { log, lines } = captureLogger();
    log.info({ user: { passwordHash: '$2b$12$...', name: 'Asha' }, auth: { refreshToken: 'r' } });
    expect(lines[0].user).toEqual({ passwordHash: '[redacted]', name: 'Asha' });
    expect(lines[0].auth.refreshToken).toBe('[redacted]');
  });

  it('hides auth headers and cookies on requests', () => {
    const { log, lines } = captureLogger();
    log.info({ req: { headers: { authorization: 'Bearer x', cookie: 'rt=y', host: 'api' } } });
    expect(lines[0].req.headers).toEqual({
      authorization: '[redacted]',
      cookie: '[redacted]',
      host: 'api',
    });
  });
});
