import { Router } from 'express';
import * as users from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  deleteAccountSchema,
  updateProfileSchema,
  updateSettingsSchema,
} from '../validators/user.schemas.js';

export const userRoutes = Router()
  .use(requireAuth)
  .patch('/me', validate({ body: updateProfileSchema }), users.updateProfile)
  .patch('/me/settings', validate({ body: updateSettingsSchema }), users.updateSettings)
  .get('/me/export', users.exportData)
  .delete('/me', validate({ body: deleteAccountSchema }), users.deleteAccount);
