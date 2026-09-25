import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRateLimitRedis } from '../config/redis.js';
import { ApiError } from '../utils/ApiError.js';

// With Redis, counters are shared by every copy of the API (so limits hold when there
// are several); without it they live in this process's memory.
function storeFor(name) {
  const redis = getRateLimitRedis();
  if (!redis) return undefined;
  return new RedisStore({
    prefix: `rl:${name}:`,
    sendCommand: (command, ...args) => redis.call(command, ...args),
  });
}

// Counts requests per client IP (or per user, with keyGenerator). If Redis fails
// mid-way the request is let through rather than blocked (passOnStoreError).
function limiter({ name, windowMs, limit, message, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    store: storeFor(name),
    passOnStoreError: true,
    ...(keyGenerator ? { keyGenerator } : {}),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(ApiError.tooManyRequests(message)),
  });
}

// Created per app instance (see createApp), so each app — and each test — has its own counters.
export function createAuthLimiters() {
  return {
    login: limiter({
      name: 'login',
      windowMs: 60 * 1000,
      limit: 5,
      message: 'Too many login attempts. Please wait a minute and try again.',
    }),
    register: limiter({
      name: 'register',
      windowMs: 60 * 60 * 1000,
      limit: 10,
      message: 'Too many sign-ups from this network. Please try again later.',
    }),
    refresh: limiter({
      name: 'refresh',
      windowMs: 60 * 1000,
      limit: 30,
      message: 'Too many requests. Please slow down.',
    }),
  };
}

// AI calls cost money, so they are limited per user (not per IP). Must run after requireAuth.
export function createAiLimiters() {
  return {
    ai: limiter({
      name: 'ai',
      windowMs: 60 * 1000,
      limit: 20,
      message: 'Too many AI requests. Please wait a minute and try again.',
      keyGenerator: (req) => `user:${req.user.id}`,
    }),
  };
}

// The assistant: 30 questions an hour per user.
export function createChatLimiters() {
  return {
    messages: limiter({
      name: 'chat',
      windowMs: 60 * 60 * 1000,
      limit: 30,
      message: 'You’ve asked a lot this hour. Please try again a bit later.',
      keyGenerator: (req) => `user:${req.user.id}`,
    }),
  };
}
