import { z } from 'zod';
import { nonEmptyPatch, objectId, queryBoolean } from './common.js';

export const listInsightsQuery = z.object({
  includeDismissed: queryBoolean,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const updateInsightSchema = nonEmptyPatch(
  z.object({ seen: z.boolean(), dismissed: z.boolean() }),
);

export const markSeenSchema = z.object({ ids: z.array(objectId).min(1).max(100) });
