import { logger } from '../config/logger.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import * as analytics from '../services/analytics.service.js';
import { saveInsights } from '../services/insight.service.js';
import { addDays, daysBetween } from '../utils/dates.js';
import { formatINR } from '../utils/money.js';

// Turns the analytics into short messages. Every insight says *why* (with the numbers
// used), so the user can check it. The wording is fixed text, not AI.

function anomalyInsights(anomalies, nameOf) {
  return anomalies.categories.map((a) => {
    const name = nameOf(a.categoryId);
    const times = a.average > 0 ? Math.round((a.thisWeek / a.average) * 10) / 10 : null;
    return {
      type: 'anomaly',
      severity: 'warn',
      title: `Unusual spending on ${name}`,
      message: `You spent ${formatINR(a.thisWeek)} on ${name} this week${times ? `, about ${times}× your usual ${formatINR(a.average)}` : ''}.`,
      reason:
        a.z === null
          ? `The last 8 weeks were all about ${formatINR(a.average)}; this week is ${formatINR(a.thisWeek - a.average)} more.`
          : `The last 8 weeks averaged ${formatINR(a.average)}, usually within ${formatINR(a.std)} of that. This week is ${a.z} times that spread above normal (we point out anything above 2).`,
      data: { ...a, weekStart: anomalies.weekStart },
      dedupeKey: `anomaly:${a.categoryId}:${anomalies.weekStart}`,
    };
  });
}

// 0.07 → "4 minutes", 10 → "10 hours"
function gap(hours) {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function duplicateInsights(anomalies) {
  return anomalies.duplicates.map((d) => ({
    type: 'duplicate',
    severity: 'warn',
    title: `Charged twice at ${d.merchant}?`,
    message: `Two payments of ${formatINR(d.amount)} at ${d.merchant}, ${gap(d.hoursApart)} apart. Check that one isn’t a mistake.`,
    reason: 'Same shop and same amount within 24 hours.',
    data: d,
    dedupeKey: `duplicate:${[...d.ids].sort().join(':')}`,
  }));
}

function forecastInsights(forecast, nameOf) {
  const insights = [];
  if (forecast.warning) {
    insights.push({
      type: 'forecast',
      severity: forecast.warning === 'negative' ? 'critical' : 'warn',
      title:
        forecast.warning === 'negative'
          ? 'You may run out of money this month'
          : 'Money may run low this month',
      message: `At your usual pace you’ll have about ${formatINR(forecast.predictedEnd)} on ${forecast.toDate}.`,
      reason: `${formatINR(forecast.balance)} now − ${formatINR(forecast.averageDaily)} a day × ${forecast.daysLeft} days − ${formatINR(forecast.upcomingExpense)} of recurring payments + ${formatINR(forecast.upcomingIncome)} coming in = ${formatINR(forecast.predictedEnd)}.`,
      data: {
        balance: forecast.balance,
        averageDaily: forecast.averageDaily,
        daysLeft: forecast.daysLeft,
        upcomingExpense: forecast.upcomingExpense,
        upcomingIncome: forecast.upcomingIncome,
        predictedEnd: forecast.predictedEnd,
      },
      dedupeKey: `forecast:${forecast.month}:${forecast.warning}`,
    });
  }
  const elapsed = daysBetween(forecast.fromDate, forecast.today) + 1;
  const totalDays = daysBetween(forecast.fromDate, forecast.toDate) + 1;
  for (const b of forecast.budgets) {
    // Only budgets not yet used up, and only once a week of the month has passed.
    if (!b.willExceed || b.spent >= b.limit || elapsed < 7) continue;
    const name = nameOf(b.categoryId);
    insights.push({
      type: 'budget',
      severity: 'info',
      title: `${name} budget may run out`,
      message: `At this pace you’ll spend about ${formatINR(b.projected)} of your ${formatINR(b.limit)} ${name} budget by month end.`,
      reason: `${formatINR(b.spent)} spent in ${elapsed} days → ${formatINR(b.spent)} ÷ ${elapsed} × ${totalDays} days = ${formatINR(b.projected)}.`,
      data: { ...b, elapsed, totalDays },
      dedupeKey: `budget-pace:${b.categoryId ?? 'overall'}:${forecast.month}`,
    });
  }
  return insights;
}

function subscriptionInsights(subs, today) {
  const soon = addDays(today, 3);
  const insights = subs.subscriptions
    .filter(
      (s) =>
        s.status === 'active' && !s.late && s.nextExpectedAt <= soon && s.nextExpectedAt >= today,
    )
    .map((s) => ({
      type: 'subscription',
      severity: 'info',
      title: `${s.displayName} renews soon`,
      message: `About ${formatINR(s.avgAmount)} will be charged around ${s.nextExpectedAt}.`,
      reason: `Charged ${s.chargeCount} times, about every ${s.periodDays} days; last on ${s.lastChargedAt}.`,
      data: { subscriptionId: s.id, amount: s.avgAmount, date: s.nextExpectedAt },
      dedupeKey: `subscription-due:${s.merchantKey}:${s.nextExpectedAt}`,
    }));
  if (subs.totals.count >= 2) {
    insights.push({
      type: 'subscription',
      severity: 'info',
      title: `${formatINR(subs.totals.yearly)} a year on subscriptions`,
      message: `${subs.totals.count} subscriptions cost about ${formatINR(subs.totals.monthly)} a month. Cancel any you don’t use.`,
      reason: `Found ${subs.totals.count} payments that repeat every week, month or year with nearly the same amount.`,
      data: subs.totals,
      dedupeKey: `subscriptions-total:${today.slice(0, 7)}:${subs.totals.count}`,
    });
  }
  return insights;
}

// Works out and saves new insights for one user. Returns how many were new.
export async function refreshInsights(userId) {
  const [anomalies, forecast, subs, categories] = await Promise.all([
    analytics.anomalies(userId),
    analytics.forecast(userId),
    analytics.subscriptions(userId),
    Category.find({ userId }).select('name').lean(),
  ]);
  const nameOf = (id) =>
    id ? (categories.find((c) => String(c._id) === String(id))?.name ?? 'a category') : 'Overall';

  return saveInsights(userId, [
    ...forecastInsights(forecast, nameOf),
    ...anomalyInsights(anomalies, nameOf),
    ...duplicateInsights(anomalies),
    ...subscriptionInsights(subs, forecast.today),
  ]);
}

// Nightly: everyone who added anything in the last 60 days.
export async function runNightlyInsights(now = new Date()) {
  const since = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const userIds = await Transaction.distinct('userId', { createdAt: { $gte: since } });
  let created = 0;
  for (const userId of userIds) {
    try {
      created += await refreshInsights(String(userId));
    } catch (error) {
      logger.warn({ userId: String(userId), err: error.message }, 'insights failed');
    }
  }
  return { users: userIds.length, created };
}
