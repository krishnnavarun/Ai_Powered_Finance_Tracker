import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { startScheduler } from './jobs/scheduler.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start() {
  await connectDB(env.MONGODB_URI);
  await connectRedis(env.REDIS_URL);

  const stopJobs = env.JOBS_IN_API ? await startScheduler({ redisUrl: env.REDIS_URL }) : null;

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API ready on http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  });

  // Stop accepting requests, let in-flight ones finish, then close DB connections.
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down`);

    server.close(async () => {
      await stopJobs?.().catch(() => {});
      await Promise.allSettled([disconnectDB(), disconnectRedis()]);
      logger.info('Shutdown complete');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start the API');
  process.exit(1);
});
