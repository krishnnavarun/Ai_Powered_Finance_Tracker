import { Insight } from '../models/Insight.js';
import { Notification } from '../models/Notification.js';
import { findOwnedOrThrow } from './ownership.js';

// Saves insights once each: an insight whose dedupeKey already exists (even if the
// user dismissed it) is left alone. Returns how many were new.
// Warnings (not plain tips) that are new also appear in the bell menu.
export async function saveInsights(userId, insights) {
  if (!insights.length) return 0;
  const result = await Insight.bulkWrite(
    insights.map((insight) => ({
      updateOne: {
        filter: { userId, dedupeKey: insight.dedupeKey },
        update: { $setOnInsert: { ...insight, userId, seen: false, dismissed: false } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  const created = Object.keys(result.upsertedIds ?? {}).map((index) => insights[index]);
  const warnings = created.filter((insight) => insight.severity !== 'info');
  if (warnings.length) {
    await Notification.insertMany(
      warnings.map((insight) => ({
        userId,
        kind:
          insight.type === 'budget' ? 'budget' : insight.type === 'tip' ? 'recurring' : 'insight',
        title: insight.title,
        body: insight.message,
        link: '/insights',
      })),
    );
  }
  return result.upsertedCount;
}

// Newest first; dismissed ones only when asked for. `unseen` counts all unseen ones.
export async function listInsights(userId, { includeDismissed = false, limit = 50 } = {}) {
  const filter = { userId, ...(includeDismissed ? {} : { dismissed: false }) };
  const [insights, unseen] = await Promise.all([
    Insight.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit),
    Insight.countDocuments({ userId, dismissed: false, seen: false }),
  ]);
  return { insights, unseen };
}

export async function updateInsight(userId, id, changes) {
  const insight = await findOwnedOrThrow(Insight, userId, id, { label: 'Insight' });
  insight.set(changes);
  await insight.save();
  return insight;
}

// Ids that aren't this user's are simply not matched.
export async function markSeen(userId, ids) {
  const result = await Insight.updateMany({ userId, _id: { $in: ids } }, { $set: { seen: true } });
  return { updated: result.modifiedCount };
}
