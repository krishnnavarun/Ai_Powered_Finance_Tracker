import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <EmptyState
      className="mt-10"
      icon={Compass}
      titleAs="h1"
      title="Page not found"
      description="We could not find this page."
      action={
        <Button asChild>
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
      }
    />
  );
}
