import { z } from 'zod';
import * as ai from '../validators/ai.schemas.js';
import * as auth from '../validators/auth.schemas.js';
import * as category from '../validators/category.schemas.js';
import * as chat from '../validators/chat.schemas.js';
import * as imports from '../validators/import.schemas.js';
import * as insight from '../validators/insight.schemas.js';
import * as planning from '../validators/planning.schemas.js';
import * as txn from '../validators/transaction.schemas.js';
import * as user from '../validators/user.schemas.js';
import * as wallet from '../validators/wallet.schemas.js';

// The API reference (served at /api/docs). Request shapes come straight from the Zod
// schemas the API validates with, so the docs can't drift from the code.

// [method, path, tag, summary, { body?, query?, public?, multipart?, stream?, file? }]
const ROUTES = [
  ['get', '/health', 'Health', 'Is the API up (and the database reachable)?', { public: true }],

  [
    'post',
    '/auth/register',
    'Auth',
    'Create an account (sets the refresh cookie)',
    { body: auth.registerSchema, public: true },
  ],
  [
    'post',
    '/auth/login',
    'Auth',
    'Log in (5 tries a minute per IP)',
    { body: auth.loginSchema, public: true },
  ],
  ['post', '/auth/demo', 'Auth', 'Start a fresh demo account with sample data', { public: true }],
  [
    'post',
    '/auth/refresh',
    'Auth',
    'New access token from the refresh cookie (rotated)',
    { public: true },
  ],
  ['post', '/auth/logout', 'Auth', 'Log out and clear the refresh cookie', { public: true }],
  ['get', '/auth/me', 'Auth', 'The logged-in user'],

  [
    'patch',
    '/users/me',
    'Account',
    'Update name, month start day, time zone',
    { body: user.updateProfileSchema },
  ],
  [
    'patch',
    '/users/me/settings',
    'Account',
    'Change AI, email, alerts or theme settings',
    { body: user.updateSettingsSchema },
  ],
  ['get', '/users/me/export', 'Account', 'Download all data as JSON', { file: 'application/json' }],
  [
    'delete',
    '/users/me',
    'Account',
    'Delete the account and everything in it',
    { body: user.deleteAccountSchema },
  ],

  ['get', '/wallets', 'Wallets', 'List wallets', { query: wallet.listWalletsQuery }],
  ['post', '/wallets', 'Wallets', 'Add a wallet', { body: wallet.createWalletSchema }],
  ['get', '/wallets/{id}', 'Wallets', 'One wallet'],
  [
    'patch',
    '/wallets/{id}',
    'Wallets',
    'Edit or archive a wallet',
    { body: wallet.updateWalletSchema },
  ],
  ['delete', '/wallets/{id}', 'Wallets', 'Delete a wallet with no transactions'],
  [
    'post',
    '/wallets/transfer',
    'Wallets',
    'Move money between two wallets',
    { body: txn.transferSchema },
  ],

  ['get', '/categories', 'Categories', 'List categories', { query: category.listCategoriesQuery }],
  ['post', '/categories', 'Categories', 'Add a category', { body: category.createCategorySchema }],
  [
    'patch',
    '/categories/{id}',
    'Categories',
    'Rename, recolour or hide a category',
    { body: category.updateCategorySchema },
  ],
  ['delete', '/categories/{id}', 'Categories', 'Delete an unused custom category'],

  [
    'get',
    '/transactions',
    'Transactions',
    'Search, filter and page transactions (with totals)',
    { query: txn.listTransactionsQuery },
  ],
  [
    'post',
    '/transactions',
    'Transactions',
    'Add a transaction (updates wallet balances atomically)',
    { body: txn.createTransactionSchema },
  ],
  ['get', '/transactions/{id}', 'Transactions', 'One transaction'],
  [
    'patch',
    '/transactions/{id}',
    'Transactions',
    'Edit a transaction',
    { body: txn.updateTransactionSchema },
  ],
  ['delete', '/transactions/{id}', 'Transactions', 'Delete a transaction'],
  [
    'post',
    '/transactions/bulk',
    'Transactions',
    'Delete or re-categorise up to 200 at once',
    { body: txn.bulkSchema },
  ],
  [
    'post',
    '/transactions/{id}/receipt',
    'Transactions',
    'Attach a receipt photo (field "receipt", ≤5 MB)',
    { multipart: 'receipt' },
  ],
  [
    'get',
    '/transactions/{id}/receipt',
    'Transactions',
    'The receipt photo (owner only)',
    { file: 'image/*' },
  ],
  ['delete', '/transactions/{id}/receipt', 'Transactions', 'Remove the receipt photo'],

  ['get', '/budgets', 'Budgets', 'Budgets of a month', { query: planning.monthQuery }],
  [
    'get',
    '/budgets/status',
    'Budgets',
    'Spent, left and status of every budget',
    { query: planning.monthQuery },
  ],
  ['post', '/budgets', 'Budgets', 'Add a budget', { body: planning.createBudgetSchema }],
  ['patch', '/budgets/{id}', 'Budgets', 'Edit a budget', { body: planning.updateBudgetSchema }],
  ['delete', '/budgets/{id}', 'Budgets', 'Delete a budget'],

  ['get', '/goals', 'Goals', 'Goals with progress'],
  ['post', '/goals', 'Goals', 'Add a goal', { body: planning.createGoalSchema }],
  ['patch', '/goals/{id}', 'Goals', 'Edit a goal', { body: planning.updateGoalSchema }],
  ['delete', '/goals/{id}', 'Goals', 'Delete a goal'],
  [
    'post',
    '/goals/{id}/contribute',
    'Goals',
    'Add (or take out) money',
    { body: planning.contributeSchema },
  ],

  ['get', '/recurring', 'Recurring', 'Recurring payments with their next dates'],
  [
    'post',
    '/recurring',
    'Recurring',
    'Add a recurring payment',
    { body: planning.createRecurringSchema },
  ],
  [
    'patch',
    '/recurring/{id}',
    'Recurring',
    'Edit, pause or resume',
    { body: planning.updateRecurringSchema },
  ],
  ['delete', '/recurring/{id}', 'Recurring', 'Delete a recurring payment'],

  [
    'get',
    '/reports/summary',
    'Reports',
    'Money in, out, saved and the biggest payment for a period',
  ],
  ['get', '/reports/by-category', 'Reports', 'Spending by category'],
  ['get', '/reports/trend', 'Reports', 'Money in and out per month'],
  ['get', '/reports/merchants', 'Reports', 'Top places'],
  ['get', '/reports/by-wallet', 'Reports', 'Money in and out per wallet'],
  [
    'get',
    '/reports/export',
    'Reports',
    'Download a CSV or PDF report (?format=csv|pdf&from&to)',
    { file: 'text/csv' },
  ],

  [
    'post',
    '/import/csv/preview',
    'Import',
    'Read a bank statement CSV (nothing is saved)',
    { multipart: 'statement' },
  ],
  [
    'post',
    '/import/csv/commit',
    'Import',
    'Save chosen statement rows',
    { body: imports.commitCsvSchema },
  ],

  ['get', '/ai/status', 'AI', 'Is AI set up and switched on?'],
  [
    'post',
    '/ai/parse/text',
    'AI',
    'Typed note → draft transaction (works without AI too)',
    { body: ai.parseTextSchema },
  ],
  [
    'post',
    '/ai/parse/sms',
    'AI',
    'Bank SMS → draft transactions (patterns first, AI for the rest)',
    { body: ai.parseSmsSchema },
  ],
  [
    'post',
    '/ai/parse/receipt',
    'AI',
    'Receipt photo → draft (AI vision)',
    { multipart: 'receipt' },
  ],
  [
    'post',
    '/ai/parse/receipt-text',
    'AI',
    'Text read from a receipt on the device → draft',
    { body: ai.receiptTextSchema },
  ],
  [
    'post',
    '/ai/categorize',
    'AI',
    'Suggest categories (memory → rules → AI)',
    { body: ai.categorizeSchema },
  ],
  ['get', '/ai/forecast', 'Analytics', 'Predicted month-end balance'],
  ['get', '/ai/health-score', 'Analytics', 'Money health 0–100 with parts and tips'],
  ['get', '/ai/anomalies', 'Analytics', 'Unusual weeks and double charges'],
  ['get', '/ai/subscriptions', 'Analytics', 'Repeating charges found in payments'],
  [
    'patch',
    '/ai/subscriptions/{id}',
    'Analytics',
    'Mark a subscription cancelled or not one',
    { body: ai.subscriptionStatusSchema },
  ],
  [
    'get',
    '/ai/budget-suggestions',
    'Analytics',
    'Budgets from the last 3 months',
    { query: ai.budgetSuggestionsQuery },
  ],
  [
    'post',
    '/ai/what-if',
    'Analytics',
    'Effect of spending changes on savings and goals',
    { body: ai.whatIfSchema },
  ],

  [
    'get',
    '/insights',
    'Insights',
    'Tips and warnings, newest first',
    { query: insight.listInsightsQuery },
  ],
  ['post', '/insights/refresh', 'Insights', 'Look for new insights now'],
  ['post', '/insights/seen', 'Insights', 'Mark insights as seen', { body: insight.markSeenSchema }],
  [
    'patch',
    '/insights/{id}',
    'Insights',
    'Mark seen or dismissed',
    { body: insight.updateInsightSchema },
  ],

  ['get', '/notifications', 'Notifications', 'Bell notifications and unread count'],
  ['patch', '/notifications/{id}/read', 'Notifications', 'Mark one read'],
  ['post', '/notifications/read-all', 'Notifications', 'Mark all read'],

  ['get', '/chat/sessions', 'Assistant', 'List chats'],
  ['post', '/chat/sessions', 'Assistant', 'Start a chat', { body: chat.createSessionSchema }],
  ['get', '/chat/sessions/{id}', 'Assistant', 'A chat with its messages'],
  ['delete', '/chat/sessions/{id}', 'Assistant', 'Delete a chat'],
  [
    'post',
    '/chat/sessions/{id}/messages',
    'Assistant',
    'Ask a question; the answer streams as server-sent events (tool, chart, text, done | error)',
    { body: chat.sendMessageSchema, stream: true },
  ],
];

