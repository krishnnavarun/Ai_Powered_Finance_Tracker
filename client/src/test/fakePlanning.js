import { apiError, http, HttpResponse, server } from './msw';

// In-memory budgets, goals and report summaries for page tests. The maths mirrors the
// server (server/src/services/budget.math.js, goal.math.js) closely enough for the UI.

let counter = 1000;
const newId = () => (++counter).toString(16).padStart(24, '0');
const ok = (data, status = 200) => HttpResponse.json({ success: true, data }, { status });

function budgetStatus({ limit, spent = 0, rolloverAmount = 0, alertLevels = [80, 100] }, daysLeft) {
  const effectiveLimit = limit + rolloverAmount;
  const remaining = effectiveLimit - spent;
  let status = 'ok';
  if (spent >= effectiveLimit) status = 'over';
  else if (spent * 100 >= effectiveLimit * Math.min(...alertLevels)) status = 'warning';
  return {
    spent,
    effectiveLimit,
    remaining,
    percent: Math.floor((spent / effectiveLimit) * 100),
    status,
    rolloverAmount,
    dailyAllowance: daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0,
  };
}

// Simplified scheduling: the next date is the start date; paused rules have none.
function withSchedule(rule) {
  const nextDate = rule.active ? (rule.nextDate ?? rule.startDate) : null;
  return { ...rule, nextDate, upcoming: nextDate ? (rule.upcoming ?? [nextDate]) : [] };
}

function withProgress(goal) {
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  return {
    ...goal,
    progress: {
      percent: Math.min(100, Math.floor((goal.savedAmount / goal.targetAmount) * 100)),
      remaining,
      monthsLeft: goal.monthsLeft ?? null,
      requiredPerMonth:
        goal.monthsLeft && remaining && goal.status === 'active'
          ? Math.ceil(remaining / goal.monthsLeft)
          : null,
      overdue: false,
    },
  };
}

