import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
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
import { categoryOptions, useCategories } from '@/features/categories/useCategories';
import { useWallets } from '@/features/wallets/useWallets';
import { toLocalDate, useTimeZone } from '@/lib/dates';
import { paiseToInput, parseRupeesToPaise } from '@/lib/money';
import { applyServerErrors } from '@/lib/serverErrors';
import { describeSchedule, FREQUENCIES } from './schedule';
import { useRecurringMutations } from './useRecurring';

const TYPES = [
  { value: 'expense', label: 'Money out' },
  { value: 'income', label: 'Money in' },
  { value: 'transfer', label: 'Move between wallets' },
];

const SUB_INDENT = String.fromCharCode(160).repeat(4);

const schema = z
  .object({
    type: z.enum(['expense', 'income', 'transfer']),
    merchant: z.string().trim().max(100, 'Too long'),
    amount: z
      .string()
      .trim()
      .min(1, 'Enter an amount')
      .refine((value) => (parseRupeesToPaise(value) ?? 0) > 0, 'Enter an amount above ₹0'),
    walletId: z.string().min(1, 'Choose a wallet'),
    toWalletId: z.string(),
    categoryId: z.string(),
    frequency: z.enum(FREQUENCIES.map((f) => f.value)),
    interval: z.coerce.number().int('Whole numbers only').min(1, 'At least 1').max(365, 'Too big'),
    startDate: z.string().min(1, 'Choose a date'),
    endDate: z.string(),
    note: z.string().trim().max(500, 'Too long'),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'transfer') {
      if (!values.toWalletId) {
        ctx.addIssue({ code: 'custom', path: ['toWalletId'], message: 'Choose a wallet' });
      } else if (values.toWalletId === values.walletId) {
        ctx.addIssue({
          code: 'custom',
          path: ['toWalletId'],
          message: 'Choose a different wallet',
        });
      }
    }
    if (values.endDate && values.endDate < values.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Must be on or after the first date',
      });
    }
  });

// Server error paths like "template.amount" point at our flat form fields.
const FIELDS = [
  'type',
  'merchant',
  'amount',
  'walletId',
  'toWalletId',
  'categoryId',
  'frequency',
  'interval',
  'startDate',
  'endDate',
  'note',
];

function toFormValues(rule, { defaultWalletId, today }) {
  const t = rule?.template;
  return {
    type: t?.type ?? 'expense',
    merchant: t?.merchant ?? '',
    amount: paiseToInput(t?.amount ?? null),
    walletId: t?.walletId ?? defaultWalletId ?? '',
    toWalletId: t?.toWalletId ?? '',
    categoryId: t?.categoryId ?? '',
    frequency: rule?.frequency ?? 'monthly',
    interval: String(rule?.interval ?? 1),
    // Editing keeps the original first date, so the dates stay on the same day.
    startDate: rule?.startDate ?? today,
    endDate: rule?.endDate ?? '',
    note: t?.note ?? '',
  };
}

function toPayload(values) {
  const template = {
    type: values.type,
    amount: parseRupeesToPaise(values.amount),
    walletId: values.walletId,
    merchant: values.merchant,
    note: values.note,
  };
  if (values.type === 'transfer') template.toWalletId = values.toWalletId;
  else template.categoryId = values.categoryId || null;
  return {
    template,
    frequency: values.frequency,
    interval: values.interval,
    startDate: values.startDate,
    endDate: values.endDate || null,
  };
}

// Server errors come back as "template.walletId"; show them on the matching field.
function flattenTemplateErrors(error) {
  const details = error?.details;
  if (!Array.isArray(details)) return error;
  return {
    ...error,
    details: details.map((d) => ({ ...d, path: String(d.path).replace(/^template\./, '') })),
  };
}

