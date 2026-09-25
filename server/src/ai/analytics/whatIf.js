import { addMonths } from '../../utils/dates.js';

// "What if I spent 20% less on food?" — the effect on monthly savings and goal dates.
//   income, expense   average month (paise)
//   byCategory        [{ categoryId, average }] average monthly spend per category
//   changes           [{ categoryId, changePercent }] e.g. −20 = spend 20% less
//   goals             [{ id, name, targetAmount, savedAmount }] active goals
//   today             local date, to turn "months" into a date
// Each goal is timed on its own, as if all the monthly savings went to it.
export function simulateWhatIf({ income, expense, byCategory, changes, goals = [], today }) {
  const averageOf = new Map(byCategory.map((c) => [c.categoryId, c.average]));
  const changeRows = changes.map(({ categoryId, changePercent }) => {
    const before = averageOf.get(categoryId) ?? 0;
    const after = Math.max(0, Math.round(before * (1 + changePercent / 100)));
    return { categoryId, changePercent, before, after, difference: after - before };
  });

  const newExpense = expense + changeRows.reduce((sum, row) => sum + row.difference, 0);
  const savingsBefore = income - expense;
  const savingsAfter = income - newExpense;

  const timing = (remaining, monthly) => {
    if (remaining <= 0) return { months: 0, date: today };
    if (monthly <= 0) return { months: null, date: null }; // never, at this rate
    const months = Math.ceil(remaining / monthly);
    return { months, date: addMonths(today, months) };
  };

  return {
    before: { expense, savings: savingsBefore },
    after: { expense: newExpense, savings: savingsAfter },
    savingsChange: savingsAfter - savingsBefore,
    yearlySavingsChange: (savingsAfter - savingsBefore) * 12,
    changes: changeRows,
    goals: goals.map((goal) => {
      const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
      const was = timing(remaining, savingsBefore);
      const now = timing(remaining, savingsAfter);
      return {
        goalId: goal.id,
        name: goal.name,
        remaining,
        before: was,
        after: now,
        monthsSooner: was.months !== null && now.months !== null ? was.months - now.months : null,
      };
    }),
  };
}
