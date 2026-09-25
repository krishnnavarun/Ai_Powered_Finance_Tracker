import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { MoneyInput } from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatMoney, parseRupeesToPaise } from '@/lib/money';
import { useGoalMutations } from './useGoals';

const schema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Enter an amount')
    .refine((value) => (parseRupeesToPaise(value) ?? 0) > 0, 'Enter an amount above ₹0'),
  note: z.string().trim().max(200),
});

function ContributeForm({ goal, mode, onSaved, onDone }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { amount: '', note: '' } });
  const { contribute } = useGoalMutations();
  const { errors } = form.formState;
  const withdrawing = mode === 'withdraw';

  const onSubmit = form.handleSubmit((values) => {
    const paise = parseRupeesToPaise(values.amount);
    if (withdrawing && paise > goal.savedAmount) {
      form.setError('amount', { message: `You have ${formatMoney(goal.savedAmount)} saved` });
      return;
    }
    contribute.mutate(
      { id: goal.id, amount: withdrawing ? -paise : paise, note: values.note || undefined },
      { onSuccess: (updated) => onSaved(updated, paise) },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>{contribute.error?.message}</FormAlert>
      <FormField label="Amount" error={errors.amount}>
        {(field) => <MoneyInput {...field} autoFocus {...form.register('amount')} />}
      </FormField>
      <FormField label="Note (optional)" error={errors.note}>
        {(field) => (
          <Input
            {...field}
            placeholder={withdrawing ? 'Needed for rent' : 'Diwali bonus'}
            {...form.register('note')}
          />
        )}
      </FormField>
      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={withdrawing ? 'outline' : 'default'}
          disabled={contribute.isPending}
        >
          {contribute.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {withdrawing ? 'Take out' : 'Add money'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Add money to a goal (mode 'add') or take some out (mode 'withdraw').
// `onSaved(updatedGoal, paise)` runs after a successful save.
export function ContributeDialog({ goal, mode, onOpenChange, onSaved }) {
  return (
    <Dialog open={Boolean(goal)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'withdraw' ? 'Take money out' : 'Add money'}</DialogTitle>
          <DialogDescription>
            {goal &&
              `${goal.name}: ${formatMoney(goal.savedAmount)} of ${formatMoney(goal.targetAmount)} saved`}
          </DialogDescription>
        </DialogHeader>
        {goal && (
          <ContributeForm
            key={`${goal.id}-${mode}`}
            goal={goal}
            mode={mode}
            onSaved={onSaved}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
