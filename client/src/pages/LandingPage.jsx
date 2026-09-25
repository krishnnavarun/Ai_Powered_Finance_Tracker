import {
  ArrowRight,
  Bell,
  EyeOff,
  LineChart,
  LoaderCircle,
  MessageSquareText,
  PiggyBank,
  Repeat,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Tags,
} from 'lucide-react';
import { m } from 'motion/react';
import { Link, Navigate, useNavigate } from 'react-router';
import { FormAlert } from '@/components/common/FormAlert';
import { FullPageLoader } from '@/components/common/FullPageLoader';
import { AuroraBackground } from '@/components/layout/AuroraBackground';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useDemo } from '@/features/auth/useAuthMutations';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/store/auth';

const FEATURES = [
  {
    icon: ScanLine,
    title: 'Add payments in seconds',
    text: 'Type “spent 250 on biryani yesterday”, paste bank SMS, snap a receipt or import a statement.',
  },
  {
    icon: Tags,
    title: 'Sorted for you',
    text: 'Payments land in the right category, and it learns from every fix you make.',
  },
  {
    icon: LineChart,
    title: 'See month end coming',
    text: 'A forecast of your balance, so you know early if money will run low.',
  },
  {
    icon: Bell,
    title: 'Warnings that explain themselves',
    text: 'Unusual spending, double charges and budget alerts — each with a “Why?”.',
  },
  {
    icon: Repeat,
    title: 'Find forgotten subscriptions',
    text: 'Repeating charges are spotted with their yearly cost, so you can cancel what you don’t use.',
  },
  {
    icon: MessageSquareText,
    title: 'Ask in plain words',
    text: '“Compare food spending with last month” — answers from your own data, with charts.',
  },
];

const STEPS = [
  ['Add your wallets', 'Bank, cash, UPI or card — with what’s in them today.'],
  ['Capture as you go', 'Type, paste, snap or import. Check it, save it.'],
  ['Decide with clear numbers', 'Budgets, goals, forecasts and tips that say why.'],
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-40px' },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] },
});

