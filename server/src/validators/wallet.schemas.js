import { z } from 'zod';
import { WALLET_TYPES } from '../models/Wallet.js';
import { hexColor, iconName, nonEmptyPatch, paise, queryBoolean } from './common.js';

const walletFields = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name is too long'),
  type: z.enum(WALLET_TYPES, 'Choose a wallet type'),
  openingBalance: paise,
  creditLimit: paise.min(0, 'Credit limit cannot be negative').nullable(),
  color: hexColor,
  icon: iconName,
  isArchived: z.boolean(),
});

const onlyCardsHaveCreditLimit = (wallet) =>
  wallet.creditLimit === undefined || wallet.creditLimit === null || wallet.type === 'card';

export const createWalletSchema = walletFields
  .omit({ isArchived: true })
  .extend({
    openingBalance: paise.default(0),
    creditLimit: walletFields.shape.creditLimit.optional(),
    color: hexColor.optional(),
    icon: iconName.optional(),
  })
  .refine(onlyCardsHaveCreditLimit, {
    path: ['creditLimit'],
    message: 'Only card wallets can have a credit limit',
  });

// Balance can't be edited directly — it moves with transactions. Changing the
// opening balance shifts the current balance by the same amount.
export const updateWalletSchema = nonEmptyPatch(walletFields);

export const listWalletsQuery = z.object({
  includeArchived: queryBoolean,
});
