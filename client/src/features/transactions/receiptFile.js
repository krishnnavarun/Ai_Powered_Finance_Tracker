export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // same limit as the server
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Checks a chosen photo before upload. Returns an error message, or null if it's fine.
export function receiptFileError(file) {
  if (!TYPES.includes(file.type)) return 'Please choose a JPG, PNG or WebP photo';
  if (file.size > MAX_RECEIPT_BYTES) return 'The photo must be 5 MB or smaller';
  return null;
}
