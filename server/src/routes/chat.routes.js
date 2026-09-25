import { Router } from 'express';
import * as chat from '../controllers/chat.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { createChatLimiters } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { createSessionSchema, sendMessageSchema } from '../validators/chat.schemas.js';
import { idParams } from '../validators/common.js';

// Built per app instance: the message limit's counters live here.
export function createChatRouter() {
  const limits = createChatLimiters();
  return Router()
    .use(requireAuth)
    .get('/sessions', chat.list)
    .post('/sessions', validate({ body: createSessionSchema }), chat.create)
    .get('/sessions/:id', validate({ params: idParams }), chat.get)
    .delete('/sessions/:id', validate({ params: idParams }), chat.remove)
    .post(
      '/sessions/:id/messages',
      limits.messages,
      validate({ params: idParams, body: sendMessageSchema }),
      chat.sendMessage,
    );
}
