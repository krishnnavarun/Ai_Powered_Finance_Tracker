import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Accepts one image in the "receipt" form field, kept in memory (never written to disk
// until it has been checked). The real file type is checked again from its bytes later.
export const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 0 },
  fileFilter: (_req, file, done) => {
    if (IMAGE_TYPES.includes(file.mimetype)) return done(null, true);
    done(new ApiError(400, 'UNSUPPORTED_FILE', 'Please upload a JPG, PNG or WebP photo'));
  },
}).single('receipt');

export const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB

// One bank statement in the "statement" field (+ an optional "mapping" text field).
// Browsers label .csv files differently (Windows often says "application/vnd.ms-excel"),
// so the name is checked too; the content itself is checked when reading.
export const statementUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_BYTES, files: 1, fields: 1, fieldSize: 10_000 },
  fileFilter: (_req, file, done) => {
    if (/\.(csv|txt)$/i.test(file.originalname)) return done(null, true);
    done(new ApiError(400, 'UNSUPPORTED_FILE', 'Please upload a CSV file'));
  },
}).single('statement');
