export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-start gap-3">
        {/* Gold accent bar, like the edge of a bank card. */}
        <span
          className="mt-1.5 h-7 w-1.5 shrink-0 rounded-full bg-linear-to-b from-gold to-primary"
          aria-hidden="true"
        />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
