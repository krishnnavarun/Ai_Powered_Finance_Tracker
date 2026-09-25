import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { buildOpenApi } from '../docs/openapi.js';
import { createAiRouter } from './ai.routes.js';
import { createAuthRouter } from './auth.routes.js';
import categoryRoutes from './category.routes.js';
import { createChatRouter } from './chat.routes.js';
import healthRoutes from './health.routes.js';
import { createImportRouter } from './import.routes.js';
import { insightRoutes } from './insight.routes.js';
import { notificationRoutes } from './notification.routes.js';
import { budgetRoutes, goalRoutes, recurringRoutes } from './planning.routes.js';
import { reportRoutes } from './reports.routes.js';
import transactionRoutes from './transaction.routes.js';
import { userRoutes } from './user.routes.js';
import walletRoutes from './wallet.routes.js';

// Every feature router is mounted here under /api. Built per app instance because
// some routers hold state (rate-limit counters).
export function createApiRouter() {
  const apiRouter = Router();

  apiRouter.use('/health', healthRoutes);

  // API reference: /api/docs (browsable) and /api/openapi.json.
  const spec = buildOpenApi();
  apiRouter.get('/openapi.json', (_req, res) => res.json(spec));
  apiRouter.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, { customSiteTitle: 'Paisa Pal API' }),
  );
  apiRouter.use('/auth', createAuthRouter());
  apiRouter.use('/users', userRoutes);
  apiRouter.use('/wallets', walletRoutes);
  apiRouter.use('/categories', categoryRoutes);
  apiRouter.use('/transactions', transactionRoutes);
  apiRouter.use('/budgets', budgetRoutes);
  apiRouter.use('/goals', goalRoutes);
  apiRouter.use('/recurring', recurringRoutes);
  apiRouter.use('/reports', reportRoutes);
  apiRouter.use('/ai', createAiRouter());
  apiRouter.use('/import', createImportRouter());
  apiRouter.use('/insights', insightRoutes);
  apiRouter.use('/notifications', notificationRoutes);
  apiRouter.use('/chat', createChatRouter());

  return apiRouter;
}
