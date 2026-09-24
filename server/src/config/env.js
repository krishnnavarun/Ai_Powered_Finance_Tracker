import { z } from 'zod';

// Every environment variable the server reads is declared and validated here.
// Anything else in the code must import `env` from this file, never read process.env directly.

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_URL: z.url().default('http://localhost:5173'),

  MONGODB_URI: z
    .string({ error: 'MONGODB_URI is required' })
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  // Optional: without Redis the API still runs; caching, rate-limit store and jobs are disabled.
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, 'must start with redis:// or rediss://')
    .optional(),

  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
});

// Treat `KEY=` (empty value in .env) the same as not setting the key at all.
function dropEmptyValues(source) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
}

// Validates the given variables and returns a frozen config object. Throws with a readable list of problems.
export function loadEnv(source = process.env) {
  const result = envSchema.safeParse(dropEmptyValues(source));
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return Object.freeze(result.data);
}

function loadEnvOrExit() {
  try {
    return loadEnv();
  } catch (error) {
    // The logger depends on env, so this is the one place we print directly.
    // eslint-disable-next-line no-console
    console.error(`\n${error.message}\n\nCheck server/.env (see server/.env.example).\n`);
    process.exit(1);
  }
}

export const env = loadEnvOrExit();
