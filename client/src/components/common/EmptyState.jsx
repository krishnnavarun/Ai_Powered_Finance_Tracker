import { cn } from '@/lib/utils';

// Friendly placeholder for empty lists and not-yet-built pages. `action` is usually a Button.
// Use titleAs="h1" when the empty state is the whole page (404, error), so the page has a heading.
export function EmptyState({ icon: Icon, title, description, action, className, titleAs = 'h2' }) {
  const Title = titleAs;
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </div>
      )}
      <Title className="text-base font-semibold">{title}</Title>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
