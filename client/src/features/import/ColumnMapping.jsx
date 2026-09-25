import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';

// The columns a statement can have, in plain words. Either money out + money in, or
// one amount column (minus = money out), maybe with a Dr/Cr column.
const FIELDS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'description', label: 'Description' },
  { key: 'debit', label: 'Money out' },
  { key: 'credit', label: 'Money in' },
  { key: 'amount', label: 'Amount (one column, minus = money out)' },
  { key: 'drcr', label: 'Dr / Cr column' },
];

const EMPTY = {
  date: null,
  description: null,
  debit: null,
  credit: null,
  amount: null,
  drcr: null,
  reference: null,
  balance: null,
};

// Lets the user say which column is which when we couldn't tell (or guessed wrong).
export function ColumnMapping({ preview, onApply, pending }) {
  const [mapping, setMapping] = useState({ ...EMPTY, ...(preview.mapping ?? {}) });
  const headerIndex = Math.max(preview.headerIndex, 0);
  const columns = preview.headers.map((name, i) => ({ index: i, name: name || `Column ${i + 1}` }));
  const usable =
    mapping.date !== null &&
    (mapping.amount !== null || mapping.debit !== null || mapping.credit !== null);

  return (
    <section aria-label="Columns" className="surface grid gap-4 p-5">
      <div>
        <h2 className="font-medium">Which column is which?</h2>
        <p className="text-sm text-muted-foreground">
          Pick the date and the money columns. The first lines of your file are shown below.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((field) => (
          <div key={field.key} className="grid gap-1.5">
            <Label htmlFor={`column-${field.key}`}>{field.label}</Label>
            <NativeSelect
              id={`column-${field.key}`}
              value={mapping[field.key] ?? ''}
              onChange={(event) =>
                setMapping((prev) => ({
                  ...prev,
                  [field.key]: event.target.value === '' ? null : Number(event.target.value),
                }))
              }
            >
              <option value="">{field.required ? 'Choose…' : 'None'}</option>
              {columns.map((column) => (
                <option key={column.index} value={column.index}>
                  {column.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">First lines of the file</caption>
          <thead className="bg-muted/60">
            <tr>
              {columns.map((column) => (
                <th key={column.index} scope="col" className="px-2 py-1.5 font-medium">
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.sample.map((row, r) => (
              <tr key={r} className="border-t">
                {columns.map((column) => (
                  <td key={column.index} className="px-2 py-1.5 whitespace-nowrap">
                    {row[column.index]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button
        onClick={() => onApply({ headerIndex, mapping })}
        disabled={!usable || pending}
        className="justify-self-end"
      >
        Use these columns
      </Button>
    </section>
  );
}
