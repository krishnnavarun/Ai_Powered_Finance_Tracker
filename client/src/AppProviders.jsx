import { TooltipProvider } from '@/components/ui/tooltip';
import { useThemeSync } from '@/hooks/useThemeSync';

// App-wide providers and effects. Shared by the real app and the tests.
// (TanStack Query and auth providers join here in CP6.)
export function AppProviders({ children }) {
  useThemeSync();
  return <TooltipProvider>{children}</TooltipProvider>;
}
