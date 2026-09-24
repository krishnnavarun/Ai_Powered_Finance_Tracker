import { rateLimit } from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';

// Counts requests per client IP. Uses in-memory counters, which is correct for a single
// API instance; a shared Redis store is added with the Redis/worker checkpoint (CP19).
function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(ApiError.tooManyRequests(message)),
  });
}

// Created per app instance (see createApp), so each app — and each test — has its own counters.
export function createAuthLimiters() {
  return {
    login: limiter({
      windowMs: 60 * 1000,
      limit: 5,
      message: 'Too many login attempts. Please wait a minute and try again.',
    }),
    register: limiter({
      windowMs: 60 * 60 * 1000,
      limit: 10,
      message: 'Too many sign-ups from this network. Please try again later.',
    }),
    refresh: limiter({
      windowMs: 60 * 1000,
      limit: 30,
      message: 'Too many requests. Please slow down.',
    }),
  };
}
