import { Redis } from 'ioredis';
import { logger } from './logger.js';

let client = null;
let rateLimitClient = null;

// Connects to Redis if a URL is configured. Redis is optional: when it is missing or
// unreachable the API keeps running and only cache / queue features are unavailable.
export async function connectRedis(url) {
  if (!url) {
    logger.warn('REDIS_URL not set — Redis features (cache, queues) are disabled');
    return null;
  }

  // maxRetriesPerRequest: null is required by BullMQ, which will share this connection style.
  client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
  client.on('error', (err) => logger.error({ err: err.message }, 'Redis error'));

  try {
    await client.connect();
    logger.info('Redis connected');
  } catch (err) {
    logger.error({ err: err.message }, 'Redis connection failed — continuing without Redis');
  }

  // A separate connection for rate limits that never queues commands: if Redis goes
  // away, a limit check fails at once (and the request is let through) instead of
  // hanging the request until Redis comes back.
  rateLimitClient = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });
  rateLimitClient.on('error', () => {}); // reported by the main client already
  await rateLimitClient.connect().catch(() => {});
  return client;
}

// The rate-limit connection, only while it is ready (else limits use memory).
export function getRateLimitRedis() {
  return rateLimitClient?.status === 'ready' ? rateLimitClient : null;
}

export function getRedis() {
  return client;
}

// 'up' | 'down' | 'disabled' — used by the health check.
export function redisStatus() {
  if (!client) return 'disabled';
  return client.status === 'ready' ? 'up' : 'down';
}

export async function disconnectRedis() {
  if (rateLimitClient) {
    await rateLimitClient.quit().catch(() => rateLimitClient.disconnect());
    rateLimitClient = null;
  }
  if (!client) return;
  await client.quit().catch(() => client.disconnect());
  client = null;
}
