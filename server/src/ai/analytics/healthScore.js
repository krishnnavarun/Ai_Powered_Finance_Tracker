import { clamp, mean, std } from './stats.js';

// Financial health, 0–100, from five parts. Each part explains itself and gives a tip.
//
//   months        [{ income, expense }] recent complete months, oldest first (up to 6)
//   budgets       [{ limit, spent }] of the last finished month ([] = no budgets)
//   goals         [{ status, targetAmount, savedAmount, createdAt, deadline }] with
//                 `expectedPercent`: how far along it should be by now (0–100) or null
//   liquid        money in wallets that can be used in an emergency (paise)
//
// Weights: savings rate 35, budgets 25, steady spending 15, goals 15, emergency buffer 10.
export const WEIGHTS = { savings: 35, budgets: 25, stability: 15, goals: 15, buffer: 10 };

const TARGET_SAVINGS_RATE = 0.2;
const TARGET_BUFFER_MONTHS = 3;

function part(key, label, fraction, extra) {
  const max = WEIGHTS[key];
  return { key, label, score: Math.round(clamp(fraction, 0, 1) * max), max, ...extra };
}

function savingsPart(months) {
  const recent = months.slice(-3);
  const income = recent.reduce((total, m) => total + m.income, 0);
  const expense = recent.reduce((total, m) => total + m.expense, 0);
  if (income <= 0) {
    return part('savings', 'Saving money', 0, {
      value: null,
      tip: 'Add your income so we can see how much you save.',
    });
  }
  const rate = (income - expense) / income;
  return part('savings', 'Saving money', rate / TARGET_SAVINGS_RATE, {
    value: Math.round(rate * 100),
    tip:
      rate >= TARGET_SAVINGS_RATE
        ? 'You save 20% or more of your income. Keep it up!'
        : `You save ${Math.max(0, Math.round(rate * 100))}% of your income. Aim for 20%.`,
  });
}

function budgetsPart(budgets) {
  if (!budgets.length) {
    return part('budgets', 'Sticking to budgets', 0.6, {
      value: null,
      tip: 'Budgets are checked at the end of each month. Set a few for this month and see how you did next month.',
    });
  }
  const within = budgets.filter((b) => b.spent <= b.limit).length;
  return part('budgets', 'Sticking to budgets', within / budgets.length, {
    value: Math.round((within / budgets.length) * 100),
    tip:
      within === budgets.length
        ? 'You stayed within every budget last month.'
        : `${budgets.length - within} of ${budgets.length} budgets went over last month.`,
  });
}

function stabilityPart(months) {
  const spending = months.map((m) => m.expense).filter((e) => e > 0);
  if (spending.length < 3) {
    return part('stability', 'Steady spending', 2 / 3, {
      value: null,
      tip: 'A few more months of data will show how steady your spending is.',
    });
  }
  // Coefficient of variation: how much monthly spending jumps around (0.1 = very steady).
  const cv = std(spending) / mean(spending);
  return part('stability', 'Steady spending', 1 - (cv - 0.1) / 0.4, {
    value: Math.round(cv * 100) / 100,
    tip:
      cv <= 0.2
        ? 'Your monthly spending is steady.'
        : 'Your spending changes a lot from month to month. Budgets help smooth it out.',
  });
}

function goalsPart(goals) {
  const tracked = goals.filter((g) => g.status === 'active' && g.expectedPercent !== null);
  if (!tracked.length) {
    return part('goals', 'Goals on track', 0.5, {
      value: null,
      tip: 'Add a savings goal with a date, like an emergency fund.',
    });
  }
  // On track = saved at least what the calendar says, give or take 10 points.
  const onTrack = tracked.filter(
    (g) => (g.savedAmount / g.targetAmount) * 100 >= g.expectedPercent - 10,
  ).length;
  return part('goals', 'Goals on track', onTrack / tracked.length, {
    value: Math.round((onTrack / tracked.length) * 100),
    tip:
      onTrack === tracked.length
        ? 'All your goals are on track.'
        : `${tracked.length - onTrack} goal${tracked.length - onTrack === 1 ? ' is' : 's are'} behind. A small monthly amount helps.`,
  });
}

function bufferPart(months, liquid) {
  const avgExpense = mean(months.slice(-3).map((m) => m.expense));
  if (avgExpense <= 0) {
    return part('buffer', 'Emergency money', liquid > 0 ? 1 : 0, {
      value: null,
      tip: 'Keep 3 months of spending aside for surprises.',
    });
  }
  const monthsCovered = Math.max(0, liquid) / avgExpense;
  return part('buffer', 'Emergency money', monthsCovered / TARGET_BUFFER_MONTHS, {
    value: Math.round(monthsCovered * 10) / 10,
    tip:
      monthsCovered >= TARGET_BUFFER_MONTHS
        ? 'You have 3+ months of spending set aside.'
        : `Your savings cover ${Math.round(monthsCovered * 10) / 10} months of spending. Aim for 3.`,
  });
}

export function healthScore({ months = [], budgets = [], goals = [], liquid = 0 }) {
  const parts = [
    savingsPart(months),
    budgetsPart(budgets),
    stabilityPart(months),
    goalsPart(goals),
    bufferPart(months, liquid),
  ];
  const score = parts.reduce((total, p) => total + p.score, 0);
  const grade = score >= 80 ? 'Great' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs care';
  return { score, grade, parts };
}
