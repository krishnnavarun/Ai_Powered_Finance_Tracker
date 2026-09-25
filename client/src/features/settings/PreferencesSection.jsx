import { useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { toast } from 'sonner';
import { updateSettings } from '@/api/users';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';

const SWITCHES = [
  {
    key: 'aiEnabled',
    label: 'AI helper',
    hint: 'Reads typed notes, SMS and receipts, sorts payments and powers the assistant. Card numbers, phone numbers and emails are hidden before anything is sent. Everything else works with it off.',
  },
  {
    key: 'digestEmail',
    label: 'Weekly email',
    hint: 'A short summary of your week every Monday. It’s always in the app too.',
  },
  {
    key: 'budgetAlerts',
    label: 'Budget alerts',
    hint: 'Tell me when I’ve used 80% or all of a budget.',
  },
];

function SwitchRow({ label, hint, checked, onChange }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted-foreground">
          {hint}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={`${id}-hint`}
      />
    </div>
  );
}

// Switches for AI, the weekly email and budget alerts, plus the theme.
export function PreferencesSection() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const queryClient = useQueryClient();
  const themeId = useId();

  const change = async (changes, message) => {
    const before = user;
    // Show the change at once; put it back if saving fails.
    setUser({ ...user, settings: { ...user.settings, ...changes } });
    try {
      setUser(await updateSettings(changes));
      if ('aiEnabled' in changes) queryClient.invalidateQueries({ queryKey: ['ai-status'] });
      if (message) toast.success(message);
    } catch (error) {
      setUser(before);
      toast.error(error.message);
    }
  };

  return (
    <section aria-label="Preferences" className="surface grid gap-1 p-5">
      <h2 className="mb-1 font-semibold">Preferences</h2>
      <div className="divide-y">
        {SWITCHES.map(({ key, label, hint }) => (
          <SwitchRow
            key={key}
            label={label}
            hint={hint}
            checked={user.settings?.[key] !== false}
            onChange={(checked) =>
              change({ [key]: checked }, `${label} turned ${checked ? 'on' : 'off'}`)
            }
          />
        ))}
        <div className="flex items-center justify-between gap-4 py-3">
          <Label htmlFor={themeId}>Theme</Label>
          <NativeSelect
            id={themeId}
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value);
              change({ theme: event.target.value });
            }}
            className="w-36"
          >
            <option value="system">Same as device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </NativeSelect>
        </div>
      </div>
    </section>
  );
}
