import { Router } from 'express';
import * as insights from '../controllers/insight.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  listInsightsQuery,
  markSeenSchema,
  updateInsightSchema,
} from '../validators/insight.schemas.js';

export const insightRoutes = Router()
  .use(requireAuth)
  .get('/', validate({ query: listInsightsQuery }), insights.list)
  .post('/refresh', insights.refresh)
  .post('/seen', validate({ body: markSeenSchema }), insights.markSeen)
  .patch('/:id', validate({ params: idParams, body: updateInsightSchema }), insights.update);
