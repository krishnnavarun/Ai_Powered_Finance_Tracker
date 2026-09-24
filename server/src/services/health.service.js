import { isDBConnected } from '../config/db.js';
import { redisStatus } from '../config/redis.js';

// The API is healthy when MongoDB is connected. Redis is optional, so it only
// makes the API unhealthy if it was configured and is now unreachable.
export function getHealth() {
  const mongo = isDBConnected() ? 'up' : 'down';
  const redis = redisStatus();
  const healthy = mongo === 'up' && redis !== 'down';

  return {
    healthy,
    status: healthy ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    services: { mongo, redis },
  };
}
