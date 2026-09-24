import { z } from 'zod';
import { CATEGORY_TYPES } from '../models/Category.js';
import { hexColor, iconName, nonEmptyPatch, objectId, queryBoolean } from './common.js';

const name = z.string().trim().min(1, 'Name is required').max(40, 'Name is too long');

export const createCategorySchema = z.object({
  name,
  type: z.enum(CATEGORY_TYPES, 'Type must be income or expense'),
  icon: iconName.optional(),
  color: hexColor.optional(),
  parentId: objectId.nullable().optional(),
});

// `type` can't change after creation: past transactions depend on it.
export const updateCategorySchema = nonEmptyPatch(
  z.object({
    name,
    icon: iconName,
    color: hexColor,
    parentId: objectId.nullable(),
    isArchived: z.boolean(),
  }),
);

export const listCategoriesQuery = z.object({
  type: z.enum(CATEGORY_TYPES).optional(),
  includeArchived: queryBoolean,
});
