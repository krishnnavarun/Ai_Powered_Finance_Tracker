import { m } from 'motion/react';
import { cn } from '@/lib/utils';

// Circular progress: the ring draws itself up to `percent` when it appears.
// `label` is read by screen readers; `children` replaces the "40%" in the middle.
export function ProgressRing({
  percent,
  size = 72,
  done = false,
  label,
  className,
  ringClassName,
  children,
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const value = Math.max(0, Math.min(100, percent));

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${value}% saved`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={ringClassName ?? (done ? 'stroke-gold' : 'stroke-primary')}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: value / 100 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-sm font-semibold"
        aria-hidden="true"
      >
        {children ?? `${value}%`}
      </span>
    </div>
  );
}
