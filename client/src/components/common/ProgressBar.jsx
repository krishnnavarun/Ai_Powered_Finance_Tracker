import { m } from 'motion/react';
import { cn } from '@/lib/utils';

const TONES = {
  ok: 'bg-primary',
  warning: 'bg-gold',
  over: 'bg-destructive',
};

// A bar that fills to `percent` (capped at 100) when it appears. The meaning is always
// also given in text next to it, so colour is never the only signal.
export function ProgressBar({ percent, tone = 'ok', label, className }) {
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <m.div
        className={cn('h-full rounded-full', TONES[tone])}
        initial={{ width: 0 }}
        animate={{ width: `${width}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}
