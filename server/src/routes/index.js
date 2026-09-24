import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import healthRoutes from './health.routes.js';

// Every feature router is mounted here under /api. Built per app instance because
// some routers hold state (rate-limit counters).
export function createApiRouter() {
  const apiRouter = Router();

  apiRouter.use('/health', healthRoutes);
  apiRouter.use('/auth', createAuthRouter());

  return apiRouter;
}
