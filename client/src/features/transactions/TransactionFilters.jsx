import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

const SEARCH_DELAY_MS = 300;

// Search box + filter selects. `filters` comes from useTransactionFilters().
export function TransactionFilters({ filters, wallets, categories }) {
  const { values, setFilter, clearFilters, hasFilters } = filters;

  // Wait until the user stops typing before searching.
  const [search, setSearch] = useState(values.q);
  useEffect(() => {
    if (search === values.q) return undefined;
    const timer = setTimeout(() => setFilter('q', search.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, values.q, setFilter]);

  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.parentId);
  const incomeCategories = categories.filter((c) => c.type === 'income' && !c.parentId);

  const select = (key, label, options) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`filter-${key}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NativeSelect
        id={`filter-${key}`}
        value={values[key]}
        onChange={(event) => setFilter(key, event.target.value)}
      >
        {options}
      </NativeSelect>
    </div>
  );

  return (
    <section aria-label="Filters" className="surface mb-4 grid gap-3 p-3 sm:p-4">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Search transactions"
          data-shortcut="search"
          placeholder="Search merchant or note…"
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {select('type', 'Type', [
          <option key="" value="">
            All types
          </option>,
          <option key="expense" value="expense">
            Expenses
          </option>,
          <option key="income" value="income">
            Income
          </option>,
          <option key="transfer" value="transfer">
            Transfers
          </option>,
        ])}
        {select('walletId', 'Wallet', [
          <option key="" value="">
            All wallets
          </option>,
          ...wallets.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.name}
            </option>
          )),
        ])}
        {select('categoryId', 'Category', [
          <option key="" value="">
            All categories
          </option>,
          <optgroup key="expense" label="Expense">
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>,
          <optgroup key="income" label="Income">
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>,
        ])}
        <div className="grid gap-1.5">
          <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="filter-from"
            type="date"
            value={values.from}
            max={values.to || undefined}
            onChange={(event) => setFilter('from', event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="filter-to"
            type="date"
            value={values.to}
            min={values.from || undefined}
            onChange={(event) => setFilter('to', event.target.value)}
          />
        </div>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => {
            setSearch('');
            clearFilters();
          }}
        >
          <X aria-hidden="true" />
          Clear filters
        </Button>
      )}
    </section>
  );
}
