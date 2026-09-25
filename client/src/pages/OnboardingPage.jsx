import { ArrowLeft, ArrowRight, Check, LoaderCircle } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { updateProfile, updateSettings } from '@/api/users';
import { FormAlert } from '@/components/common/FormAlert';
import { AuroraBackground } from '@/components/layout/AuroraBackground';
import { Logo } from '@/components/layout/Logo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/button';
import { AiStep } from '@/features/onboarding/AiStep';
import { BasicsStep } from '@/features/onboarding/BasicsStep';
import { browserTimeZone } from '@/features/onboarding/options';
import { WalletsStep } from '@/features/onboarding/WalletsStep';
import { useWallets } from '@/features/wallets/useWallets';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

const STEPS = [
  { title: 'Your month', description: 'A few basics so dates and budgets fit your life.' },
  { title: 'Your wallets', description: 'Where do you keep your money? Add one or more.' },
  { title: 'AI helper', description: 'Paisa Pal can use AI to save you typing.' },
];

// First-run setup: month start day + time zone, first wallets, the AI switch.
// Shown once after sign-up; "Skip for now" also marks it done.
export function OnboardingPage() {
  useDocumentTitle();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();
  const { data: wallets = [] } = useWallets();
  const [detectedTimeZone] = useState(browserTimeZone);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [basics, setBasics] = useState(() => ({
    monthStartDay: user?.monthStartDay ?? 1,
    // A new account has the default zone; suggest the device's own instead.
    timezone: user?.timezone && user.timezone !== 'Asia/Kolkata' ? user.timezone : detectedTimeZone,
  }));
  const [aiEnabled, setAiEnabled] = useState(user?.settings?.aiEnabled ?? true);
  const [saving, setSaving] = useState(null); // 'finish' | 'skip' | null
  const [error, setError] = useState(null);

  if (user?.onboardingDone && !saving) return <Navigate to="/dashboard" replace />;

  const go = (to) => {
    setDirection(to > step ? 1 : -1);
    setStep(to);
  };

  const save = async (kind) => {
    setSaving(kind);
    setError(null);
    try {
      if (kind === 'finish') await updateSettings({ aiEnabled });
      const saved = await updateProfile(
        kind === 'finish' ? { ...basics, onboardingDone: true } : { onboardingDone: true },
      );
      setUser(saved);
      toast.success(
        kind === 'finish'
          ? 'All set! Welcome to Paisa Pal'
          : 'You can set things up later in Settings',
      );
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setSaving(null);
    }
  };

  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AuroraBackground />
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => save('skip')} disabled={Boolean(saving)}>
            Skip for now
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:px-6">
        <div className="surface w-full max-w-xl p-6 sm:p-8">
          <p className="text-sm font-medium text-primary">
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </p>

          <ol aria-label="Setup steps" className="mt-3 flex gap-2">
            {STEPS.map((item, index) => (
              <li key={item.title} className="flex-1">
                <span className="sr-only">
                  {item.title}
                  {index < step ? ' (done)' : index === step ? ' (current step)' : ''}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'block h-1.5 rounded-full transition-colors duration-500',
                    index <= step ? 'bg-linear-to-r from-primary to-gold' : 'bg-muted',
                  )}
                />
              </li>
            ))}
          </ol>

          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <m.section
              key={step}
              aria-labelledby="onboarding-step-title"
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6"
            >
              <p className="text-xs text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </p>
              <h1 id="onboarding-step-title" className="text-2xl font-semibold tracking-tight">
                {current.title}
              </h1>
              <p className="mt-1 mb-5 text-sm text-muted-foreground">{current.description}</p>

              {step === 0 && (
                <BasicsStep
                  values={basics}
                  detectedTimeZone={detectedTimeZone}
                  onChange={(changes) => setBasics((prev) => ({ ...prev, ...changes }))}
                />
              )}
              {step === 1 && <WalletsStep />}
              {step === 2 && <AiStep aiEnabled={aiEnabled} onChange={setAiEnabled} />}
            </m.section>
          </AnimatePresence>

          <div className="mt-6">
            <FormAlert>{error}</FormAlert>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => go(step - 1)} disabled={Boolean(saving)}>
                <ArrowLeft aria-hidden="true" />
                Back
              </Button>
            ) : (
              <span />
            )}
            {last ? (
              <Button onClick={() => save('finish')} disabled={Boolean(saving)}>
                {saving === 'finish' ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
                Finish
              </Button>
            ) : (
              <Button onClick={() => go(step + 1)}>
                {step === 1 && wallets.length === 0 ? 'Skip this step' : 'Next'}
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
