import { z } from 'zod';
import { logger } from '../config/logger.js';
import { Category } from '../models/Category.js';
import { MerchantMap } from '../models/MerchantMap.js';
import { normalizeMerchant } from '../utils/merchant.js';
import { ruleCategory } from './categoryRules.js';
import { generateJSON } from './llm/adapter.js';
import { asData, DATA_RULES } from './prompts/common.js';

export const AI_BATCH_SIZE = 50;

// How sure each step is. Memory is the user's own choice, so it is certain.
export const CONFIDENCE = { memory: 1, rule: 0.85 };

const aiReply = z.object({
  results: z.array(
    z.object({
      index: z.int().min(0),
      categoryName: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

// Case-insensitive name → active category of the given type.
export function categoryByName(categories, type, name) {
  if (!name) return null;
  const wanted = name.trim().toLowerCase();
  return (
    categories.find((c) => c.type === type && !c.isArchived && c.name.toLowerCase() === wanted) ??
    null
  );
}

async function askAI(userId, categories, items) {
  const names = (type) =>
    categories
      .filter((c) => c.type === type && !c.isArchived)
      .map((c) => c.name)
      .join(', ');
  const lines = items
    .map(
      ({ index, item }) => `${index}. ${item.type}: ${item.merchant || '-'} | ${item.note || '-'}`,
    )
    .join('\n');

  const reply = await generateJSON({
    userId,
    purpose: 'categorize',
    schema: aiReply,
    system: [
      'You sort personal payments in India into categories.',
      DATA_RULES,
      `Expense categories: ${names('expense')}.`,
      `Income categories: ${names('income')}.`,
      'For each numbered line pick one category of the matching type, using its exact name, or null if unsure. ' +
        'Give a confidence from 0 to 1.',
    ].join('\n'),
    user: `Return { "results": [{ "index", "categoryName", "confidence" }] } for:\n${asData('payments', lines)}`,
  });
  return reply.results;
}

// Suggests a category for each item: { type, merchant?, note? }.
// Order: 1. the user's own past choice for this merchant, 2. keyword rules,
// 3. AI (only when `useAI`, in batches of 50). Returns, in the same order,
// { categoryId, confidence, via: 'memory' | 'rule' | 'ai' | null }.
export async function suggestCategories(userId, items, { useAI = false } = {}) {
  const categories = await Category.find({ userId }).lean();
  const active = categories.filter((c) => !c.isArchived);
  const byId = new Map(active.map((c) => [String(c._id), c]));
  const bySystemKey = new Map(active.filter((c) => c.systemKey).map((c) => [c.systemKey, c]));

  const keys = items.map((item) => normalizeMerchant(item.merchant));
  const memory = await MerchantMap.find({
    userId,
    merchantKey: { $in: [...new Set(keys.filter(Boolean))] },
  }).lean();
  const remembered = new Map(memory.map((m) => [m.merchantKey, String(m.categoryId)]));

  const results = items.map((item, index) => {
    if (item.type === 'transfer') return { categoryId: null, confidence: null, via: null };

    const fromMemory = byId.get(remembered.get(keys[index]));
    if (fromMemory?.type === item.type) {
      return { categoryId: String(fromMemory._id), confidence: CONFIDENCE.memory, via: 'memory' };
    }
    const fromRule = bySystemKey.get(ruleCategory(item));
    if (fromRule) {
      return { categoryId: String(fromRule._id), confidence: CONFIDENCE.rule, via: 'rule' };
    }
    return { categoryId: null, confidence: null, via: null };
  });

  const unknown = results
    .map((result, index) => ({ result, index, item: items[index] }))
    .filter(({ result, item }) => !result.categoryId && item.type !== 'transfer')
    .filter(({ item }) => item.merchant || item.note);

  if (useAI && unknown.length) {
    for (let start = 0; start < unknown.length; start += AI_BATCH_SIZE) {
      const batch = unknown.slice(start, start + AI_BATCH_SIZE);
      try {
        const answers = await askAI(userId, categories, batch);
        for (const answer of answers) {
          const entry = batch.find((b) => b.index === answer.index);
          const category =
            entry && categoryByName(categories, entry.item.type, answer.categoryName);
          if (category) {
            results[entry.index] = {
              categoryId: String(category._id),
              confidence: answer.confidence,
              via: 'ai',
            };
          }
        }
      } catch (error) {
        // AI is a bonus here: the items simply stay uncategorised.
        logger.warn({ userId, err: error.message }, 'AI categorize failed');
      }
    }
  }
  return results;
}

// Remembers the user's choices — [{ merchantKey, categoryId }] — so the same merchants are
// filed the same way next time. Learning is a bonus: a failure is logged, never thrown.
export async function learnCategories(userId, entries) {
  // One entry per merchant; the last choice wins.
  const latest = new Map(
    entries.filter((e) => e.merchantKey && e.categoryId).map((e) => [e.merchantKey, e.categoryId]),
  );
  if (!latest.size) return;
  try {
    await MerchantMap.bulkWrite(
      [...latest].map(([merchantKey, categoryId]) => ({
        updateOne: {
          filter: { userId, merchantKey },
          update: { $set: { categoryId, lastUsedAt: new Date() }, $inc: { hits: 1 } },
          upsert: true,
        },
      })),
    );
  } catch (error) {
    logger.warn({ userId, err: error.message }, 'could not update merchant memory');
  }
}
