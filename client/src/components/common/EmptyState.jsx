import { m } from 'motion/react';
import { cn } from '@/lib/utils';

// Friendly placeholder for empty lists and not-yet-built pages. `action` is usually a Button.
// Use titleAs="h1" when the empty state is the whole page (404, error), so the page has a heading.
export function EmptyState({ icon: Icon, title, description, action, className, titleAs = 'h2' }) {
  const Title = titleAs;
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'surface flex flex-col items-center justify-center border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="relative mb-5 animate-float">
          <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl" aria-hidden="true" />
          <div className="relative flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-[color-mix(in_oklab,var(--primary)_70%,black)] text-primary-foreground shadow-lg ring-2 ring-gold/40">
            <Icon className="size-6" aria-hidden="true" />
          </div>
        </div>
      )}
      <Title className="text-base font-semibold">{title}</Title>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </m.div>
  );
}
