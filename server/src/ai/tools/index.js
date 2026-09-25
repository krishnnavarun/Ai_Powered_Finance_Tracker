import mongoose from 'mongoose';
import { z } from 'zod';
import { Category } from '../../models/Category.js';
import { Transaction } from '../../models/Transaction.js';
import { Wallet } from '../../models/Wallet.js';
import * as analytics from '../../services/analytics.service.js';
import { budgetStatusFor } from '../../services/budget.service.js';
import { listGoals } from '../../services/goal.service.js';
import { resolveRange, topMerchants } from '../../services/reports.service.js';
import { maskPII } from '../piiMasker.js';

// The only things the chat assistant can do: read-only questions about the user's own
// money. The LLM picks a tool and its arguments; `userId` is always added here, on the
// server, so a tool can never see another user's data. Amounts go to the AI in rupees
// (people and models think in rupees); text passes through the PII masker.

const { ObjectId } = mongoose.Types;
const rupees = (paise) => Math.round(paise) / 100;
const localDate = z.iso.date();
const MAX_ROWS = 15;

// ---- Shared helpers ------------------------------------------------------------------

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A category by name (any case), plus its sub-categories. null = no such category.
async function categoryIds(userId, name, type) {
  if (!name) return undefined;
  const categories = await Category.find({ userId, type }).lean();
  const wanted = name.trim().toLowerCase();
  const match = categories.find((c) => c.name.toLowerCase() === wanted);
  if (!match) return null;
  return [
    match._id,
    ...categories.filter((c) => String(c.parentId) === String(match._id)).map((c) => c._id),
  ];
}

async function walletId(userId, name) {
  if (!name) return undefined;
  const wallets = await Wallet.find({ userId }).lean();
  return wallets.find((w) => w.name.toLowerCase() === name.trim().toLowerCase())?._id ?? null;
}

const GROUP_KEYS = {
  day: (tz) => ({ $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: tz } }),
  week: (tz) => ({
    $dateToString: {
      format: '%Y-%m-%d',
      date: { $dateTrunc: { date: '$date', unit: 'week', startOfWeek: 'monday', timezone: tz } },
      timezone: tz,
    },
  }),
  month: (tz) => ({ $dateToString: { format: '%Y-%m', date: '$date', timezone: tz } }),
  category: () => '$categoryId',
  merchant: () => '$merchantKey',
};

// Totals of one type (income or expense) for a period, optionally grouped.
async function totals(userId, { type, from, to, category, wallet, groupBy }) {
  const range = await resolveRange(userId, { from, to });
  const match = {
    userId: new ObjectId(userId),
    type,
    date: { $gte: range.start, $lt: range.end },
  };
  const ids = await categoryIds(userId, category, type);
  if (ids === null) return { error: `There is no ${type} category called "${category}".` };
  if (ids) match.categoryId = { $in: ids };
  const wid = await walletId(userId, wallet);
  if (wid === null) return { error: `There is no wallet called "${wallet}".` };
  if (wid) match.walletId = wid;

  const [sum] = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const result = {
    from: range.fromDate,
    to: range.toDate,
    type,
    ...(category ? { category } : {}),
    ...(wallet ? { wallet } : {}),
    total: rupees(sum?.total ?? 0),
    count: sum?.count ?? 0,
  };
  if (!groupBy) return result;

  const rows = await Transaction.aggregate([
    { $match: match },
    { $sort: { date: 1 } },
    {
      $group: {
        _id: GROUP_KEYS[groupBy](range.prefs.timeZone),
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        name: { $last: '$merchant' },
      },
    },
  ]);

  let groups;
  if (groupBy === 'category') {
    const categories = await Category.find({ userId }).lean();
    const byId = new Map(categories.map((c) => [String(c._id), c]));
    const merged = new Map();
    for (const row of rows) {
      const own = row._id ? byId.get(String(row._id)) : null;
      const top = own?.parentId ? byId.get(String(own.parentId)) : own;
      const label = top?.name ?? 'Uncategorized';
      const entry = merged.get(label) ?? { label, amount: 0, count: 0 };
      entry.amount += row.total;
      entry.count += row.count;
      merged.set(label, entry);
    }
    groups = [...merged.values()];
  } else {
    groups = rows.map((row) => ({
      label: groupBy === 'merchant' ? row.name || row._id || 'Unknown' : row._id,
      amount: row.total,
      count: row.count,
    }));
  }
  const byTime = ['day', 'week', 'month'].includes(groupBy);
  groups.sort((a, b) =>
    byTime ? String(a.label).localeCompare(String(b.label)) : b.amount - a.amount,
  );
  result.groupBy = groupBy;
  result.groups = groups
    .slice(0, byTime ? 62 : MAX_ROWS)
    .map((g) => ({ ...g, amount: rupees(g.amount) }));
  return result;
}

