import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileSpreadsheet, LoaderCircle, Sparkles, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import * as importsApi from '@/api/imports';
import { EmptyState } from '@/components/common/EmptyState';
import { FormAlert } from '@/components/common/FormAlert';
import { Money } from '@/components/common/Money';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { categoryOptions, useCategories } from '@/features/categories/useCategories';
import { ColumnMapping } from '@/features/import/ColumnMapping';
import { useWallets } from '@/features/wallets/useWallets';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

const MAX_CSV_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT = 2000;
const PAGE = 100; // rows shown at a time

// Rows from the preview, with a tick (possible duplicates start unticked).
const toReviewRows = (rows) => rows.map((row) => ({ ...row, selected: !row.duplicate }));

function ReviewRow({ row, categories, onChange }) {
  const name = row.merchant || row.description || 'Payment';
  return (
    <li
      className={cn(
        'grid gap-2 border-b px-3 py-2.5 last:border-b-0 sm:grid-cols-[auto_6rem_1fr_12rem_7rem] sm:items-center',
        !row.selected && 'opacity-55',
      )}
    >
      <Checkbox
        checked={row.selected}
        onCheckedChange={(checked) => onChange({ selected: checked === true })}
        aria-label={`Import ${name} on ${row.date}`}
      />
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatDate(`${row.date}T00:00:00Z`, 'UTC')}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 truncate font-medium">
          {name}
          {row.duplicate && (
            <Badge variant="outline" className="border-gold/60">
              Maybe added already
            </Badge>
          )}
        </span>
        {row.description && row.description !== name && (
          <span className="block truncate text-xs text-muted-foreground">{row.description}</span>
        )}
      </span>
      <NativeSelect
        aria-label={`Category for ${name} on ${row.date}`}
        value={row.categoryId ?? ''}
        onChange={(event) => onChange({ categoryId: event.target.value || null })}
        className={cn(row.via === 'ai' && 'border-gold/50')}
      >
        <option value="">No category</option>
        {categoryOptions(categories, row.type).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </NativeSelect>
      <Money
        paise={row.type === 'expense' ? -row.amount : row.amount}
        tone={row.type}
        className="text-right font-semibold"
      />
    </li>
  );
}

