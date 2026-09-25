import { HeartPulse } from 'lucide-react';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ProgressRing } from '@/features/goals/ProgressRing';

const RING = {
  Great: 'stroke-primary',
  Good: 'stroke-primary',
  Fair: 'stroke-gold',
  'Needs care': 'stroke-destructive',
};

// Financial health 0–100 with the five parts behind it and the most useful tip.
export function HealthCard({ health }) {
  if (!health) return null;
  // The weakest part (by share of its maximum) gives the tip to act on first.
  const weakest = [...health.parts].sort((a, b) => a.score / a.max - b.score / b.max)[0];

  return (
    <section aria-label="Money health" className="surface flex flex-col gap-4 p-5">
      <div className="flex items-center gap-4">
        <ProgressRing
          percent={health.score}
          size={76}
          label={`Money health ${health.score} out of 100, ${health.grade}`}
          ringClassName={RING[health.grade]}
        >
          <span className="text-lg">{health.score}</span>
        </ProgressRing>
        <div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <HeartPulse className="size-4 text-primary" aria-hidden="true" />
            Money health
          </p>
          <p className="text-xl font-semibold">{health.grade}</p>
          <p className="text-xs text-muted-foreground">out of 100</p>
        </div>
      </div>

      <ul className="grid gap-2.5">
        {health.parts.map((part) => (
          <li key={part.key} className="grid gap-1">
            <div className="flex justify-between text-xs">
              <span>{part.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {part.score}/{part.max}
              </span>
            </div>
            <ProgressBar
              percent={Math.round((part.score / part.max) * 100)}
              tone="ok"
              label={`${part.label}: ${part.score} of ${part.max}`}
            />
          </li>
        ))}
      </ul>

      <p className="rounded-lg bg-muted/70 p-3 text-sm">
        <span className="font-medium">Tip: </span>
        {weakest.tip}
      </p>
    </section>
  );
}
