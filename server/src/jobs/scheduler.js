import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../config/logger.js';
import { runBudgetAlerts } from './alerts.job.js';
import { removeOldDemoAccounts } from './cleanup.job.js';
import { runWeeklyDigest } from './digest.job.js';
import { runNightlyInsights } from './insights.job.js';
import { runDueRecurring } from './recurring.job.js';

const QUEUE = 'paisa-pal-jobs';
const MINUTE = 60 * 1000;

// What runs when. Insights run at 2 AM India time, when nobody is using the app.
export const JOBS = {
  recurring: { every: 15 * MINUTE, run: () => runDueRecurring() },
  'budget-alerts': { every: 30 * MINUTE, run: () => runBudgetAlerts() },
  'demo-cleanup': { every: 60 * MINUTE, run: () => removeOldDemoAccounts() },
  insights: { pattern: '0 2 * * *', tz: 'Asia/Kolkata', hour: 2, run: () => runNightlyInsights() },
  // Mondays, 9 AM India time (weekday: 1 = Monday).
  'weekly-digest': {
    pattern: '0 9 * * 1',
    tz: 'Asia/Kolkata',
    hour: 9,
    weekday: 1,
    run: () => runWeeklyDigest(),
  },
};

async function runJob(name, jobs) {
  const started = Date.now();
  try {
    const result = await jobs[name].run();
    logger.info({ job: name, ms: Date.now() - started, result }, 'job done');
    return result;
  } catch (error) {
    logger.error({ job: name, err: error.message }, 'job failed');
    throw error;
  }
}

// With Redis: BullMQ keeps one schedule for all API/worker copies, retries failed runs
// and never runs the same job twice at once. Settings keep Redis traffic low
// (Upstash's free plan counts every command).
async function startWithBullMQ(redisUrl, jobs) {
  const connection = () => new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE, { connection: connection() });
  for (const [name, job] of Object.entries(jobs)) {
    await queue.upsertJobScheduler(
      name,
      job.pattern ? { pattern: job.pattern, tz: job.tz } : { every: job.every },
      { name, opts: { attempts: 2, backoff: { type: 'exponential', delay: MINUTE } } },
    );
  }
  const worker = new Worker(QUEUE, (job) => runJob(job.name, jobs), {
    connection: connection(),
    concurrency: 1,
    drainDelay: 60,
    stalledInterval: 5 * MINUTE,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  });
  worker.on('error', (err) => logger.error({ err: err.message }, 'worker error'));
  logger.info('Jobs scheduled with BullMQ');
  return async () => {
    await worker.close();
    await queue.close();
  };
}

// Without Redis: plain timers in this process. Fine for one server; with several
// copies each would run the jobs (the jobs themselves are safe to run twice).
function startWithTimers(jobs, { now = () => new Date() } = {}) {
  const timers = [];
  const lastRunDay = {};
  for (const [name, job] of Object.entries(jobs)) {
    if (job.every) {
      timers.push(setInterval(() => runJob(name, jobs).catch(() => {}), job.every));
      runJob(name, jobs).catch(() => {}); // once at start, too
    } else {
      // Daily or weekly job: check every 10 minutes whether it's time (and not done today).
      timers.push(
        setInterval(() => {
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: job.tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hourCycle: 'h23',
            weekday: 'short',
          }).formatToParts(now());
          const get = (type) => parts.find((p) => p.type === type).value;
          const day = `${get('year')}-${get('month')}-${get('day')}`;
          const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
          const rightDay = job.weekday === undefined || job.weekday === weekday;
          if (rightDay && Number(get('hour')) === job.hour && lastRunDay[name] !== day) {
            lastRunDay[name] = day;
            runJob(name, jobs).catch(() => {});
          }
        }, 10 * MINUTE),
      );
    }
  }
  logger.info('Jobs scheduled with in-process timers (no Redis)');
  return async () => timers.forEach(clearInterval);
}

// Starts the background jobs. Returns a function that stops them.
export async function startScheduler({ redisUrl, jobs = JOBS, now } = {}) {
  return redisUrl ? startWithBullMQ(redisUrl, jobs) : startWithTimers(jobs, { now });
}
