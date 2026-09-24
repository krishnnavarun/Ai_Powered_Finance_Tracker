import { MessageSquareText, ScanLine, TrendingUp } from 'lucide-react';
import { Outlet } from 'react-router';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

const HIGHLIGHTS = [
  { icon: ScanLine, text: 'Log expenses by typing, pasting a bank SMS or scanning a receipt' },
  { icon: TrendingUp, text: 'See your month-end balance before the month ends' },
  { icon: MessageSquareText, text: 'Ask questions about your money in plain language' },
];

// Layout for login / register: the form on the right, a short product pitch on large screens.
export function AuthLayout() {
  useDocumentTitle();

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Logo className="[&>span:first-child]:bg-primary-foreground [&>span:first-child]:text-primary" />
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold tracking-tight">
            Track your money without the tedium.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-primary-foreground/90">
                <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-primary-foreground/70">Made for India — ₹, UPI and bank SMS.</p>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Logo className="lg:invisible" />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
