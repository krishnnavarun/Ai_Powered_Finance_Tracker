import mongoose from 'mongoose';
import { z } from 'zod';
import { logger } from '../config/logger.js';
import { generateJSON } from '../ai/llm/adapter.js';
import { asData } from '../ai/prompts/common.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { aiStatus } from '../services/ai.service.js';
import { sendEmail } from '../services/email.service.js';
import { saveInsights } from '../services/insight.service.js';
import { notify } from '../services/notification.service.js';
import { getUserPrefs } from '../services/userPrefs.js';
import { addDays, localDateOf, startOfLocalDay } from '../utils/dates.js';
import { formatINR } from '../utils/money.js';

// Monday's "your week in money": numbers from plain maths, plus (with AI on) one or two
// friendly sentences written by the AI from those numbers. In the app for everyone;
// by email for those who kept the weekly email on.

const { ObjectId } = mongoose.Types;

// The last full week, Monday to Sunday, before `now` (in the user's time zone).
export function lastWeek(now, timeZone) {
  const today = localDateOf(now, timeZone);
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const from = addDays(today, -weekday - 7);
  return { from, to: addDays(from, 6) };
}

async function weekTotals(userId, { from, to }, timeZone) {
  const rows = await Transaction.aggregate([
    {
      $match: {
        userId: new ObjectId(userId),
        type: { $in: ['income', 'expense'] },
        date: {
          $gte: startOfLocalDay(from, timeZone),
          $lt: startOfLocalDay(addDays(to, 1), timeZone),
        },
      },
    },
    {
      $group: {
        _id: { type: '$type', categoryId: '$categoryId' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);
  const sum = (type) => rows.filter((r) => r._id.type === type).reduce((t, r) => t + r.total, 0);
  return {
    income: sum('income'),
    expense: sum('expense'),
    count: rows.reduce((t, r) => t + r.count, 0),
    byCategory: rows
      .filter((r) => r._id.type === 'expense')
      .sort((a, b) => b.total - a.total)
      .map((r) => ({ categoryId: r._id.categoryId, total: r.total })),
  };
}

export async function buildDigest(userId, now = new Date()) {
  const { timeZone } = await getUserPrefs(userId);
  const week = lastWeek(now, timeZone);
  const before = { from: addDays(week.from, -7), to: addDays(week.to, -7) };
  const [current, previous, categories] = await Promise.all([
    weekTotals(userId, week, timeZone),
    weekTotals(userId, before, timeZone),
    Category.find({ userId }).select('name').lean(),
  ]);
  const nameOf = (id) =>
    categories.find((c) => String(c._id) === String(id))?.name ?? 'Uncategorized';
  const change =
    previous.expense > 0
      ? Math.round(((current.expense - previous.expense) / previous.expense) * 100)
      : null;
  return {
    ...week,
    income: current.income,
    expense: current.expense,
    count: current.count,
    previousExpense: previous.expense,
    change,
    topCategories: current.byCategory
      .slice(0, 3)
      .map((c) => ({ name: nameOf(c.categoryId), total: c.total })),
  };
}

// The plain summary, always available.
export function digestLines(d) {
  const lines = [
    `Money out: ${formatINR(d.expense)}${d.change === null ? '' : ` (${d.change > 0 ? '+' : ''}${d.change}% vs the week before)`}`,
    `Money in: ${formatINR(d.income)}`,
  ];
  if (d.topCategories.length) {
    lines.push(
      `Most spent on: ${d.topCategories.map((c) => `${c.name} ${formatINR(c.total)}`).join(', ')}`,
    );
  }
  return lines;
}

function templateNote(d) {
  if (d.count === 0) return 'A quiet week — nothing was recorded.';
  if (d.change !== null && d.change <= -10) return 'Nice — you spent less than the week before.';
  if (d.change !== null && d.change >= 20)
    return 'Spending went up this week. A quick look at your top categories may help.';
  return 'Here’s how your week went.';
}

// A short friendly note from the numbers (never raw payments). Falls back to fixed text.
async function friendlyNote(userId, digest, lines) {
  const status = await aiStatus(userId);
  if (!status.enabled || !status.configured || digest.count === 0) return templateNote(digest);
  try {
    const { note } = await generateJSON({
      userId,
      purpose: 'digest',
      schema: z.object({ note: z.string().min(1).max(300) }),
      system:
        'Write one or two short, warm, plain-English sentences summing up a person’s week of spending in India. Use only the numbers given; add no advice about specific investments. Return { "note": "..." }.',
      user: asData('week', lines.join('\n')),
    });
    return note;
  } catch {
    return templateNote(digest);
  }
}

export async function sendDigestForUser(userId, now = new Date()) {
  const user = await User.findById(userId).select('name email settings').lean();
  if (!user) return { created: false };
  const digest = await buildDigest(userId, now);
  const lines = digestLines(digest);
  const note = await friendlyNote(userId, digest, lines);
  const title = `Your week: ${formatINR(digest.expense)} spent`;

  // Once per week: the insight's dedupeKey makes a second run do nothing.
  const created = await saveInsights(userId, [
    {
      type: 'tip',
      severity: 'info',
      title,
      message: `${note} ${lines.join('. ')}.`,
      reason: `Payments from ${digest.from} to ${digest.to}, compared with ${addDays(digest.from, -7)} to ${addDays(digest.to, -7)}.`,
      data: digest,
      dedupeKey: `digest:${digest.from}`,
    },
  ]);
  if (!created) return { created: false };

  await notify(userId, { kind: 'digest', title, body: note, link: '/reports' });
  let emailed = false;
  if (user.settings?.digestEmail !== false) {
    const text = [
      `Hi ${user.name.split(' ')[0]},`,
      '',
      note,
      '',
      ...lines,
      '',
      'Open Paisa Pal to see more.',
    ].join('\n');
    const html = `<p>Hi ${escapeHtml(user.name.split(' ')[0])},</p><p>${escapeHtml(note)}</p><ul>${lines
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join('')}</ul><p style="color:#6b7280">You can turn this email off in Settings.</p>`;
    ({ sent: emailed } = await sendEmail({ to: user.email, subject: title, text, html }));
  }
  return { created: true, emailed };
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Every Monday: everyone who recorded something in the last two weeks.
export async function runWeeklyDigest(now = new Date()) {
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const userIds = await Transaction.distinct('userId', { date: { $gte: since } });
  let created = 0;
  let emailed = 0;
  for (const userId of userIds) {
    try {
      const result = await sendDigestForUser(String(userId), now);
      if (result.created) created += 1;
      if (result.emailed) emailed += 1;
    } catch (error) {
      logger.warn({ userId: String(userId), err: error.message }, 'digest failed');
    }
  }
  return { users: userIds.length, created, emailed };
}
