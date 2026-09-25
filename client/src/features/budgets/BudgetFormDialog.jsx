import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { MoneyInput } from '@/components/common/MoneyInput';
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
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { categoryOptions } from '@/features/categories/useCategories';
import { formatMonth } from '@/lib/dates';
import { paiseToInput, parseRupeesToPaise } from '@/lib/money';
import { applyServerErrors } from '@/lib/serverErrors';
import { useBudgetMutations } from './useBudgets';

const OVERALL = 'overall';
const SUB_INDENT = String.fromCharCode(160).repeat(4);

const schema = z.object({
  categoryId: z.string(),
  limit: z
    .string()
    .trim()
    .min(1, 'Enter a limit')
    .refine((value) => (parseRupeesToPaise(value) ?? 0) > 0, 'Enter an amount above ₹0'),
  rollover: z.boolean(),
});

function BudgetForm({ month, budget, categories, takenIds, onDone }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: budget ? (budget.categoryId ?? OVERALL) : '',
      limit: paiseToInput(budget?.limit ?? null),
      rollover: budget?.rollover ?? false,
    },
  });
  const { create, update } = useBudgetMutations();
  const mutation = budget ? update : create;
  const { errors } = form.formState;

  // Categories that already have a budget this month aren't offered again.
  const options = categoryOptions(categories, 'expense').filter(
    (c) => !takenIds.has(c.id) || c.id === budget?.categoryId,
  );
  const overallTaken = takenIds.has(null) && budget?.categoryId !== null;

  const onSubmit = form.handleSubmit((values) => {
    if (!budget && !values.categoryId) {
      form.setError('categoryId', { message: 'Choose what this budget is for' });
      return;
    }
    const handlers = {
      onSuccess: () => {
        toast.success(budget ? 'Budget saved' : 'Budget added');
        onDone();
      },
      onError: (error) => applyServerErrors(form, error, ['categoryId', 'limit']),
    };
    const limit = parseRupeesToPaise(values.limit);
    if (budget) {
      update.mutate({ id: budget.id, changes: { limit, rollover: values.rollover } }, handlers);
    } else {
      create.mutate(
        {
          month,
          categoryId: values.categoryId === OVERALL ? null : values.categoryId,
          limit,
          rollover: values.rollover,
        },
        handlers,
      );
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>
        {mutation.error?.code === 'VALIDATION_ERROR' ? null : mutation.error?.message}
      </FormAlert>

      <FormField label="Budget for" error={errors.categoryId}>
        {(field) => (
          <NativeSelect {...field} disabled={Boolean(budget)} {...form.register('categoryId')}>
            {!budget && <option value="">Choose…</option>}
            {(!overallTaken || budget?.categoryId === null) && (
              <option value={OVERALL}>All spending (overall)</option>
            )}
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.depth ? `${SUB_INDENT}${c.name}` : c.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <FormField label="Monthly limit" error={errors.limit}>
        {(field) => <MoneyInput {...field} autoFocus {...form.register('limit')} />}
      </FormField>

      <div className="flex items-start gap-2.5">
        <Controller
          control={form.control}
          name="rollover"
          render={({ field }) => (
            <Checkbox
              id="budget-rollover"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
            />
          )}
        />
        <div className="grid gap-1">
          <Label htmlFor="budget-rollover" className="cursor-pointer">
            Carry over unspent money
          </Label>
          <p className="text-xs text-muted-foreground">
            Money you don’t spend this month is added to next month’s budget.
          </p>
        </div>
      </div>

      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {budget ? 'Save budget' : 'Add budget'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Add a budget for `month`, or edit one (budget = the stored budget).
export function BudgetFormDialog({ open, onOpenChange, month, budget, categories, takenIds }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{budget ? 'Edit budget' : 'Add a budget'}</DialogTitle>
          <DialogDescription>For {formatMonth(month, { long: true })}.</DialogDescription>
        </DialogHeader>
        <BudgetForm
          key={budget?.id ?? 'new'}
          month={month}
          budget={budget}
          categories={categories}
          takenIds={takenIds}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
