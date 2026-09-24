import { MessageSquareText, ScanLine, ShieldCheck, TrendingUp } from 'lucide-react';
import { m } from 'motion/react';
import { Outlet } from 'react-router';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { AuroraBackground } from './AuroraBackground';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const HIGHLIGHTS = [
  { icon: ScanLine, text: 'Add a payment by typing, pasting an SMS or taking a photo' },
  { icon: TrendingUp, text: 'See how much money you will have at month end' },
  { icon: MessageSquareText, text: 'Ask questions about your money in simple words' },
  { icon: ShieldCheck, text: 'Your data stays private and safe' },
];

const fadeUp = (delay) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
});

// A preview "bank card" that floats and tilts slowly on the brand panel.
function FloatingCard() {
  return (
    <m.div
      aria-hidden="true"
      initial={{ opacity: 0, y: 30, rotate: -8 }}
      animate={{ opacity: 1, y: [0, -10, 0], rotate: [-6, -3, -6] }}
      transition={{
        opacity: { duration: 0.8 },
        y: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
        rotate: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
      }}
      className="relative h-44 w-72 rounded-2xl bg-linear-to-br from-white/25 to-white/5 p-5 shadow-2xl ring-1 ring-white/25 backdrop-blur-md"
    >
      <div className="h-7 w-10 rounded-md bg-linear-to-br from-[oklch(0.9_0.1_90)] to-[oklch(0.7_0.14_70)] ring-1 ring-black/10" />
      <p className="mt-6 text-xs text-white/70">Saved this month</p>
      <p className="text-2xl font-semibold tracking-tight">₹12,450</p>
      <p className="absolute right-5 bottom-4 text-xs tracking-[0.3em] text-white/70">PAISA PAL</p>
    </m.div>
  );
}

// Layout for login / register: a brand panel on large screens, the form on the right.
export function AuthLayout() {
  useDocumentTitle();

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-[oklch(0.4_0.1_164)] via-[oklch(0.3_0.08_168)] to-[oklch(0.18_0.05_172)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Moving lights inside the panel */}
        <div
          className="aurora-blob -top-24 -left-24 size-96 animate-[aurora-a_24s_ease-in-out_infinite] bg-[oklch(0.7_0.15_163/45%)]"
          aria-hidden="true"
        />
        <div
          className="aurora-blob -right-24 -bottom-24 size-96 animate-[aurora-b_30s_ease-in-out_infinite] bg-[oklch(0.82_0.14_82/35%)]"
          aria-hidden="true"
        />

        <Logo inverted className="relative text-white" />

        <div className="relative max-w-md">
          <m.h2 {...fadeUp(0.1)} className="text-4xl leading-tight font-semibold tracking-tight">
            Save more. <span className="text-[oklch(0.86_0.13_85)]">Worry less.</span>
          </m.h2>
          <m.p {...fadeUp(0.2)} className="mt-3 text-white/80">
            Paisa Pal tracks your money for you, so you can focus on your goals.
          </m.p>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }, index) => (
              <m.li key={text} {...fadeUp(0.3 + index * 0.08)} className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/15">
                  <Icon className="size-4 text-[oklch(0.86_0.13_85)]" aria-hidden="true" />
                </span>
                <span className="pt-1 text-white/90">{text}</span>
              </m.li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-end justify-between gap-6">
          <p className="text-sm text-white/70">Made for India: ₹, UPI and bank SMS.</p>
          <FloatingCard />
        </div>
      </aside>

      <div className="relative flex flex-col">
        <AuroraBackground />
        <header className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
          <m.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="surface w-full max-w-sm p-6 sm:p-8"
          >
            <Outlet />
          </m.div>
        </main>
      </div>
    </div>
  );
}
