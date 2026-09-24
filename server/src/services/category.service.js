import { Category } from '../models/Category.js';
import { defaultCategoriesFor } from '../seed/defaultCategories.js';
import { ApiError } from '../utils/ApiError.js';
import { findOwnedOrThrow, withUniqueName } from './ownership.js';

const duplicateName = (name, type) => `You already have an ${type} category named "${name}"`;

// Creates the default categories for a new user (inside the sign-up transaction).
export async function seedDefaultCategories(userId, { session } = {}) {
  await Category.insertMany(defaultCategoriesFor(userId), { session });
}

// Accounts created before categories existed get the defaults on first use.
// Upserts by systemKey, so running it twice never creates duplicates.
async function ensureDefaultCategories(userId) {
  if (await Category.exists({ userId })) return;
  await Category.bulkWrite(
    defaultCategoriesFor(userId).map((category) => ({
      updateOne: {
        filter: { userId, systemKey: category.systemKey },
        update: { $setOnInsert: category },
        upsert: true,
      },
    })),
  );
}

export async function listCategories(userId, { type, includeArchived = false } = {}) {
  await ensureDefaultCategories(userId);
  const filter = { userId };
  if (type) filter.type = type;
  if (!includeArchived) filter.isArchived = false;
  return Category.find(filter).sort({ type: 1, sortOrder: 1, name: 1 });
}

// A parent must belong to the user, have the same type, and be top-level itself
// (only one level of nesting). A category that has children can't become a child.
async function checkParent(userId, { parentId, type, categoryId }) {
  if (!parentId) return;
  if (categoryId && String(parentId) === String(categoryId)) {
    throw ApiError.badRequest('A category cannot be its own parent');
  }
  const parent = await findOwnedOrThrow(Category, userId, parentId, { label: 'Parent category' });
  if (parent.type !== type) {
    throw ApiError.badRequest(`Parent must also be an ${type} category`);
  }
  if (parent.parentId) {
    throw ApiError.badRequest('Categories can only be nested one level deep');
  }
  if (categoryId && (await Category.exists({ userId, parentId: categoryId }))) {
    throw ApiError.badRequest('A category with sub-categories cannot be moved under another');
  }
}

export async function createCategory(userId, data) {
  await checkParent(userId, { parentId: data.parentId, type: data.type });
  return withUniqueName(
    () => Category.create({ ...data, userId }),
    duplicateName(data.name, data.type),
  );
}

export async function updateCategory(userId, categoryId, changes) {
  const category = await findOwnedOrThrow(Category, userId, categoryId, { label: 'Category' });
  if (changes.parentId !== undefined) {
    await checkParent(userId, { parentId: changes.parentId, type: category.type, categoryId });
  }
  category.set(changes);
  return withUniqueName(() => category.save(), duplicateName(changes.name, category.type));
}

export async function deleteCategory(userId, categoryId) {
  const category = await findOwnedOrThrow(Category, userId, categoryId, { label: 'Category' });

  if (category.systemKey) {
    throw new ApiError(
      409,
      'DEFAULT_CATEGORY',
      'Default categories can’t be deleted. Archive it to hide it instead.',
    );
  }
  if (await Category.exists({ userId, parentId: category._id })) {
    throw new ApiError(
      409,
      'CATEGORY_HAS_CHILDREN',
      'Move or delete its sub-categories first, or archive it instead.',
    );
  }
  // CP8: categories used by transactions can only be archived.
  await category.deleteOne();
}