function barChart(title, groups, type = 'bar') {
  return { type, title, data: groups.map((g) => ({ label: g.label, value: g.amount })) };
}

// ---- The tools ----------------------------------------------------------------------

const periodProps = {
  from: { type: 'string', description: 'First day, YYYY-MM-DD. Default: start of this month.' },
  to: { type: 'string', description: 'Last day, YYYY-MM-DD. Default: end of this month.' },
};
const groupByProp = {
  type: 'string',
  enum: ['day', 'week', 'month', 'category', 'merchant'],
  description: 'Split the total by this.',
};
const period = { from: localDate.optional(), to: localDate.optional() };

export const TOOLS = [
  {
    name: 'getSpending',
    description:
      'Money spent (expenses) in a period, optionally only one category or wallet, optionally split by day, week, month, category or merchant.',
    parameters: {
      type: 'object',
      properties: {
        ...periodProps,
        category: { type: 'string', description: 'Expense category name, e.g. "Food & Dining".' },
        wallet: { type: 'string', description: 'Wallet name, e.g. "HDFC".' },
        groupBy: groupByProp,
      },
    },
    schema: z.object({
      ...period,
      category: z.string().max(60).optional(),
      wallet: z.string().max(60).optional(),
      groupBy: z.enum(['day', 'week', 'month', 'category', 'merchant']).optional(),
    }),
    async run(userId, args) {
      const result = await totals(userId, { type: 'expense', ...args });
      if (!result.groups?.length) return { result };
      const byTime = ['day', 'week', 'month'].includes(args.groupBy);
      return {
        result,
        chart: barChart(`Spending by ${args.groupBy}`, result.groups, byTime ? 'line' : 'bar'),
      };
    },
  },
  {
    name: 'getIncome',
    description:
      'Money received (income) in a period, optionally split by day, week, month, category or merchant.',
    parameters: { type: 'object', properties: { ...periodProps, groupBy: groupByProp } },
    schema: z.object({
      ...period,
      groupBy: z.enum(['day', 'week', 'month', 'category', 'merchant']).optional(),
    }),
    async run(userId, args) {
      const result = await totals(userId, { type: 'income', ...args });
      return result.groups?.length
        ? { result, chart: barChart(`Income by ${args.groupBy}`, result.groups) }
        : { result };
    },
  },
  {
    name: 'compareSpending',
    description: 'Compare spending in two periods, split by category (or merchant).',
    parameters: {
      type: 'object',
      properties: {
        periodA: {
          type: 'object',
          properties: periodProps,
          required: ['from', 'to'],
          description: 'The earlier period.',
        },
        periodB: {
          type: 'object',
          properties: periodProps,
          required: ['from', 'to'],
          description: 'The later period.',
        },
        groupBy: { type: 'string', enum: ['category', 'merchant'] },
      },
      required: ['periodA', 'periodB'],
    },
    schema: z.object({
      periodA: z.object({ from: localDate, to: localDate }),
      periodB: z.object({ from: localDate, to: localDate }),
      groupBy: z.enum(['category', 'merchant']).default('category'),
    }),
    async run(userId, { periodA, periodB, groupBy }) {
      const [a, b] = await Promise.all([
        totals(userId, { type: 'expense', ...periodA, groupBy }),
        totals(userId, { type: 'expense', ...periodB, groupBy }),
      ]);
      const labels = [...new Set([...a.groups, ...b.groups].map((g) => g.label))];
      const rows = labels
        .map((label) => ({
          label,
          a: a.groups.find((g) => g.label === label)?.amount ?? 0,
          b: b.groups.find((g) => g.label === label)?.amount ?? 0,
        }))
        .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b))
        .slice(0, 10);
      const nameA = `${periodA.from} to ${periodA.to}`;
      const nameB = `${periodB.from} to ${periodB.to}`;
      return {
        result: {
          periodA: { ...periodA, total: a.total },
          periodB: { ...periodB, total: b.total },
          difference: Math.round((b.total - a.total) * 100) / 100,
          rows: rows.map((r) => ({ ...r, difference: Math.round((r.b - r.a) * 100) / 100 })),
        },
        chart: {
          type: 'compare',
          title: 'Spending compared',
          series: { a: nameA, b: nameB },
          data: rows,
        },
      };
    },
  },
  {
    name: 'getTopMerchants',
    description: 'The shops, apps or people the user spent the most with in a period.',
    parameters: {
      type: 'object',
      properties: { ...periodProps, limit: { type: 'integer', minimum: 1, maximum: 20 } },
    },
    schema: z.object({ ...period, limit: z.int().min(1).max(20).default(10) }),
    async run(userId, args) {
      const { from, to, merchants } = await topMerchants(userId, args);
      const groups = merchants.map((m) => ({
        label: m.name || m.merchantKey,
        amount: rupees(m.total),
        count: m.count,
      }));
      return {
        result: { from, to, merchants: groups },
        chart: groups.length ? barChart('Top places', groups) : undefined,
      };
    },
  },
  {
    name: 'getBudgetStatus',
    description:
      'How each budget is doing this month (or a given budget month YYYY-MM): limit, spent, left.',
    parameters: {
      type: 'object',
      properties: { month: { type: 'string', description: 'YYYY-MM' } },
    },
    schema: z.object({
      month: z
        .string()
        .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
        .optional(),
    }),
    async run(userId, { month }) {
      const status = await budgetStatusFor(userId, { month });
      const categories = await Category.find({ userId }).select('name').lean();
      const nameOf = (id) =>
        id ? (categories.find((c) => String(c._id) === String(id))?.name ?? 'Budget') : 'Overall';
      return {
        result: {
          month: status.month,
          from: status.fromDate,
          to: status.toDate,
          daysLeft: status.daysLeft,
          budgets: status.budgets.map((item) => ({
            name: nameOf(item.budget.categoryId),
            limit: rupees(item.effectiveLimit),
            spent: rupees(item.spent),
            left: rupees(item.remaining),
            percentUsed: item.percent,
            status: item.status,
          })),
        },
      };
    },
  },
  {
    name: 'getGoals',
    description: 'The user’s savings goals with progress and how much to save each month.',
    parameters: { type: 'object', properties: {} },
    schema: z.object({}),
    async run(userId) {
      const goals = await listGoals(userId);
      return {
        result: {
          goals: goals.map((g) => ({
            name: g.name,
            status: g.status,
            target: rupees(g.targetAmount),
            saved: rupees(g.savedAmount),
            percent: g.progress.percent,
            deadline: g.deadline,
            savePerMonth:
              g.progress.requiredPerMonth === null ? null : rupees(g.progress.requiredPerMonth),
          })),
        },
      };
    },
  },
  {
    name: 'getForecast',
    description:
      'Predicted balance at the end of this month, the daily spending pace and upcoming recurring payments.',
    parameters: { type: 'object', properties: {} },
    schema: z.object({}),
    async run(userId) {
      const f = await analytics.forecast(userId);
      return {
        result: {
          monthEnd: f.toDate,
          balanceNow: rupees(f.balance),
          predictedMonthEndBalance: rupees(f.predictedEnd),
          averageDailySpending: rupees(f.averageDaily),
          daysLeft: f.daysLeft,
          upcomingRecurringPayments: rupees(f.upcomingExpense),
          upcomingIncome: rupees(f.upcomingIncome),
          warning: f.warning,
        },
        chart: {
          type: 'line',
          title: 'Balance this month',
          data: f.series.map((p) => ({ label: p.date, value: rupees(p.actual ?? p.predicted) })),
        },
      };
    },
  },
  {
    name: 'getSubscriptions',
    description:
      'Subscriptions and other repeating charges found in the payments, with yearly cost.',
    parameters: { type: 'object', properties: {} },
    schema: z.object({}),
    async run(userId) {
      const { subscriptions, totals: sums } = await analytics.subscriptions(userId);
      return {
        result: {
          yearlyTotal: rupees(sums.yearly),
          subscriptions: subscriptions.map((s) => ({
            name: s.displayName,
            amount: rupees(s.avgAmount),
            every: s.period,
            yearlyCost: rupees(s.yearlyCost),
            nextExpected: s.nextExpectedAt,
            status: s.status,
          })),
        },
      };
    },
  },
  {
    name: 'getHealthScore',
    description: 'The money health score (0–100) with its five parts and a tip for each.',
    parameters: { type: 'object', properties: {} },
    schema: z.object({}),
    async run(userId) {
      const h = await analytics.health(userId);
      return {
        result: {
          score: h.score,
          grade: h.grade,
          parts: h.parts.map((p) => ({ part: p.label, score: p.score, outOf: p.max, tip: p.tip })),
        },
      };
    },
  },
  {
    name: 'searchTransactions',
    description:
      'Find individual payments by words in the merchant or note, e.g. "DMart" or "rent".',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        ...periodProps,
        limit: { type: 'integer', minimum: 1, maximum: 20 },
      },
      required: ['query'],
    },
    schema: z.object({
      query: z.string().trim().min(1).max(60),
      from: localDate.optional(),
      to: localDate.optional(),
      limit: z.int().min(1).max(20).default(10),
    }),
    async run(userId, { query, from, to, limit }) {
      const filter = {
        userId,
        $or: [
          { merchant: new RegExp(escapeRegex(query), 'i') },
          { note: new RegExp(escapeRegex(query), 'i') },
        ],
      };
      let timeZone = 'Asia/Kolkata';
      if (from || to) {
        const range = await resolveRange(userId, {
          from: from ?? '2000-01-01',
          to: to ?? '2100-01-01',
        });
        filter.date = { $gte: range.start, $lt: range.end };
        timeZone = range.prefs.timeZone;
      } else {
        timeZone = (await resolveRange(userId, {})).prefs.timeZone;
      }
      const [rows, categories] = await Promise.all([
        Transaction.find(filter).sort({ date: -1 }).limit(limit).lean(),
        Category.find({ userId }).select('name').lean(),
      ]);
      const nameOf = (id) => categories.find((c) => String(c._id) === String(id))?.name ?? null;
      const dateOf = (d) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(d);
      return {
        result: {
          count: rows.length,
          transactions: rows.map((t) => ({
            date: dateOf(t.date),
            type: t.type,
            amount: rupees(t.amount),
            merchant: t.merchant,
            note: t.note,
            category: nameOf(t.categoryId),
          })),
        },
      };
    },
  },
  {
    name: 'simulateWhatIf',
    description:
      'What happens to monthly savings and goal dates if spending in some categories changes by a percentage.',
    parameters: {
      type: 'object',
      properties: {
        changes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Expense category name.' },
              changePercent: { type: 'number', description: '-20 means spend 20% less.' },
            },
            required: ['category', 'changePercent'],
          },
        },
      },
      required: ['changes'],
    },
    schema: z.object({
      changes: z
        .array(
          z.object({ category: z.string().max(60), changePercent: z.number().min(-100).max(200) }),
        )
        .min(1)
        .max(10),
    }),
    async run(userId, { changes }) {
      const categories = await Category.find({ userId, type: 'expense' }).lean();
      const mapped = [];
      for (const change of changes) {
        const match = categories.find(
          (c) => c.name.toLowerCase() === change.category.trim().toLowerCase(),
        );
        if (!match)
          return { result: { error: `There is no expense category called "${change.category}".` } };
        mapped.push({ categoryId: String(match._id), changePercent: change.changePercent });
      }
      const w = await analytics.whatIf(userId, { changes: mapped });
      return {
        result: {
          basedOnMonths: w.basedOn,
          monthlySavingsBefore: rupees(w.before.savings),
          monthlySavingsAfter: rupees(w.after.savings),
          yearlySavingsChange: rupees(w.yearlySavingsChange),
          goals: w.goals.map((g) => ({
            name: g.name,
            monthsBefore: g.before.months,
            monthsAfter: g.after.months,
            monthsSooner: g.monthsSooner,
          })),
        },
      };
    },
  },
  {
    name: 'getBalances',
    description: 'How much money is in each wallet right now, and the total.',
    parameters: { type: 'object', properties: {} },
    schema: z.object({}),
    async run(userId) {
      const wallets = await Wallet.find({ userId, isArchived: false }).lean();
      return {
        result: {
          total: rupees(wallets.reduce((sum, w) => sum + w.balance, 0)),
          wallets: wallets.map((w) => ({ name: w.name, type: w.type, balance: rupees(w.balance) })),
        },
      };
    },
  },
];

// What the LLM sees: names, descriptions and argument shapes only.
export const TOOL_DECLARATIONS = TOOLS.map(({ name, description, parameters }) => ({
  name,
  description,
  parameters,
}));

// Masks personal details in every piece of text in a tool result.
function maskStrings(value) {
  if (typeof value === 'string') return maskPII(value).text;
  if (Array.isArray(value)) return value.map(maskStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskStrings(v)]));
  }
  return value;
}

// Runs one tool call for this user. Never throws for bad arguments or unknown tools:
// the problem goes back to the model as the result, so it can correct itself.
export async function runTool(userId, name, rawArgs) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { result: { error: `Unknown tool "${name}".` } };
  const parsed = tool.schema.safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (i) => `${i.path.join('.') || 'arguments'}: ${i.message}`,
    );
    return { result: { error: `Invalid arguments. ${problems.join('; ')}` } };
  }
  const { result, chart } = await tool.run(String(userId), parsed.data);
  return { result: maskStrings(result), chart };
}
