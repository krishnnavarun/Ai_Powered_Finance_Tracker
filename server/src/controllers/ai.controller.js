import * as aiService from '../services/ai.service.js';
import * as analytics from '../services/analytics.service.js';
import * as captureService from '../services/capture.service.js';

const ok = (res, data) => res.json({ success: true, data });

export const status = async (req, res) => ok(res, await aiService.aiStatus(req.user.id));

export const parseText = async (req, res) =>
  ok(res, await captureService.parseText(req.user.id, req.body.text));

export const parseSms = async (req, res) =>
  ok(res, await captureService.parseSmsBatch(req.user.id, req.body.text));

export const parseReceipt = async (req, res) =>
  ok(res, await captureService.parseReceiptImage(req.user.id, req.file));

export const parseReceiptText = async (req, res) =>
  ok(res, await captureService.parseReceiptOcrText(req.user.id, req.body.text));

export const categorize = async (req, res) =>
  ok(res, await captureService.categorize(req.user.id, req.body.items));

// ---- Analytics (plain maths, works with AI off)
export const forecast = async (req, res) => ok(res, await analytics.forecast(req.user.id));
export const healthScore = async (req, res) => ok(res, await analytics.health(req.user.id));
export const subscriptions = async (req, res) =>
  ok(res, await analytics.subscriptions(req.user.id));
export const setSubscriptionStatus = async (req, res) =>
  ok(res, {
    subscription: await analytics.setSubscriptionStatus(
      req.user.id,
      req.params.id,
      req.body.status,
    ),
  });
export const budgetSuggestions = async (req, res) =>
  ok(res, await analytics.budgetSuggestions(req.user.id, req.query));
export const whatIf = async (req, res) => ok(res, await analytics.whatIf(req.user.id, req.body));
export const anomalies = async (req, res) => ok(res, await analytics.anomalies(req.user.id));
