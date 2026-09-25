import { Router } from 'express';
import * as notifications from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';

export const notificationRoutes = Router()
  .use(requireAuth)
  .get('/', notifications.list)
  .post('/read-all', notifications.markAllRead)
  .patch('/:id/read', validate({ params: idParams }), notifications.markRead);
