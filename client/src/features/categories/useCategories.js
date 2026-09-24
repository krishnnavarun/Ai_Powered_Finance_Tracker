import { useQuery } from '@tanstack/react-query';
import * as categoriesApi from '@/api/categories';

// All categories, archived included (old transactions may still use archived ones).
// Categories rarely change, so they stay fresh for 5 minutes.
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.listCategories({ includeArchived: true }),
    staleTime: 5 * 60_000,
  });
}

export function useCategoryLookup() {
  const { data = [] } = useCategories();
  return new Map(data.map((category) => [category.id, category]));
}

// Options for a category picker: active categories of one type, each sub-category
// listed right after its parent and marked with `depth: 1`.
export function categoryOptions(categories, type) {
  const active = categories.filter((c) => c.type === type && !c.isArchived);
  const parents = active.filter((c) => !c.parentId);
  return parents.flatMap((parent) => [
    { ...parent, depth: 0 },
    ...active.filter((c) => c.parentId === parent.id).map((child) => ({ ...child, depth: 1 })),
  ]);
}
