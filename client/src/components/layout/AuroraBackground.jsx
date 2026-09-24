// Slowly drifting emerald, teal and gold lights behind the whole app.
// Pure CSS (see .aurora-blob and the aurora-* keyframes in index.css), so it costs
// almost nothing, and it stands still for people who prefer reduced motion.
export function AuroraBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="aurora-blob top-[-15%] left-[-10%] size-[55vmax] animate-[aurora-a_26s_ease-in-out_infinite]"
        style={{ background: 'var(--aurora-1)' }}
      />
      <div
        className="aurora-blob top-[20%] right-[-20%] size-[50vmax] animate-[aurora-b_32s_ease-in-out_infinite]"
        style={{ background: 'var(--aurora-2)' }}
      />
      <div
        className="aurora-blob bottom-[-25%] left-[20%] size-[45vmax] animate-[aurora-c_38s_ease-in-out_infinite]"
        style={{ background: 'var(--aurora-3)' }}
      />
      {/* A faint dot pattern adds texture, like security print on a bank note. */}
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
        style={{
          backgroundImage: 'radial-gradient(oklch(0.5 0.05 165 / 18%) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
        }}
      />
    </div>
  );
}
