import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { sanitizeRequest } from './middleware/sanitize.js';
import apiRouter from './routes/index.js';

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

  // Render/Railway put the API behind a proxy; needed for correct client IPs in rate limiting.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(sanitizeRequest);

  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
