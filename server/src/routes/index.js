import { Router } from 'express';
import healthRoutes from './health.routes.js';

// Every feature router is mounted here under /api.
const apiRouter = Router();

apiRouter.use('/health', healthRoutes);

export default apiRouter;
