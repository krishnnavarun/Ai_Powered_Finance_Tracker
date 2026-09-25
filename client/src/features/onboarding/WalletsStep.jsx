import { LoaderCircle, Plus } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useState } from 'react';
import { FormAlert } from '@/components/common/FormAlert';
import { FormField } from '@/components/common/FormField';
import { Money } from '@/components/common/Money';
import { MoneyInput } from '@/components/common/MoneyInput';
import { IconBadge } from '@/components/common/NamedIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWalletMutations, useWallets } from '@/features/wallets/useWallets';
import { walletTypeIcon } from '@/features/wallets/walletTypes';
import { parseRupeesToPaise } from '@/lib/money';
import { cn } from '@/lib/utils';

// Quick picks with a ready name; the name can be changed before adding.
const PRESETS = [
  { type: 'bank', label: 'Bank account', name: 'Bank account' },
  { type: 'cash', label: 'Cash', name: 'Cash' },
  { type: 'upi', label: 'UPI', name: 'UPI wallet' },
  { type: 'card', label: 'Credit card', name: 'Credit card' },
];

// Step 2: add the places money is kept. Each wallet is saved as soon as it's added.
export function WalletsStep() {
  const { data: wallets = [] } = useWallets();
  const { create } = useWalletMutations();
  const [preset, setPreset] = useState(PRESETS[0]);
  const [name, setName] = useState(PRESETS[0].name);
  const [balance, setBalance] = useState('');
  const [error, setError] = useState(null);

  const pick = (option) => {
    setPreset(option);
    setName(option.name);
    setError(null);
  };

  const add = (event) => {
    event.preventDefault();
    const openingBalance = balance.trim() ? parseRupeesToPaise(balance) : 0;
    if (!name.trim()) return setError('Give the wallet a name');
    if (openingBalance === null) return setError('Enter an amount like 2,500.50');
    setError(null);
    create.mutate(
      { name: name.trim(), type: preset.type, icon: walletTypeIcon(preset.type), openingBalance },
      {
        onSuccess: (saved) => {
          setBalance('');
          // Suggest the next kind of wallet that isn't added yet.
          const added = new Set([...wallets.map((w) => w.type), saved.type]);
          const next = PRESETS.find((option) => !added.has(option.type));
          if (next) pick(next);
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="grid gap-5">
      <form onSubmit={add} noValidate className="grid gap-4 rounded-xl border bg-background/60 p-4">
        <div role="radiogroup" aria-label="Wallet type" className="flex flex-wrap gap-1.5">
          {PRESETS.map((option) => (
            <button
              key={option.type}
              type="button"
              role="radio"
              aria-checked={preset.type === option.type}
              onClick={() => pick(option)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 hover:-translate-y-px active:scale-95',
                preset.type === option.type
                  ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Name">
            {(field) => (
              <Input {...field} value={name} onChange={(event) => setName(event.target.value)} />
            )}
          </FormField>
          <FormField label={preset.type === 'card' ? 'Amount owed now' : 'Money in it now'}>
            {(field) => (
              <MoneyInput
                {...field}
                value={balance}
                placeholder={preset.type === 'card' ? '-0' : '0'}
                onChange={(event) => setBalance(event.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormAlert>{error}</FormAlert>
        <Button
          type="submit"
          variant="outline"
          disabled={create.isPending}
          className="justify-self-start"
        >
          {create.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          Add wallet
        </Button>
      </form>

      <section aria-label="Wallets added">
        {wallets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No wallets yet. Add at least one so you can record payments.
          </p>
        ) : (
          <ul className="grid gap-2">
            <AnimatePresence initial={false}>
              {wallets.map((wallet) => (
                <m.li
                  key={wallet.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 rounded-xl border bg-card/80 p-3"
                >
                  <IconBadge icon={wallet.icon} color={wallet.color} />
                  <span className="flex-1 font-medium">{wallet.name}</span>
                  <Money paise={wallet.balance} className="font-medium" />
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>
    </div>
  );
}
