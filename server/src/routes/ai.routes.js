import { Router } from 'express';
import * as ai from '../controllers/ai.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { createAiLimiters } from '../middleware/rateLimit.js';
import { receiptUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  budgetSuggestionsQuery,
  categorizeSchema,
  parseSmsSchema,
  parseTextSchema,
  receiptTextSchema,
  subscriptionStatusSchema,
  whatIfSchema,
} from '../validators/ai.schemas.js';

// Built per app instance: the rate-limit counters live in the router.
export function createAiRouter() {
  const limits = createAiLimiters();
  const router = Router().use(requireAuth);

  router.get('/status', ai.status);

  // Analytics: plain maths on the user's own data (no AI, so no AI rate limit).
  router.get('/forecast', ai.forecast);
  router.get('/health-score', ai.healthScore);
  router.get('/anomalies', ai.anomalies);
  router.get('/subscriptions', ai.subscriptions);
  router.patch(
    '/subscriptions/:id',
    validate({ params: idParams, body: subscriptionStatusSchema }),
    ai.setSubscriptionStatus,
  );
  router.get(
    '/budget-suggestions',
    validate({ query: budgetSuggestionsQuery }),
    ai.budgetSuggestions,
  );
  router.post('/what-if', validate({ body: whatIfSchema }), ai.whatIf);

  // These may call the AI provider, so they are rate-limited per user. They still work
  // when AI is off or down (plain parsing), so they aren't behind requireAI.
  router.post('/parse/text', limits.ai, validate({ body: parseTextSchema }), ai.parseText);
  router.post('/parse/sms', limits.ai, validate({ body: parseSmsSchema }), ai.parseSms);
  // Photo → AI vision (needs AI). Field "receipt", JPG/PNG/WebP up to 5 MB.
  router.post('/parse/receipt', limits.ai, receiptUpload, ai.parseReceipt);
  // Text read from the photo on the user's device, for when AI is off.
  router.post(
    '/parse/receipt-text',
    limits.ai,
    validate({ body: receiptTextSchema }),
    ai.parseReceiptText,
  );
  router.post('/categorize', limits.ai, validate({ body: categorizeSchema }), ai.categorize);

  return router;
}
