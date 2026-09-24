import { Router } from 'express';
import * as transactions from '../controllers/transaction.controller.js';
import * as wallets from '../controllers/wallet.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import { transferSchema } from '../validators/transaction.schemas.js';
import {
  createWalletSchema,
  listWalletsQuery,
  updateWalletSchema,
} from '../validators/wallet.schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listWalletsQuery }), wallets.list);
router.post('/', validate({ body: createWalletSchema }), wallets.create);
// Moving money between two of your wallets (creates a "transfer" transaction).
// Before /:id so "transfer" isn't read as an id.
router.post('/transfer', validate({ body: transferSchema }), transactions.transfer);
router.get('/:id', validate({ params: idParams }), wallets.get);
router.patch('/:id', validate({ params: idParams, body: updateWalletSchema }), wallets.update);
router.delete('/:id', validate({ params: idParams }), wallets.remove);

export default router;
