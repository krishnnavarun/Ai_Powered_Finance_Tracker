import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { toLocalDate, useTimeZone } from '@/lib/dates';
import { formatMoney, parseRupeesToPaise } from '@/lib/money';
import { useWalletMutations } from './useWallets';

const schema = z
  .object({
    fromWalletId: z.string().min(1, 'Choose a wallet'),
    toWalletId: z.string().min(1, 'Choose a wallet'),
    amount: z
      .string()
      .trim()
      .refine((value) => (parseRupeesToPaise(value) ?? 0) > 0, 'Enter an amount above ₹0'),
    date: z.string().min(1, 'Choose a date'),
    note: z.string().trim().max(500),
  })
  .refine((values) => values.fromWalletId !== values.toWalletId, {
    path: ['toWalletId'],
    message: 'Choose a different wallet',
  });

function TransferForm({ wallets, onDone }) {
  const timeZone = useTimeZone();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fromWalletId: wallets[0]?.id ?? '',
      toWalletId: wallets[1]?.id ?? '',
      amount: '',
      date: toLocalDate(new Date(), timeZone),
      note: '',
    },
  });
  const { transfer } = useWalletMutations();
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    transfer.mutate(
      { ...values, amount: parseRupeesToPaise(values.amount), note: values.note || undefined },
      {
        onSuccess: (txn) => {
          toast.success(`Moved ${formatMoney(txn.amount)}`);
          onDone();
        },
      },
    ),
  );

  const walletOptions = wallets.map((wallet) => (
    <option key={wallet.id} value={wallet.id}>
      {wallet.name} ({formatMoney(wallet.balance)})
    </option>
  ));

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>{transfer.error?.message}</FormAlert>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="From" error={errors.fromWalletId}>
          {(field) => (
            <NativeSelect {...field} {...form.register('fromWalletId')}>
              {walletOptions}
            </NativeSelect>
          )}
        </FormField>
        <FormField label="To" error={errors.toWalletId}>
          {(field) => (
            <NativeSelect {...field} {...form.register('toWalletId')}>
              {walletOptions}
            </NativeSelect>
          )}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount" error={errors.amount}>
          {(field) => <MoneyInput {...field} {...form.register('amount')} />}
        </FormField>
        <FormField label="Date" error={errors.date}>
          {(field) => <Input {...field} type="date" {...form.register('date')} />}
        </FormField>
      </div>

      <FormField label="Note (optional)" error={errors.note}>
        {(field) => <Input {...field} placeholder="ATM withdrawal" {...form.register('note')} />}
      </FormField>

      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={transfer.isPending}>
          {transfer.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          Move money
        </Button>
      </DialogFooter>
    </form>
  );
}

// Moves money between two of the user's active wallets.
export function TransferDialog({ open, onOpenChange, wallets }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move money</DialogTitle>
          <DialogDescription>
            Move money between your own wallets. This is not counted as spending.
          </DialogDescription>
        </DialogHeader>
        <TransferForm wallets={wallets} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