export function ImportPage() {
  const fileId = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: wallets = [], isPending: walletsLoading } = useWallets();
  const { data: categories = [] } = useCategories();

  const [walletId, setWalletId] = useState('');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [editingColumns, setEditingColumns] = useState(false);
  const [keepBalance, setKeepBalance] = useState(true);
  const [shown, setShown] = useState(PAGE);

  const chosenWallet = walletId || wallets[0]?.id || '';
  const wallet = wallets.find((w) => w.id === chosenWallet);

  const read = useMutation({
    mutationFn: ({ mapping } = {}) => importsApi.previewCsv(file, mapping),
    onSuccess: (data) => {
      setPreview(data);
      setRows(toReviewRows(data.rows));
      setEditingColumns(data.needsMapping);
      setShown(PAGE);
    },
  });
  const save = useMutation({
    mutationFn: importsApi.commitCsv,
    onSuccess: ({ imported }) => {
      ['transactions', 'wallets', 'budgets', 'reports'].forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      );
      toast.success(`Imported ${imported} transaction${imported === 1 ? '' : 's'}`);
      navigate('/transactions');
    },
  });

  const pick = (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (!chosen) return;
    const problem = !/\.(csv|txt)$/i.test(chosen.name)
      ? 'Please choose a CSV file. In Excel: File → Save As → CSV.'
      : chosen.size > MAX_CSV_BYTES
        ? 'The file must be 10 MB or smaller'
        : null;
    setFileError(problem);
    setFile(problem ? null : chosen);
    setPreview(null);
  };

  const update = (index, changes) =>
    setRows((list) => list.map((row) => (row.index === index ? { ...row, ...changes } : row)));

  const selected = rows.filter((row) => row.selected);
  const duplicates = rows.filter((row) => row.duplicate).length;
  const uncategorised = selected.filter((row) => !row.categoryId).length;
  const net = selected.reduce((sum, r) => sum + (r.type === 'income' ? r.amount : -r.amount), 0);
  const allSelected = rows.length > 0 && selected.length === rows.length;

  const importRows = () =>
    save.mutate({
      walletId: chosenWallet,
      keepBalance,
      rows: selected.map((row) => ({
        date: row.date,
        type: row.type,
        amount: row.amount,
        categoryId: row.categoryId,
        merchant: row.merchant.slice(0, 100),
        note: row.description.slice(0, 500),
        aiConfidence: row.confidence,
      })),
    });

  if (!walletsLoading && wallets.length === 0) {
    return (
      <>
        <PageHeader
          title="Import statement"
          description="Add many payments from your bank at once"
        />
        <EmptyState
          icon={FileSpreadsheet}
          title="Add a wallet first"
          description="Imported payments go into a wallet, like your bank account."
          action={
            <Button asChild>
              <Link to="/wallets">Go to wallets</Link>
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Import statement"
        description="Add many payments from your bank at once"
        actions={
          <Button variant="ghost" asChild>
            <Link to="/transactions">
              <ArrowLeft aria-hidden="true" />
              Back to transactions
            </Link>
          </Button>
        }
      />

      <section aria-label="Statement file" className="surface mb-4 grid gap-4 p-5 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <Label htmlFor="import-wallet">Which account is this statement for?</Label>
          <NativeSelect
            id="import-wallet"
            value={chosenWallet}
            onChange={(event) => setWalletId(event.target.value)}
          >
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid content-start gap-1.5">
          <Label htmlFor={fileId}>Statement file (CSV)</Label>
          <input
            id={fileId}
            type="file"
            accept=".csv,text/csv,.txt"
            onChange={pick}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          <p className="text-xs text-muted-foreground">
            Download it from your bank’s website or app (CSV, up to 10 MB).
          </p>
        </div>
        <div className="grid gap-3 sm:col-span-2">
          <FormAlert>{fileError ?? read.error?.message}</FormAlert>
          <Button
            onClick={() => read.mutate()}
            disabled={!file || read.isPending}
            className="justify-self-end"
          >
            {read.isPending ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            {read.isPending ? 'Reading…' : 'Read file'}
          </Button>
        </div>
      </section>

      {preview && editingColumns && (
        <ColumnMapping
          key={JSON.stringify(preview.mapping)}
          preview={preview}
          pending={read.isPending}
          onApply={(mapping) => read.mutate({ mapping })}
        />
      )}

      {preview && !editingColumns && (
        <section aria-label="Review" className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{rows.length} payments found</Badge>
            {duplicates > 0 && (
              <Badge variant="outline" className="border-gold/60">
                {duplicates} maybe added already (unticked)
              </Badge>
            )}
            {uncategorised > 0 && (
              <Badge variant="outline">{uncategorised} without a category</Badge>
            )}
            {preview.skipped > 0 && (
              <Badge variant="outline">{preview.skipped} lines skipped (totals, blank lines)</Badge>
            )}
            {preview.usedAI && (
              <Badge variant="secondary">
                <Sparkles aria-hidden="true" /> AI helped
              </Badge>
            )}
            <Button variant="link" size="sm" onClick={() => setEditingColumns(true)}>
              Wrong columns?
            </Button>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="No payments found"
              description="Check the columns, or try another file."
            />
          ) : (
            <div className="surface overflow-hidden">
              <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-sm">
                <Checkbox
                  checked={allSelected ? true : selected.length ? 'indeterminate' : false}
                  onCheckedChange={() =>
                    setRows((list) => list.map((row) => ({ ...row, selected: !allSelected })))
                  }
                  aria-label="Select all"
                />
                <span className="text-muted-foreground">
                  {selected.length} of {rows.length} selected
                </span>
              </div>
              <ul aria-label="Payments to import">
                {rows.slice(0, shown).map((row) => (
                  <ReviewRow
                    key={row.index}
                    row={row}
                    categories={categories}
                    onChange={(changes) => update(row.index, changes)}
                  />
                ))}
              </ul>
              {rows.length > shown && (
                <div className="border-t p-2 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                    Show {Math.min(PAGE, rows.length - shown)} more
                  </Button>
                </div>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <div className="surface grid gap-4 p-5">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox
                  checked={keepBalance}
                  onCheckedChange={(checked) => setKeepBalance(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">
                    Keep the {wallet?.name ?? 'wallet'} balance as it is
                  </span>
                  <span className="block text-muted-foreground">
                    Leave this on if the balance you entered already includes these payments (usual
                    for past statements). Turn it off to {net >= 0 ? 'add' : 'take'}{' '}
                    {formatMoney(Math.abs(net))} {net >= 0 ? 'to' : 'from'} the balance.
                  </span>
                </span>
              </label>
              {selected.length > MAX_IMPORT && (
                <FormAlert>
                  Import up to {MAX_IMPORT.toLocaleString('en-IN')} payments at a time. Untick some,
                  then import the rest after.
                </FormAlert>
              )}
              <FormAlert>{save.error?.message}</FormAlert>
              <Button
                onClick={importRows}
                disabled={!selected.length || selected.length > MAX_IMPORT || save.isPending}
                className="justify-self-end"
              >
                {save.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                Import {selected.length} payment{selected.length === 1 ? '' : 's'}
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
