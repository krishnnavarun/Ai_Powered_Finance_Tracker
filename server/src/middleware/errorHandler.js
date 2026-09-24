import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';

// Converts any thrown error into an ApiError so every response has the same shape.
export function toApiError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    return new ApiError(400, 'VALIDATION_ERROR', 'Invalid request data', details);
  }

  // Errors raised by express.json() while reading the body.
  if (err?.type === 'entity.parse.failed') {
    return new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  if (err instanceof mongoose.Error.CastError) {
    return new ApiError(400, 'INVALID_ID', `Invalid value for ${err.path}`);
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return new ApiError(400, 'VALIDATION_ERROR', 'Invalid data', details);
  }
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyValue ?? {});
    return new ApiError(409, 'CONFLICT', 'Already exists', fields.length ? { fields } : undefined);
  }

  // Unknown error: hide internals from clients in production.
  const message =
    env.NODE_ENV === 'production' ? 'Something went wrong' : err?.message || 'Something went wrong';
  return new ApiError(500, 'INTERNAL_ERROR', message);
}

// Express recognises error handlers by their 4 arguments, so `next` must stay in the signature.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const apiError = toApiError(err);
  if (apiError.statusCode >= 500) {
    (req.log ?? logger).error({ err }, 'Unhandled error');
  }

  const error = { code: apiError.code, message: apiError.message };
  if (apiError.details !== undefined) error.details = apiError.details;
  res.status(apiError.statusCode).json({ success: false, error });
}
