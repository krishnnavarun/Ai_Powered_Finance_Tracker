import { CircleAlert, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  // role="alert" is announced immediately by screen readers; "status" politely.
  error: {
    role: 'alert',
    icon: CircleAlert,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  info: {
    role: 'status',
    icon: Info,
    className: 'border-primary/30 bg-primary/10 text-foreground',
  },
};

// Message box for problems that don't belong to one field (wrong password, server down…)
// or for notices like "your session expired".
export function FormAlert({ children, tone = 'error' }) {
  if (!children) return null;
  const { role, icon: Icon, className } = TONES[tone];

  return (
    <div
      role={role}
      className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
