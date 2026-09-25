import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { updateProfile } from '@/api/users';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { browserTimeZone, MONTH_START_DAYS, timeZoneOptions } from '@/features/onboarding/options';
import { ordinal } from '@/lib/dates';
import { useAuthStore } from '@/store/auth';

// Name, the day the month starts and the time zone.
export function ProfileSection() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [values, setValues] = useState({
    name: user.name,
    monthStartDay: user.monthStartDay,
    timezone: user.timezone,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const changed =
    values.name.trim() !== user.name ||
    values.monthStartDay !== user.monthStartDay ||
    values.timezone !== user.timezone;

  const save = async (event) => {
    event.preventDefault();
    if (!values.name.trim()) return setError('Please enter your name');
    setSaving(true);
    setError(null);
    try {
      setUser(await updateProfile({ ...values, name: values.name.trim() }));
      toast.success('Profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} aria-label="Profile" className="surface grid gap-4 p-5">
      <h2 className="font-semibold">Profile</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Name" error={error ? { message: error } : undefined}>
          {(field) => (
            <Input
              {...field}
              value={values.name}
              maxLength={80}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            />
          )}
        </FormField>
        <FormField label="Month starts on the" hint="Budgets and reports follow this day.">
          {(field) => (
            <NativeSelect
              {...field}
              value={values.monthStartDay}
              onChange={(e) => setValues((v) => ({ ...v, monthStartDay: Number(e.target.value) }))}
            >
              {MONTH_START_DAYS.map((day) => (
                <option key={day} value={day}>
                  {ordinal(day)}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label="Time zone">
          {(field) => (
            <NativeSelect
              {...field}
              value={values.timezone}
              onChange={(e) => setValues((v) => ({ ...v, timezone: e.target.value }))}
            >
              {timeZoneOptions(user.timezone, browserTimeZone()).map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll('_', ' ')}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">
        Email: {user.email} · Currency: Indian Rupee (₹)
      </p>
      <Button type="submit" disabled={!changed || saving} className="justify-self-end">
        {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        Save profile
      </Button>
    </form>
  );
}
