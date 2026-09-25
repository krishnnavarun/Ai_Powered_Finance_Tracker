import { api } from './client';

export async function listCategories({ includeArchived = false } = {}) {
  const res = await api.get('/categories', {
    params: includeArchived ? { includeArchived } : {},
  });
  return res.data.data.categories;
}

// { name, type, icon?, color?, parentId? }
export async function createCategory(category) {
  const res = await api.post('/categories', category);
  return res.data.data.category;
}

export async function updateCategory(id, changes) {
  const res = await api.patch(`/categories/${id}`, changes);
  return res.data.data.category;
}

export async function deleteCategory(id) {
  await api.delete(`/categories/${id}`);
}