// A made-up peek at the app, drawn with plain elements (no screenshots to go stale).
function Preview() {
  const bars = [
    ['Rent', 100],
    ['Food & Dining', 46],
    ['Groceries', 38],
    ['Transport', 17],
  ];
  return (
    <m.div
      aria-hidden="true"
      initial={{ opacity: 0, y: 30, rotate: 2 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto w-full max-w-md"
    >
      <div className="surface p-5">
        <p className="text-xs text-muted-foreground">Expected balance on 30 Sept</p>
        <p className="text-3xl font-semibold tracking-tight">₹48,320</p>
        <div className="mt-4 grid gap-2.5">
          {bars.map(([label, width], i) => (
            <div key={label} className="grid gap-1">
              <div className="flex justify-between text-xs">
                <span>{label}</span>
                <span className="text-muted-foreground">
                  {['₹15,000', '₹6,900', '₹5,700', '₹2,550'][i]}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <m.div
                  className="h-full rounded-full bg-chart-out"
                  initial={{ width: 0 }}
                  animate={{ width: `${width}%` }}
                  transition={{ duration: 0.9, delay: 0.5 + i * 0.1 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <m.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.9 }}
        className="surface absolute -right-2 -bottom-8 max-w-60 p-3 text-xs sm:-right-8"
      >
        <p className="font-medium">Charged twice at Swiggy?</p>
        <p className="text-muted-foreground">Two payments of ₹345, 4 minutes apart.</p>
      </m.div>
      <m.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.1 }}
        className="absolute -top-6 -left-2 flex items-center gap-2 rounded-2xl bg-primary px-3 py-2 text-xs text-primary-foreground shadow-lg sm:-left-8"
      >
        <Sparkles className="size-3.5 text-gold" />
        spent 250 on biryani yesterday
      </m.div>
    </m.div>
  );
}

function DemoButton({ size = 'lg', className }) {
  const demo = useDemo();
  const navigate = useNavigate();
  return (
    <>
      <Button
        size={size}
        className={className}
        disabled={demo.isPending}
        onClick={() => demo.mutate(undefined, { onSuccess: () => navigate('/dashboard') })}
      >
        {demo.isPending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles aria-hidden="true" />
        )}
        {demo.isPending ? 'Setting up your demo…' : 'Try the demo'}
      </Button>
      {demo.isError && (
        <div className="basis-full">
          <FormAlert>{demo.error.message}</FormAlert>
        </div>
      )}
    </>
  );
}

// The public home page. Logged-in visitors go straight to their dashboard.
export function LandingPage() {
  useDocumentTitle();
  const status = useAuthStore((state) => state.status);
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative min-h-dvh">
      <AuroraBackground />
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Account" className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/register">Get started</Link>
          </Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <div>
            <m.p
              {...fadeUp()}
              className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium"
            >
              <Sparkles className="size-3.5 text-gold" aria-hidden="true" />
              Money tracker for India, with AI that shows its work
            </m.p>
            <m.h1
              {...fadeUp(0.05)}
              className="mt-5 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl"
            >
              Save more. <span className="text-gold-foreground dark:text-gold">Worry less.</span>
            </m.h1>
            <m.p {...fadeUp(0.1)} className="mt-4 max-w-lg text-lg text-muted-foreground">
              Paisa Pal does the logging, sorting and forecasting. You just make the decisions. ₹,
              UPI and Indian bank SMS understood.
            </m.p>
            <m.div {...fadeUp(0.15)} className="mt-8 flex flex-wrap gap-3">
              <DemoButton />
              <Button size="lg" variant="outline" asChild>
                <Link to="/register">
                  Create a free account
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </m.div>
            <m.p {...fadeUp(0.2)} className="mt-3 text-xs text-muted-foreground">
              The demo is your own copy with six months of sample data. It’s deleted after a day.
            </m.p>
          </div>
          <Preview />
        </section>

        <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <m.h2
            {...fadeUp()}
            id="features-title"
            className="text-center text-3xl font-semibold tracking-tight"
          >
            Everything a money diary should do for you
          </m.h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <m.li
                key={title}
                {...fadeUp(i * 0.05)}
                className="surface p-5 transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </m.li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <m.h2
            {...fadeUp()}
            id="how-title"
            className="text-center text-3xl font-semibold tracking-tight"
          >
            How it works
          </m.h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <m.li key={title} {...fadeUp(i * 0.08)} className="surface flex gap-4 p-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/20 font-semibold text-gold-foreground dark:text-gold">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </div>
              </m.li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="privacy-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <m.div
            {...fadeUp()}
            className="surface grid gap-6 p-8 md:grid-cols-[auto_1fr] md:items-center"
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-7" aria-hidden="true" />
            </span>
            <div>
              <h2 id="privacy-title" className="text-2xl font-semibold tracking-tight">
                Private by design
              </h2>
              <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <li className="flex gap-2">
                  <EyeOff className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  Card numbers, phone numbers and emails are hidden before anything reaches the AI.
                </li>
                <li className="flex gap-2">
                  <PiggyBank className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  All the maths — forecasts, scores, alerts — is plain, checkable code.
                </li>
                <li className="flex gap-2">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  Turn AI off any time. Everything else keeps working.
                </li>
              </ul>
            </div>
          </m.div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-4 pb-24 text-center sm:px-6">
          <m.h2 {...fadeUp()} className="text-3xl font-semibold tracking-tight">
            See it with real-looking numbers
          </m.h2>
          <m.div {...fadeUp(0.05)} className="mt-6 flex flex-wrap justify-center gap-3">
            <DemoButton />
          </m.div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Paisa Pal · Not financial advice · Made in India
      </footer>
    </div>
  );
}
