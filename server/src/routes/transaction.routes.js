import { Router } from 'express';
import * as transactions from '../controllers/transaction.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { receiptUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import {
  bulkSchema,
  createTransactionSchema,
  listTransactionsQuery,
  updateTransactionSchema,
} from '../validators/transaction.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listTransactionsQuery }), transactions.list);
router.post('/', validate({ body: createTransactionSchema }), transactions.create);
// Before /:id so "bulk" isn't read as an id.
router.post('/bulk', validate({ body: bulkSchema }), transactions.bulk);
router.get('/:id', validate({ params: idParams }), transactions.get);
router.patch(
  '/:id',
  validate({ params: idParams, body: updateTransactionSchema }),
  transactions.update,
);
router.delete('/:id', validate({ params: idParams }), transactions.remove);

// Receipt photo (multipart/form-data, field "receipt", JPG/PNG/WebP up to 5 MB).
router.post(
  '/:id/receipt',
  validate({ params: idParams }),
  receiptUpload,
  transactions.uploadReceipt,
);
router.get('/:id/receipt', validate({ params: idParams }), transactions.getReceipt);
router.delete('/:id/receipt', validate({ params: idParams }), transactions.removeReceipt);

export default router;
