import mongoose from 'mongoose';
import { CASE_INSENSITIVE } from './fields.js';
import { toJSONPlugin } from './plugins/toJSON.js';

export const CATEGORY_TYPES = ['income', 'expense'];

// Every user gets their own copy of the default categories on sign-up (see
// seed/defaultCategories.js), so they can rename or archive them freely.
const categorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: CATEGORY_TYPES, required: true },
    icon: { type: String, default: 'tag' },
    color: { type: String, default: '#94a3b8' },
    // Optional one level of nesting, e.g. Food & Dining → Coffee.
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    // Stable id of a default category (e.g. "food_dining"), kept even if the user
    // renames it. Rules like "swiggy → Food" (CP16) look categories up by this key.
    systemKey: { type: String, default: null },
    sortOrder: { type: Number, default: 1000 },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// No two "Groceries" of the same type for one user, ignoring case.
categorySchema.index(
  { userId: 1, type: 1, name: 1 },
  { unique: true, collation: CASE_INSENSITIVE },
);
// Each default exists at most once per user.
categorySchema.index(
  { userId: 1, systemKey: 1 },
  { unique: true, partialFilterExpression: { systemKey: { $type: 'string' } } },
);

categorySchema.plugin(toJSONPlugin);

export const Category = mongoose.model('Category', categorySchema);
