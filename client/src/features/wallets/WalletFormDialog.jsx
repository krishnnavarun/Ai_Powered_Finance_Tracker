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
import { paiseToInput, parseRupeesToPaise } from '@/lib/money';
import { applyServerErrors } from '@/lib/serverErrors';
import { cn } from '@/lib/utils';
import { useWalletMutations } from './useWallets';
import { WALLET_COLORS, WALLET_TYPES, walletTypeIcon } from './walletTypes';

const amountText = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || parseRupeesToPaise(value) !== null,
    'Enter an amount like 2,500.50',
  );

const schema = z.object({
  name: z.string().trim().min(1, 'Give the wallet a name').max(50, 'Name is too long'),
  type: z.enum(WALLET_TYPES.map((t) => t.value)),
  openingBalance: amountText,
  creditLimit: amountText.refine(
    (value) => value === '' || parseRupeesToPaise(value) >= 0,
    'Credit limit cannot be negative',
  ),
  color: z.string(),
});

const FIELDS = ['name', 'type', 'openingBalance', 'creditLimit', 'color'];

function toFormValues(wallet) {
  return {
    name: wallet?.name ?? '',
    type: wallet?.type ?? 'bank',
    openingBalance: paiseToInput(wallet?.openingBalance ?? null),
    creditLimit: paiseToInput(wallet?.creditLimit ?? null),
    color: wallet?.color ?? WALLET_COLORS[0],
  };
}

function toPayload(values) {
  return {
    name: values.name,
    type: values.type,
    icon: walletTypeIcon(values.type),
    color: values.color,
    openingBalance: parseRupeesToPaise(values.openingBalance || '0'),
    // Only cards have a credit limit; other types always send null.
    creditLimit:
      values.type === 'card' && values.creditLimit ? parseRupeesToPaise(values.creditLimit) : null,
  };
}

function WalletForm({ wallet, onDone }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: toFormValues(wallet) });
  const { create, update } = useWalletMutations();
  const mutation = wallet ? update : create;
  const { errors } = form.formState;
  const [type, color] = useWatch({ control: form.control, name: ['type', 'color'] });

  const onSubmit = form.handleSubmit((values) => {
    const payload = toPayload(values);
    const options = {
      onSuccess: (saved) => {
        toast.success(wallet ? `Saved "${saved.name}"` : `Added "${saved.name}"`);
        onDone();
      },
      onError: (error) => applyServerErrors(form, error, FIELDS),
    };
    if (wallet) update.mutate({ id: wallet.id, changes: payload }, options);
    else create.mutate(payload, options);
  });

  const fieldError = ['DUPLICATE_NAME', 'VALIDATION_ERROR'].includes(mutation.error?.code);

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>{fieldError ? null : mutation.error?.message}</FormAlert>

      <FormField label="Name" error={errors.name}>
        {(field) => <Input {...field} placeholder="HDFC Savings" {...form.register('name')} />}
      </FormField>

      <FormField label="Type" error={errors.type}>
        {(field) => (
          <NativeSelect {...field} {...form.register('type')}>
            {WALLET_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <FormField
        label={type === 'card' ? 'Amount owed now' : 'Current balance'}
        error={errors.openingBalance}
        hint={
          wallet
            ? 'Your balance will change by the same amount.'
            : type === 'card'
              ? 'Type what you owe with a minus sign, like -12000.'
              : 'How much money is in it now. Leave empty for ₹0.'
        }
      >
        {(field) => <MoneyInput {...field} {...form.register('openingBalance')} />}
      </FormField>

      {type === 'card' && (
        <FormField label="Credit limit" error={errors.creditLimit}>
          {(field) => <MoneyInput {...field} {...form.register('creditLimit')} />}
        </FormField>
      )}

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
          {wallet ? 'Save changes' : 'Add wallet'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Add a wallet (wallet = null) or edit one.
export function WalletFormDialog({ open, onOpenChange, wallet }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{wallet ? 'Edit wallet' : 'Add a wallet'}</DialogTitle>
          <DialogDescription>
            A wallet is where your money is kept: cash, bank, UPI or a card.
          </DialogDescription>
        </DialogHeader>
        {/* key: a fresh form (with fresh default values) for each wallet */}
        <WalletForm key={wallet?.id ?? 'new'} wallet={wallet} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
