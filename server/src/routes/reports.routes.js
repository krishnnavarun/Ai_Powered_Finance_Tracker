import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { exportCsv, exportPdf } from '../services/export.service.js';
import {
  byWallet,
  monthlyTrend,
  reportSummary,
  spendingByCategory,
  topMerchants,
} from '../services/reports.service.js';

const localDate = z.iso.date('Use a date like 2026-09-24');

const byCategoryQuery = z
  .object({
    from: localDate.optional(),
    to: localDate.optional(),
    type: z.enum(['expense', 'income']).default('expense'),
  })
  .refine((q) => Boolean(q.from) === Boolean(q.to), {
    path: ['to'],
    message: 'Give both "from" and "to", or neither',
  })
  .refine((q) => !q.from || q.from <= q.to, {
    path: ['to'],
    message: '"to" must be on or after "from"',
  });

const rangeQuery = z
  .object({ from: localDate.optional(), to: localDate.optional() })
  .refine((q) => Boolean(q.from) === Boolean(q.to), {
    path: ['to'],
    message: 'Give both "from" and "to", or neither',
  })
  .refine((q) => !q.from || q.from <= q.to, {
    path: ['to'],
    message: '"to" must be on or after "from"',
  });

const merchantsQuery = rangeQuery.and(
  z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }),
);

const exportQuery = rangeQuery.and(z.object({ format: z.enum(['csv', 'pdf']).default('csv') }));

const trendQuery = z.object({ months: z.coerce.number().int().min(1).max(24).default(6) });

// Summaries used by the dashboard now and the Reports page (CP12).
export const reportRoutes = Router()
  .use(requireAuth)
  .get('/by-category', validate({ query: byCategoryQuery }), async (req, res) => {
    res.json({ success: true, data: await spendingByCategory(req.user.id, req.query) });
  })
  .get('/trend', validate({ query: trendQuery }), async (req, res) => {
    res.json({ success: true, data: { months: await monthlyTrend(req.user.id, req.query) } });
  })
  .get('/summary', validate({ query: rangeQuery }), async (req, res) => {
    res.json({ success: true, data: await reportSummary(req.user.id, req.query) });
  })
  .get('/merchants', validate({ query: merchantsQuery }), async (req, res) => {
    res.json({ success: true, data: await topMerchants(req.user.id, req.query) });
  })
  .get('/by-wallet', validate({ query: rangeQuery }), async (req, res) => {
    res.json({ success: true, data: await byWallet(req.user.id, req.query) });
  })
  // Downloads a CSV or PDF of the period. private/no-store: a finance export must not
  // sit in shared caches.
  .get('/export', validate({ query: exportQuery }), async (req, res) => {
    const { format, ...range } = req.query;
    const file =
      format === 'pdf' ? await exportPdf(req.user.id, range) : await exportCsv(req.user.id, range);
    res.set({
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(file.body);
  });
