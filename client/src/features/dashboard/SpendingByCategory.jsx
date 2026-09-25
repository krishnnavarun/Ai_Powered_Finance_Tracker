import { ChartColumn } from 'lucide-react';
import { RankedBars } from '@/components/common/RankedBars';
import { topCategories } from './topCategories';

// "Where did my money go?" — the biggest categories as ranked bars.
export function SpendingByCategory({ data }) {
  const rows = topCategories(data.categories).map((c) => ({
    key: c.categoryId ?? 'uncategorized',
    label: c.name,
    icon: c.icon,
    amount: c.total,
    note: `${c.percent}%`,
  }));

  return (
    <section aria-label="Where your money went" className="surface flex flex-col gap-4 p-5">
      <h2 className="font-semibold">Where your money went</h2>
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <ChartColumn className="size-6" aria-hidden="true" />
          No spending yet this month.
        </div>
      ) : (
        <RankedBars rows={rows} label="Spending by category" />
      )}
    </section>
  );
}
