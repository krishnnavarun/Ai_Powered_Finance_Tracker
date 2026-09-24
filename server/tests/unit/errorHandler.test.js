import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { ApiError } from '../../src/utils/ApiError.js';

// A tiny app whose routes throw each kind of error the handler knows about.
function appThatThrows(makeError) {
  const app = express();
  app.use(express.json());
  app.post('/boom', () => {
    throw makeError();
  });
  app.use(errorHandler);
  return app;
}

async function errorFor(makeError) {
  const res = await request(appThatThrows(makeError)).post('/boom').send({});
  return { status: res.status, body: res.body };
}

describe('errorHandler', () => {
  it('uses the status and code of an ApiError', async () => {
    const { status, body } = await errorFor(() => ApiError.conflict('Email already registered'));
    expect(status).toBe(409);
    expect(body).toEqual({
      success: false,
      error: { code: 'CONFLICT', message: 'Email already registered' },
    });
  });

  it('includes details when present', async () => {
    const { body } = await errorFor(() => ApiError.badRequest('Bad', { field: 'amount' }));
    expect(body.error.details).toEqual({ field: 'amount' });
  });

  it('turns Zod errors into 400 VALIDATION_ERROR with field paths', async () => {
    const schema = z.object({ amount: z.number().int().positive() });
    const { status, body } = await errorFor(() => {
      const result = schema.safeParse({ amount: -5 });
      return result.error;
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details[0].path).toBe('amount');
  });

  it('turns an invalid ObjectId into 400 INVALID_ID', async () => {
    const { status, body } = await errorFor(
      () => new mongoose.Error.CastError('ObjectId', 'abc', 'walletId'),
    );
    expect(status).toBe(400);
    expect(body.error).toEqual({ code: 'INVALID_ID', message: 'Invalid value for walletId' });
  });

  it('turns duplicate-key errors into 409 CONFLICT', async () => {
    const { status, body } = await errorFor(() =>
      Object.assign(new Error('E11000'), { code: 11000, keyValue: { email: 'a@b.com' } }),
    );
    expect(status).toBe(409);
    expect(body.error.details).toEqual({ fields: ['email'] });
  });

  it('turns unknown errors into 500 INTERNAL_ERROR', async () => {
    const { status, body } = await errorFor(() => new Error('db exploded'));
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });

  it('catches errors thrown in async handlers (Express 5)', async () => {
    const app = express();
    app.get('/async', async () => {
      throw ApiError.notFound('Wallet not found');
    });
    app.use(errorHandler);
    const res = await request(app).get('/async');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Wallet not found');
  });
});
