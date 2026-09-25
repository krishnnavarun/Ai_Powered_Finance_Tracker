import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startScheduler } from './jobs/scheduler.js';

// Background worker: recurring payments, budget alerts and nightly insights.
// Run with `npm run worker`, or set JOBS_IN_API=true to run them inside the API
// (hosting plans without background workers, e.g. Render's free plan).
async function start() {
  await connectDB(env.MONGODB_URI);
  const stop = await startScheduler({ redisUrl: env.REDIS_URL });
  logger.info('Worker running');

  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info(`${signal} received — stopping worker`);
    await stop().catch(() => {});
    await disconnectDB().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
