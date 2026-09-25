import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { createAuthLimiters } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.schemas.js';

export function createAuthRouter() {
  const router = Router();
  const limit = createAuthLimiters();

  router.post('/register', limit.register, validate({ body: registerSchema }), auth.register);
  // Shares the sign-up limit: each demo is a new account.
  router.post('/demo', limit.register, auth.demo);
  router.post('/login', limit.login, validate({ body: loginSchema }), auth.login);
  router.post('/refresh', limit.refresh, auth.refresh);
  router.post('/logout', auth.logout);
  router.get('/me', requireAuth, auth.me);

  return router;
}
