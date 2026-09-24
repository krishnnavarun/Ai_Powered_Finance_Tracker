import { useMatches } from 'react-router';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';

// Stand-in for pages that are built in later checkpoints. Reads its content from the
// route's `handle` (see router.jsx), so each page shows its own title and icon.
export function PlaceholderPage() {
  const matches = useMatches();
  const page = matches[matches.length - 1]?.handle ?? {};

  return (
    <>
      <PageHeader title={page.title} description={page.description} />
      <EmptyState
        icon={page.icon}
        title="Coming soon"
        description={`We're still building ${page.title}. Check back soon!`}
      />
    </>
  );
}
