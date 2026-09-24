import { Router } from 'express';
import { createAuthRouter } from './auth.routes.js';
import categoryRoutes from './category.routes.js';
import healthRoutes from './health.routes.js';
import transactionRoutes from './transaction.routes.js';
import walletRoutes from './wallet.routes.js';

// Every feature router is mounted here under /api. Built per app instance because
// some routers hold state (rate-limit counters).
export function createApiRouter() {
  const apiRouter = Router();

  apiRouter.use('/health', healthRoutes);
  apiRouter.use('/auth', createAuthRouter());
  apiRouter.use('/wallets', walletRoutes);
  apiRouter.use('/categories', categoryRoutes);
  apiRouter.use('/transactions', transactionRoutes);

  return apiRouter;
}
