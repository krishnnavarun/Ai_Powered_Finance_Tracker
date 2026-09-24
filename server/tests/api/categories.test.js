import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { Category } from '../../src/models/Category.js';
import { User } from '../../src/models/User.js';
import { DEFAULT_CATEGORIES } from '../../src/seed/defaultCategories.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';

let app;
let asha;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  // Fresh app per test = fresh sign-up rate-limit counters.
  app = createApp();
  asha = await signUp(app, { name: 'Asha Rao' });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await clearTestDB();
});

const list = (query = '') => asha.get(`/api/categories${query}`);
const create = (body) => asha.post('/api/categories').send(body);
const byName = (categories, name) => categories.find((c) => c.name === name);

describe('default categories', () => {
  it('gives every new user the 24 defaults, in order', async () => {
    const { categories } = (await list()).body.data;

    expect(categories).toHaveLength(24);
    const expense = categories.filter((c) => c.type === 'expense').map((c) => c.name);
    const income = categories.filter((c) => c.type === 'income').map((c) => c.name);
    expect(expense).toHaveLength(18);
    expect(expense[0]).toBe('Food & Dining');
    expect(expense.at(-1)).toBe('Other');
    expect(income).toEqual([
      'Salary',
      'Freelance',
      'Pocket Money',
      'Refund',
      'Interest',
      'Other Income',
    ]);
    expect(byName(categories, 'Groceries')).toMatchObject({
      systemKey: 'groceries',
      icon: 'shopping-basket',
      color: '#84cc16',
      parentId: null,
      isArchived: false,
    });
  });

  it('seeds the user and categories together — a failure leaves no half-created account', async () => {
    vi.spyOn(Category, 'insertMany').mockRejectedValueOnce(new Error('disk full'));

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ravi', email: 'ravi@example.com', password: 'password123' });

    expect(res.status).toBe(500);
    expect(await User.exists({ email: 'ravi@example.com' })).toBeNull();
  });

  it('adds the defaults for an older account that has none, only once', async () => {
    await Category.deleteMany({ userId: asha.user.id });

    const [first, second] = await Promise.all([list(), list()]);
    expect(first.body.data.categories).toHaveLength(24);
    expect(second.body.data.categories).toHaveLength(24);
    expect(await Category.countDocuments({ userId: asha.user.id })).toBe(24);
  });

  it('filters by type', async () => {
    const { categories } = (await list('?type=income')).body.data;
    expect(categories).toHaveLength(6);
    expect(categories.every((c) => c.type === 'income')).toBe(true);
  });

  it('can be renamed but keeps its system key', async () => {
    const food = byName((await list()).body.data.categories, 'Food & Dining');
    const res = await asha.patch(`/api/categories/${food.id}`).send({ name: 'Eating Out' });
    expect(res.body.data.category).toMatchObject({ name: 'Eating Out', systemKey: 'food_dining' });
  });

  it('cannot be deleted, only archived', async () => {
    const rent = byName((await list()).body.data.categories, 'Rent');

    const del = await asha.delete(`/api/categories/${rent.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('DEFAULT_CATEGORY');

    await asha.patch(`/api/categories/${rent.id}`).send({ isArchived: true });
    expect(byName((await list()).body.data.categories, 'Rent')).toBeUndefined();
    expect(byName((await list('?includeArchived=true')).body.data.categories, 'Rent')).toBeTruthy();
  });

  it('matches the documented default list', () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.name)).toContain('EMI/Loans');
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.key)).size).toBe(DEFAULT_CATEGORIES.length);
  });
});

describe('custom categories', () => {
  it('creates a custom category', async () => {
    const res = await create({
      name: 'Pets',
      type: 'expense',
      icon: 'paw-print',
      color: '#a16207',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.category).toMatchObject({
      name: 'Pets',
      type: 'expense',
      icon: 'paw-print',
      systemKey: null,
    });
  });

  it('rejects a duplicate name of the same type, ignoring case', async () => {
    const res = await create({ name: 'groceries', type: 'expense' });
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'DUPLICATE_NAME',
      message: 'You already have an expense category named "groceries"',
    });
  });

  it('allows the same name for a different type', async () => {
    expect((await create({ name: 'Rent', type: 'income' })).status).toBe(201);
  });

  it('deletes an unused custom category', async () => {
    const { category } = (await create({ name: 'Pets', type: 'expense' })).body.data;
    expect((await asha.delete(`/api/categories/${category.id}`)).status).toBe(204);
  });

  it('does not allow changing the type', async () => {
    const { category } = (await create({ name: 'Pets', type: 'expense' })).body.data;
    const res = await asha.patch(`/api/categories/${category.id}`).send({ type: 'income' });
    expect(res.status).toBe(400);
  });
});

describe('sub-categories', () => {
  let food;
  beforeEach(async () => {
    food = byName((await list()).body.data.categories, 'Food & Dining');
  });

  it('can be nested one level under a category of the same type', async () => {
    const res = await create({ name: 'Coffee', type: 'expense', parentId: food.id });
    expect(res.status).toBe(201);
    expect(res.body.data.category.parentId).toBe(food.id);
  });

  it('rejects a parent of the other type', async () => {
    const salary = byName((await list()).body.data.categories, 'Salary');
    const res = await create({ name: 'Coffee', type: 'expense', parentId: salary.id });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Parent must also be an expense category');
  });

  it('rejects a second level of nesting', async () => {
    const coffee = (await create({ name: 'Coffee', type: 'expense', parentId: food.id })).body.data
      .category;
    const res = await create({ name: 'Espresso', type: 'expense', parentId: coffee.id });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Categories can only be nested one level deep');
  });

  it('rejects making a category its own parent', async () => {
    const res = await asha.patch(`/api/categories/${food.id}`).send({ parentId: food.id });
    expect(res.status).toBe(400);
  });

  it('does not move a category that has children under another', async () => {
    await create({ name: 'Coffee', type: 'expense', parentId: food.id });
    const groceries = byName((await list()).body.data.categories, 'Groceries');
    const res = await asha.patch(`/api/categories/${food.id}`).send({ parentId: groceries.id });
    expect(res.status).toBe(400);
  });

  it('blocks deleting a category that still has sub-categories', async () => {
    const pets = (await create({ name: 'Pets', type: 'expense' })).body.data.category;
    await create({ name: 'Vet', type: 'expense', parentId: pets.id });

    const res = await asha.delete(`/api/categories/${pets.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_HAS_CHILDREN');
  });

  it('can be moved back to the top level', async () => {
    const coffee = (await create({ name: 'Coffee', type: 'expense', parentId: food.id })).body.data
      .category;
    const res = await asha.patch(`/api/categories/${coffee.id}`).send({ parentId: null });
    expect(res.body.data.category.parentId).toBeNull();
  });
});
