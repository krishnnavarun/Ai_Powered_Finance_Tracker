import { Router } from 'express';
import * as imports from '../controllers/import.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { createAiLimiters } from '../middleware/rateLimit.js';
import { statementUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { commitCsvSchema, previewCsvSchema } from '../validators/import.schemas.js';

// Built per app instance: the preview may call the AI, so it shares the AI rate limit.
export function createImportRouter() {
  const limits = createAiLimiters();
  return Router()
    .use(requireAuth)
    .post(
      '/csv/preview',
      limits.ai,
      statementUpload,
      validate({ body: previewCsvSchema }),
      imports.preview,
    )
    .post('/csv/commit', validate({ body: commitCsvSchema }), imports.commit);
}
