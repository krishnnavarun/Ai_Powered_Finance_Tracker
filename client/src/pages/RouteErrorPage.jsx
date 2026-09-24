import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useRouteError } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

// Shown when a page crashes while rendering, instead of a blank screen.
export function RouteErrorPage() {
  const error = useRouteError();
  const message = import.meta.env.DEV && error instanceof Error ? error.message : undefined;

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <EmptyState
        icon={TriangleAlert}
        titleAs="h1"
        title="Something went wrong"
        description={message ?? 'An unexpected error happened. Reloading usually fixes it.'}
        action={
          <Button onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" />
            Reload
          </Button>
        }
      />
    </div>
  );
}
