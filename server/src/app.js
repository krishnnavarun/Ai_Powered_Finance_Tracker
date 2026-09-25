import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { sanitizeRequest } from './middleware/sanitize.js';
import { createApiRouter } from './routes/index.js';

const httpLogger = pinoHttp({
  logger,
  genReqId: (_req, res) => {
    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Health checks run every few seconds in production; don't flood the logs.
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  // Log method, url and status only — never bodies (they contain financial data).
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

// Builds the Express app without starting a server, so tests can use it with Supertest.
export function createApp() {
  const app = express();

  // In production the API sits behind proxies (Render, plus Vercel when the client
  // forwards /api). Trusting exactly that many hops gives rate limits the real visitor IP.
  if (env.NODE_ENV === 'production') app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());
  app.use(sanitizeRequest);

  app.use('/api', createApiRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
