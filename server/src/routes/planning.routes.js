import { Router } from 'express';
import * as planning from '../controllers/planning.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  contributeSchema,
  createBudgetSchema,
  createGoalSchema,
  createRecurringSchema,
  monthQuery,
  updateBudgetSchema,
  updateGoalSchema,
  updateRecurringSchema,
} from '../validators/planning.schemas.js';

const byId = (body) => validate(body ? { params: idParams, body } : { params: idParams });

export const budgetRoutes = Router()
  .use(requireAuth)
  .get('/', validate({ query: monthQuery }), planning.listBudgets)
  // Before /:id so "status" isn't read as an id.
  .get('/status', validate({ query: monthQuery }), planning.budgetStatus)
  .post('/', validate({ body: createBudgetSchema }), planning.createBudget)
  .patch('/:id', byId(updateBudgetSchema), planning.updateBudget)
  .delete('/:id', byId(), planning.deleteBudget);

export const goalRoutes = Router()
  .use(requireAuth)
  .get('/', planning.listGoals)
  .post('/', validate({ body: createGoalSchema }), planning.createGoal)
  .patch('/:id', byId(updateGoalSchema), planning.updateGoal)
  .delete('/:id', byId(), planning.deleteGoal)
  .post('/:id/contribute', byId(contributeSchema), planning.contribute);

export const recurringRoutes = Router()
  .use(requireAuth)
  .get('/', planning.listRecurring)
  .post('/', validate({ body: createRecurringSchema }), planning.createRecurring)
  .patch('/:id', byId(updateRecurringSchema), planning.updateRecurring)
  .delete('/:id', byId(), planning.deleteRecurring);
