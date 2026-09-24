import { Router } from 'express';
import * as categories from '../controllers/category.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createCategorySchema,
  listCategoriesQuery,
  updateCategorySchema,
} from '../validators/category.schemas.js';
import { idParams } from '../validators/common.js';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listCategoriesQuery }), categories.list);
router.post('/', validate({ body: createCategorySchema }), categories.create);
router.patch('/:id', validate({ params: idParams, body: updateCategorySchema }), categories.update);
router.delete('/:id', validate({ params: idParams }), categories.remove);

export default router;
