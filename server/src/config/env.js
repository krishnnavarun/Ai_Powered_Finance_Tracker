import { z } from 'zod';

// Every environment variable the server reads is declared and validated here.
// Anything else in the code must import `env` from this file, never read process.env directly.

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  // How many proxies sit in front of the API in production, so rate limits see the
  // real visitor IP: 1 = Render/Railway only; 2 = Vercel rewrite + Render (see README).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),

  MONGODB_URI: z
    .string({ error: 'MONGODB_URI is required' })
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://'),
  // Optional: without Redis the API still runs; caching, rate-limit store and jobs are disabled.
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, 'must start with redis:// or rediss://')
    .optional(),

  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  // Run the background jobs (recurring payments, alerts, insights) inside the API
  // instead of a separate `npm run worker` process.
  JOBS_IN_API: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  // Auth. Secrets must be long random strings and different from each other.
  JWT_ACCESS_SECRET: z
    .string({ error: 'JWT_ACCESS_SECRET is required' })
    .min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string({ error: 'JWT_REFRESH_SECRET is required' })
    .min(32, 'must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  // bcrypt cost factor. 12 in real use; tests lower it to stay fast.
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

  // Receipt photos. "local" saves them in UPLOAD_DIR (fine for development — a hosting
  // platform's disk is wiped on restart); "cloudinary" is for the deployed app.
  RECEIPT_STORAGE: z.enum(['local', 'cloudinary']).default('local'),
  UPLOAD_DIR: z.string().default('uploads'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // AI. Every AI feature is optional: without a key for the chosen provider the app
  // works as a normal tracker and AI buttons explain that AI is not set up.
  LLM_PROVIDER: z.enum(['gemini', 'openai', 'groq', 'ollama']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),
  // Leave empty for each provider's default (see src/ai/llm/adapter.js).
  LLM_MODEL_FAST: z.string().optional(),
  LLM_MODEL_SMART: z.string().optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),

  // Email for the weekly digest (optional; without it the digest is in-app only).
  // Resend has a free plan: https://resend.com
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(), // e.g. "Paisa Pal <digest@yourdomain.com>"
});

const CLOUDINARY_KEYS = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

const envSchemaWithChecks = envSchema
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ['JWT_REFRESH_SECRET'],
    message: 'must be different from JWT_ACCESS_SECRET',
  })
  .superRefine((env, ctx) => {
    if (env.RECEIPT_STORAGE !== 'cloudinary') return;
    for (const key of CLOUDINARY_KEYS) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'is required when RECEIPT_STORAGE=cloudinary',
        });
      }
    }
  });

// Treat `KEY=` (empty value in .env) the same as not setting the key at all.
function dropEmptyValues(source) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
}

// Validates the given variables and returns a frozen config object. Throws with a readable list of problems.
export function loadEnv(source = process.env) {
  const result = envSchemaWithChecks.safeParse(dropEmptyValues(source));
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