function jsonSchema(schema, io = 'input') {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io, unrepresentable: 'any' });
  return rest;
}

function queryParameters(schema) {
  const { properties = {}, required = [] } = jsonSchema(schema);
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: 'query',
    required: required.includes(name),
    schema: property,
  }));
}

const errorResponse = {
  description: 'Error',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
};

function operation([, path, tag, summary, options = {}]) {
  const parameters = [];
  if (path.includes('{id}')) {
    parameters.push({
      name: 'id',
      in: 'path',
      required: true,
      schema: { type: 'string', pattern: '^[a-f0-9]{24}$' },
    });
  }
  if (options.query) parameters.push(...queryParameters(options.query));

  const op = {
    tags: [tag],
    summary,
    ...(options.public ? { security: [] } : {}),
    ...(parameters.length ? { parameters } : {}),
    responses: {
      200: options.stream
        ? {
            description: 'Server-sent events',
            content: { 'text/event-stream': { schema: { type: 'string' } } },
          }
        : options.file
          ? {
              description: 'A file',
              content: { [options.file]: { schema: { type: 'string', format: 'binary' } } },
            }
          : {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
            },
      '4XX': errorResponse,
    },
  };
  if (options.body) {
    op.requestBody = {
      required: true,
      content: { 'application/json': { schema: jsonSchema(options.body) } },
    };
  }
  if (options.multipart) {
    op.requestBody = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: { [options.multipart]: { type: 'string', format: 'binary' } },
            required: [options.multipart],
          },
        },
      },
    };
  }
  return op;
}

export function buildOpenApi() {
  const paths = {};
  for (const route of ROUTES) {
    const [method, path] = route;
    paths[path] ??= {};
    paths[path][method] = operation(route);
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'Paisa Pal API',
      version: '1.0.0',
      description:
        'Personal finance tracker for India. Money is always in integer paise (₹250.50 = 25050). Dates are local days ("2026-09-24") in the user\'s time zone, or ISO timestamps with an offset. Log in to get an access token, then use it as a Bearer token; it lasts 15 minutes and is renewed with POST /auth/refresh (httpOnly cookie).',
    },
    servers: [{ url: '/api' }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Success: {
          type: 'object',
          properties: { success: { const: true }, data: { type: 'object' } },
        },
        Error: {
          type: 'object',
          properties: {
            success: { const: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', examples: ['VALIDATION_ERROR', 'NOT_FOUND'] },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
              },
              required: ['code', 'message'],
            },
          },
        },
      },
    },
    paths,
  };
}
