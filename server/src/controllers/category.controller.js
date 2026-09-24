import * as categoryService from '../services/category.service.js';

export async function list(req, res) {
  const categories = await categoryService.listCategories(req.user.id, req.query);
  res.json({ success: true, data: { categories } });
}

export async function create(req, res) {
  const category = await categoryService.createCategory(req.user.id, req.body);
  res.status(201).json({ success: true, data: { category } });
}

export async function update(req, res) {
  const category = await categoryService.updateCategory(req.user.id, req.params.id, req.body);
  res.json({ success: true, data: { category } });
}

export async function remove(req, res) {
  await categoryService.deleteCategory(req.user.id, req.params.id);
  res.status(204).end();
}
