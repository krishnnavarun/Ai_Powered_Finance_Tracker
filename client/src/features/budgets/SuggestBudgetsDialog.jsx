import { LoaderCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { FormAlert } from '@/components/common/FormAlert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBudgetSuggestions } from '@/features/analytics/useAnalytics';
import { formatMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useBudgetMutations } from './useBudgets';

const KIND = { need: 'Need', want: 'Want', saving: 'Saving' };

function Suggestions({ data, month, existing, categoryLookup, onDone }) {
  const { create, update } = useBudgetMutations();
  const [chosen, setChosen] = useState(() => new Set(data.suggestions.map((s) => s.categoryId)));
  const [saving, setSaving] = useState(false);

  const toggle = (id) =>
    setChosen((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async () => {
    setSaving(true);
    try {
      for (const suggestion of data.suggestions.filter((s) => chosen.has(s.categoryId))) {
        // A budget that already exists this month gets the new limit instead.
        const current = existing.find((item) => item.budget.categoryId === suggestion.categoryId);
        if (current) {
          await update.mutateAsync({
            id: current.budget.id,
            changes: { limit: suggestion.suggested },
          });
        } else {
          await create.mutateAsync({
            month,
            categoryId: suggestion.categoryId,
            limit: suggestion.suggested,
          });
        }
      }
      toast.success(`Set ${chosen.size} ${chosen.size === 1 ? 'budget' : 'budgets'}`);
      onDone();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const total = data.suggestions
    .filter((s) => chosen.has(s.categoryId))
    .reduce((sum, s) => sum + s.suggested, 0);

  return (
    <div className="grid gap-4">
      <ul aria-label="Suggested budgets" className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1">
        {data.suggestions.map((s) => {
          const name = categoryLookup.get(s.categoryId)?.name ?? 'Category';
          return (
            <li
              key={s.categoryId}
              className="flex items-center gap-3 rounded-xl border bg-card/80 p-3"
            >
              <Checkbox
                checked={chosen.has(s.categoryId)}
                onCheckedChange={() => toggle(s.categoryId)}
                aria-label={`Budget for ${name}`}
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {name}
                  <Badge variant="outline">{KIND[s.kind]}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Usually {formatMoney(s.median)} a month
                  {s.trimmedBy > 0 && `, trimmed by ${formatMoney(s.trimmedBy)}`}
                </p>
              </div>
              <span className="font-semibold tabular-nums">{formatMoney(s.suggested)}</span>
            </li>
          );
        })}
      </ul>

      <p className="rounded-lg bg-muted/70 p-3 text-sm">
        {data.projectedSavingsRate === null
          ? `Total ${formatMoney(total)} a month. Add your income to see how much you'd save.`
          : `Total ${formatMoney(total)} a month. With these budgets you'd save about ${data.projectedSavingsRate}% of your ${formatMoney(data.income)} income.`}
        {data.reachesTarget === false &&
          ' Even after trimming, spending is above the 20% saving target.'}
      </p>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={apply} disabled={!chosen.size || saving}>
          {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          Set {chosen.size} {chosen.size === 1 ? 'budget' : 'budgets'} for {formatMonth(month)}
        </Button>
      </DialogFooter>
    </div>
  );
}

// "Budget autopilot": budgets from the last 3 months of spending, trimmed to save 20%.
export function SuggestBudgetsDialog({ open, onOpenChange, month, existing, categoryLookup }) {
  const { data, isPending, isError, error } = useBudgetSuggestions({ enabled: open });
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold" aria-hidden="true" />
            Suggested budgets
          </DialogTitle>
          <DialogDescription>
            {data?.basedOn
              ? `Based on your spending in ${data.basedOn.map((m) => formatMonth(m)).join(', ')}, trimmed so you save about 20%.`
              : 'Based on your last three months of spending.'}
          </DialogDescription>
        </DialogHeader>
        {isPending ? (
          <LoaderCircle
            className="mx-auto my-8 size-6 animate-spin text-primary"
            aria-label="Loading"
          />
        ) : isError ? (
          <FormAlert>{error.message}</FormAlert>
        ) : data.suggestions.length === 0 ? (
          <FormAlert tone="info">
            Not enough spending yet. After a month of payments, suggestions appear here.
          </FormAlert>
        ) : (
          <Suggestions
            data={data}
            month={month}
            existing={existing}
            categoryLookup={categoryLookup}
            onDone={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