function RecurringForm({ rule, wallets, categories, onDone }) {
  const timeZone = useTimeZone();
  const today = toLocalDate(new Date(), timeZone);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(rule, { defaultWalletId: wallets[0]?.id, today }),
  });
  const { create, update } = useRecurringMutations();
  const mutation = rule ? update : create;
  const { errors } = form.formState;
  const [type, frequency, interval, startDate] = useWatch({
    control: form.control,
    name: ['type', 'frequency', 'interval', 'startDate'],
  });
  const unit = FREQUENCIES.find((f) => f.value === frequency);
  const every = Number(interval) || 1;

  const onSubmit = form.handleSubmit((values) => {
    const payload = toPayload(values);
    const options = {
      onSuccess: () => {
        toast.success(rule ? 'Recurring payment saved' : 'Recurring payment added');
        onDone();
      },
      onError: (error) => applyServerErrors(form, flattenTemplateErrors(error), FIELDS),
    };
    if (rule) update.mutate({ id: rule.id, changes: payload }, options);
    else create.mutate(payload, options);
  });

  const walletOptions = wallets.map((wallet) => (
    <option key={wallet.id} value={wallet.id}>
      {wallet.name}
    </option>
  ));

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormAlert>
        {mutation.error?.code === 'VALIDATION_ERROR' ? null : mutation.error?.message}
      </FormAlert>

      <FormField label="Type" error={errors.type}>
        {(field) => (
          <NativeSelect
            {...field}
            {...form.register('type', {
              onChange: () => form.setValue('categoryId', ''),
            })}
          >
            {TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        {type !== 'transfer' && (
          <FormField label="Name" error={errors.merchant}>
            {(field) => (
              <Input
                {...field}
                placeholder={type === 'income' ? 'Salary' : 'Rent, Netflix, Jio…'}
                {...form.register('merchant')}
              />
            )}
          </FormField>
        )}
        <FormField label="Amount" error={errors.amount}>
          {(field) => <MoneyInput {...field} {...form.register('amount')} />}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={type === 'transfer' ? 'From wallet' : 'Wallet'} error={errors.walletId}>
          {(field) => (
            <NativeSelect {...field} {...form.register('walletId')}>
              {walletOptions}
            </NativeSelect>
          )}
        </FormField>
        {type === 'transfer' ? (
          <FormField label="To wallet" error={errors.toWalletId}>
            {(field) => (
              <NativeSelect {...field} {...form.register('toWalletId')}>
                <option value="">Choose…</option>
                {walletOptions}
              </NativeSelect>
            )}
          </FormField>
        ) : (
          <FormField label="Category" error={errors.categoryId}>
            {(field) => (
              <NativeSelect {...field} {...form.register('categoryId')}>
                <option value="">No category</option>
                {categoryOptions(categories, type).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.depth ? `${SUB_INDENT}${c.name}` : c.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        )}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Repeats</legend>
        <div className="grid grid-cols-[auto_5rem_1fr] items-center gap-2">
          <span className="text-sm text-muted-foreground">Every</span>
          <Input
            aria-label="How many"
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            aria-invalid={errors.interval ? true : undefined}
            {...form.register('interval')}
          />
          <NativeSelect aria-label="How often" {...form.register('frequency')}>
            {FREQUENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {every === 1 ? option.label.toLowerCase() : option.plural}
              </option>
            ))}
          </NativeSelect>
        </div>
        {errors.interval && <p className="text-sm text-destructive">{errors.interval.message}</p>}
        {startDate && unit && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {describeSchedule({ frequency, interval: every, startDate })}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First date" error={errors.startDate}>
          {(field) => <Input {...field} type="date" {...form.register('startDate')} />}
        </FormField>
        <FormField label="Last date (optional)" error={errors.endDate}>
          {(field) => (
            <Input {...field} type="date" min={startDate} {...form.register('endDate')} />
          )}
        </FormField>
      </div>

      <FormField label="Note (optional)" error={errors.note}>
        {(field) => <Input {...field} {...form.register('note')} />}
      </FormField>

      <DialogFooter className="mt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {rule ? 'Save changes' : 'Add recurring payment'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// Add a recurring payment (rule = null) or edit one.
export function RecurringFormDialog({ open, onOpenChange, rule }) {
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = useCategories();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit recurring payment' : 'Add a recurring payment'}</DialogTitle>
          <DialogDescription>
            Rent, salary, a SIP or a subscription. Paisa Pal adds it for you on each date.
          </DialogDescription>
        </DialogHeader>
        <RecurringForm
          key={rule?.id ?? 'new'}
          rule={rule}
          wallets={wallets}
          categories={categories}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