// budgets: [{ categoryId|null, limit, spent?, rollover?, rolloverAmount? }] for `month`
// previousBudgets: budgets of the month before (for "copy last month")
// goals: [{ name, targetAmount, savedAmount?, deadline?, status?, monthsLeft? }]
// recurring: [{ template, frequency, startDate, nextDate?, active?, upcoming? }]
export function installFakePlanning({
  recurring = [],
  month = '2026-09',
  daysLeft = 7,
  budgets = [],
  previousBudgets = [],
  goals = [],
  trend,
  byCategory,
} = {}) {
  const db = {
    budgets: budgets.map((b) => ({
      id: newId(),
      month,
      alertLevels: [80, 100],
      rollover: false,
      ...b,
    })),
    previousBudgets,
    goals: goals.map((g) => ({
      id: newId(),
      savedAmount: 0,
      deadline: null,
      status: 'active',
      color: '#0f766e',
      linkedWalletId: null,
      contributions: [],
      ...g,
    })),
    recurring: recurring.map((r) =>
      withSchedule({ id: newId(), interval: 1, endDate: null, active: true, ...r }),
    ),
    requests: [],
  };
  const record = async (request, path) => {
    const body = request.method === 'DELETE' ? null : await request.json();
    db.requests.push({ method: request.method, path, body });
    return body;
  };

  const handlers = [
    // ---- budgets
    http.get('*/api/budgets/status', ({ request }) => {
      const asked = new URL(request.url).searchParams.get('month') ?? month;
      const items = asked === month ? db.budgets : [];
      return ok({
        month: asked,
        fromDate: `${asked}-01`,
        toDate: `${asked}-30`,
        daysLeft: asked === month ? daysLeft : 0,
        totalSpent: items.reduce((sum, b) => (b.categoryId ? sum + (b.spent ?? 0) : sum), 0),
        budgets: items.map((budget) => {
          const { spent: _spent, rolloverAmount: _roll, ...stored } = budget;
          return { budget: stored, ...budgetStatus(budget, daysLeft) };
        }),
      });
    }),
    http.get('*/api/budgets', ({ request }) => {
      const asked = new URL(request.url).searchParams.get('month') ?? month;
      return ok({ month: asked, budgets: asked === month ? db.budgets : db.previousBudgets });
    }),
    http.post('*/api/budgets', async ({ request }) => {
      const body = await record(request, '/budgets');
      const budget = { id: newId(), alertLevels: [80, 100], rollover: false, ...body, spent: 0 };
      db.budgets.push(budget);
      return ok({ budget }, 201);
    }),
    http.patch('*/api/budgets/:id', async ({ request, params }) => {
      const body = await record(request, `/budgets/${params.id}`);
      const budget = db.budgets.find((b) => b.id === params.id);
      Object.assign(budget, body);
      return ok({ budget });
    }),
    http.delete('*/api/budgets/:id', async ({ request, params }) => {
      await record(request, `/budgets/${params.id}`);
      db.budgets = db.budgets.filter((b) => b.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),

    // ---- goals
    http.get('*/api/goals', () => ok({ goals: db.goals.map(withProgress) })),
    http.post('*/api/goals', async ({ request }) => {
      const body = await record(request, '/goals');
      const goal = { id: newId(), status: 'active', contributions: [], savedAmount: 0, ...body };
      if (goal.savedAmount >= goal.targetAmount) goal.status = 'done';
      db.goals.push(goal);
      return ok({ goal: withProgress(goal) }, 201);
    }),
    http.patch('*/api/goals/:id', async ({ request, params }) => {
      const body = await record(request, `/goals/${params.id}`);
      const goal = db.goals.find((g) => g.id === params.id);
      Object.assign(goal, body);
      return ok({ goal: withProgress(goal) });
    }),
    http.delete('*/api/goals/:id', async ({ request, params }) => {
      await record(request, `/goals/${params.id}`);
      db.goals = db.goals.filter((g) => g.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/goals/:id/contribute', async ({ request, params }) => {
      const body = await record(request, `/goals/${params.id}/contribute`);
      const goal = db.goals.find((g) => g.id === params.id);
      if (goal.savedAmount + body.amount < 0) {
        return apiError(400, 'NOT_ENOUGH_SAVED', 'You can’t take out more than you have saved');
      }
      const before = goal.status;
      goal.savedAmount += body.amount;
      if (goal.status === 'active' && goal.savedAmount >= goal.targetAmount) goal.status = 'done';
      if (goal.status === 'done' && goal.savedAmount < goal.targetAmount) goal.status = 'active';
      return ok({
        goal: { ...withProgress(goal), justCompleted: before !== 'done' && goal.status === 'done' },
      });
    }),
  ];

  handlers.push(
    http.get('*/api/recurring', () => ok({ rules: db.recurring })),
    http.post('*/api/recurring', async ({ request }) => {
      const body = await record(request, '/recurring');
      const rule = withSchedule({ id: newId(), interval: 1, endDate: null, active: true, ...body });
      db.recurring.push(rule);
      return ok({ rule }, 201);
    }),
    http.patch('*/api/recurring/:id', async ({ request, params }) => {
      const body = await record(request, `/recurring/${params.id}`);
      const index = db.recurring.findIndex((r) => r.id === params.id);
      if (index === -1) return apiError(404, 'NOT_FOUND', 'Recurring payment not found');
      const changed = { ...db.recurring[index], ...body, nextDate: undefined, upcoming: undefined };
      db.recurring[index] = withSchedule(changed);
      return ok({ rule: db.recurring[index] });
    }),
    http.delete('*/api/recurring/:id', async ({ request, params }) => {
      await record(request, `/recurring/${params.id}`);
      db.recurring = db.recurring.filter((r) => r.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  if (trend) handlers.push(http.get('*/api/reports/trend', () => ok({ months: trend })));
  if (byCategory) handlers.push(http.get('*/api/reports/by-category', () => ok(byCategory)));

  server.use(...handlers);
  return { db };
}
