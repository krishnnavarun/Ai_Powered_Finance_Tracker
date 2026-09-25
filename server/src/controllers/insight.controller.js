import { refreshInsights } from '../jobs/insights.job.js';
import * as insightService from '../services/insight.service.js';

const ok = (res, data) => res.json({ success: true, data });

export const list = async (req, res) =>
  ok(res, await insightService.listInsights(req.user.id, req.query));

export const update = async (req, res) =>
  ok(res, { insight: await insightService.updateInsight(req.user.id, req.params.id, req.body) });

export const markSeen = async (req, res) =>
  ok(res, await insightService.markSeen(req.user.id, req.body.ids));

// "Check now": the same work the nightly job does, for this user only.
export async function refresh(req, res) {
  const created = await refreshInsights(req.user.id);
  ok(res, { created, ...(await insightService.listInsights(req.user.id)) });
}
