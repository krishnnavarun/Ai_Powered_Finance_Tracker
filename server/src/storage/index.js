import { env } from '../config/env.js';
import { createCloudinaryStorage } from './cloudinaryStorage.js';
import { createLocalStorage } from './localStorage.js';

// Every storage driver has the same shape:
//   save({ userId, buffer, extension, contentType }) → { key }
//   read(key) → Buffer
//   remove(key)
let storage = null;

export function getReceiptStorage() {
  storage ??=
    env.RECEIPT_STORAGE === 'cloudinary'
      ? createCloudinaryStorage({
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          apiKey: env.CLOUDINARY_API_KEY,
          apiSecret: env.CLOUDINARY_API_SECRET,
        })
      : createLocalStorage({ rootDir: env.UPLOAD_DIR });
  return storage;
}
