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
