import { IndianRupee } from 'lucide-react';
import { FormField } from '@/components/common/FormField';
import { NativeSelect } from '@/components/ui/native-select';
import { ordinal } from '@/lib/dates';
import { MONTH_START_DAYS, timeZoneOptions } from './options';

function monthHint(day) {
  if (day === 1) {
    return 'A normal calendar month. If your salary comes on the 25th, pick 25 so your budget month runs from the 25th to the 24th.';
  }
  return `Your budget month will run from the ${ordinal(day)} to the ${ordinal(day - 1)} of the next month.`;
}

// Step 1: currency, the day the month starts and the time zone.
export function BasicsStep({ values, onChange, detectedTimeZone }) {
  const zones = timeZoneOptions(values.timezone, detectedTimeZone);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3 rounded-xl border bg-background/60 p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <IndianRupee className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium">Indian Rupee (₹)</p>
          <p className="text-xs text-muted-foreground">
            Amounts are shown like ₹1,00,000. More currencies are coming later.
          </p>
        </div>
      </div>

      <FormField label="My month starts on the" hint={monthHint(values.monthStartDay)}>
        {(field) => (
          <NativeSelect
            {...field}
            value={values.monthStartDay}
            onChange={(event) => onChange({ monthStartDay: Number(event.target.value) })}
          >
            {MONTH_START_DAYS.map((day) => (
              <option key={day} value={day}>
                {ordinal(day)}
                {day === 1 ? ' (calendar month)' : ''}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      <FormField label="Time zone" hint="Used to decide which day a payment belongs to.">
        {(field) => (
          <NativeSelect
            {...field}
            value={values.timezone}
            onChange={(event) => onChange({ timezone: event.target.value })}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll('_', ' ')}
                {zone === detectedTimeZone ? ' (this device)' : ''}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
    </div>
  );
}
