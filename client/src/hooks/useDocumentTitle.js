import { useEffect } from 'react';
import { useMatches } from 'react-router';

// Sets the browser tab title from the deepest route that has `handle.title`.
export function useDocumentTitle() {
  const matches = useMatches();
  const title = [...matches].reverse().find((match) => match.handle?.title)?.handle.title;

  useEffect(() => {
    document.title = title ? `${title} · Paisa Pal` : 'Paisa Pal';
  }, [title]);
}
