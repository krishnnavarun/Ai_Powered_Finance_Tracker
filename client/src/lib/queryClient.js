import { QueryClient } from '@tanstack/react-query';

// Retry only failures that might succeed on a second try (network / server errors),
// never 4xx like "not found" or "invalid input".
function shouldRetry(failureCount, error) {
  const retryable =
    error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT' || error?.status >= 500;
  return retryable && failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: shouldRetry },
      mutations: { retry: false },
    },
  });
}
