import { useSearchParams } from 'react-router';

export const PAGE_SIZE = 25;
const FILTER_KEYS = ['q', 'type', 'walletId', 'categoryId', 'from', 'to'];

// Transaction filters live in the URL (?type=expense&q=swiggy&page=2), so a filtered
// view can be bookmarked or shared and the Back button undoes a filter change.
export function useTransactionFilters() {
  const [params, setParams] = useSearchParams();

  const values = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? '']));
  const page = Math.max(1, Number(params.get('page')) || 1);

  // Changing any filter goes back to page 1.
  const setFilter = (key, value) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete('page');
        return next;
      },
      { replace: key === 'q' }, // don't add a history entry per typed letter
    );

  const setPage = (nextPage) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (nextPage > 1) next.set('page', String(nextPage));
      else next.delete('page');
      return next;
    });

  const clearFilters = () => setParams(new URLSearchParams());
  const hasFilters = FILTER_KEYS.some((key) => values[key]);

  return {
    values,
    // What the API receives (empty values are dropped by the API helper).
    query: { ...values, page, limit: PAGE_SIZE },
    page,
    setFilter,
    setPage,
    clearFilters,
    hasFilters,
  };
}
