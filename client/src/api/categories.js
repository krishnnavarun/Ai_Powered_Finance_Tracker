import { api } from './client';

export async function listCategories({ includeArchived = false } = {}) {
  const res = await api.get('/categories', {
    params: includeArchived ? { includeArchived } : {},
  });
  return res.data.data.categories;
}
