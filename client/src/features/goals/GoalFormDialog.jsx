import { zodResolver } from '@hookform/resolvers/zod';
import { Check, LoaderCircle } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
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
import { NativeSelect } from '@/components/ui/native-select';
import { WALLET_COLORS } from '@/features/wallets/walletTypes';
import { paiseToInput, parseRupeesToPaise } from '@/lib/money';
import { applyServerErrors } from '@/lib/serverErrors';
import { cn } from '@/lib/utils';
import { useGoalMutations } from './useGoals';

const amount = (message) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || (parseRupeesToPaise(value) ?? -1) >= 0, message);

const schema = z.object({
  name: z.string().trim().min(1, 'Give your goal a name').max(60, 'Name is too long'),
  targetAmount: z
    .string()
    .trim()
    .min(1, 'How much do you need?')
    .refine((value) => (parseRupeesToPaise(value) ?? 0) > 0, 'Enter an amount above ₹0'),
  savedAmount: amount('Enter an amount like 5,000'),
  deadline: z.string(),
  linkedWalletId: z.string(),
  color: z.string(),
});

const FIELDS = ['name', 'targetAmount', 'savedAmount', 'deadline', 'linkedWalletId'];

function GoalForm({ goal, wallets, onDone }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: goal?.name ?? '',
      targetAmount: paiseToInput(goal?.targetAmount ?? null),
      savedAmount: '',
      deadline: goal?.deadline ?? '',
      linkedWalletId: goal?.linkedWalletId ?? '',
      color: goal?.color ?? WALLET_COLORS[0],
    },
  });
  const { create, update } = useGoalMutations();
  const mutation = goal ? update : create;
  const { errors } = form.formState;
  const color = useWatch({ control: form.control, name: 'color' });

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      name: values.name,
      targetAmount: parseRupeesToPaise(values.targetAmount),
      deadline: values.deadline || null,
      linkedWalletId: values.linkedWalletId || null,
      color: values.color,
    };
    const handlers = {
      onSuccess: () => {
        toast.success(goal ? 'Goal saved' : 'Goal added');
        onDone();
      },
      onError: (error) => applyServerErrors(form, error, FIELDS),
    };
    if (goal) update.mutate({ id: goal.id, changes: payload }, handlers);
    else {
      create.mutate(
        {
          ...payload,
          savedAmount: values.savedAmount ? parseRupeesToPaise(values.savedAmount) : 0,
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

      <FormField label="What are you saving for?" error={errors.name}>
        {(field) => (
          <Input
            {...field}
            autoFocus
            placeholder="New phone, Goa trip…"
            {...form.register('name')}
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount needed" error={errors.targetAmount}>
          {(field) => <MoneyInput {...field} {...form.register('targetAmount')} />}
        </FormField>
        {!goal && (
          <FormField label="Already saved (optional)" error={errors.savedAmount}>
            {(field) => <MoneyInput {...field} {...form.register('savedAmount')} />}
          </FormField>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="By when? (optional)" error={errors.deadline}>
          {(field) => <Input {...field} type="date" {...form.register('deadline')} />}
        </FormField>
        <FormField label="Kept in (optional)" error={errors.linkedWalletId}>
          {(field) => (
            <NativeSelect {...field} {...form.register('linkedWalletId')}>
              <option value="">Not linked</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {WALLET_COLORS.map((swatch) => (
            <label key={swatch} className="cursor-pointer">
              <input
                type="radio"
                value={swatch}
                className="peer sr-only"
                aria-label={`Colour ${swatch}`}
                {...form.register('color')}
              />
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full shadow-sm ring-offset-2 ring-offset-background transition-transform duration-200 hover:scale-110 active:scale-95 peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                  color === swatch && 'scale-110 ring-2 ring-gold',
                )}
                style={{ backgroundColor: swatch }}
              >
                {color === swatch && <Check className="size-4 text-white" aria-hidden="true" />}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {goal ? 'Save goal' : 'Add goal'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function GoalFormDialog({ open, onOpenChange, goal, wallets }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit goal' : 'Add a goal'}</DialogTitle>
          <DialogDescription>Save a little at a time towards something you want.</DialogDescription>
        </DialogHeader>
        <GoalForm
          key={goal?.id ?? 'new'}
          goal={goal}
          wallets={wallets}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
