import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';

// Sticky top bar. Shows the logo on phones (the sidebar has it on desktop).
// Quick add, search and the user menu join it in later checkpoints.
export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-8">
      <Logo className="md:hidden" />
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}
