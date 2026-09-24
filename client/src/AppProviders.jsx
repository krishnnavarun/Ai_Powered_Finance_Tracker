import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSessionBootstrap } from '@/hooks/useSessionBootstrap';
import { useThemeSync } from '@/hooks/useThemeSync';
import { createQueryClient } from '@/lib/queryClient';

// App-wide providers and effects. Shared by the real app and the tests
// (tests pass their own queryClient so each test starts with an empty cache).
export function AppProviders({ children, queryClient }) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  useThemeSync();
  useSessionBootstrap();

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
