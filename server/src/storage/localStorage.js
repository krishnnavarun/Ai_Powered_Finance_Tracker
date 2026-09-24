import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Saves receipts as files on this machine, one folder per user.
// Keys look like "665f…/2f1c…c3.jpg"; they never contain user input, so they can't
// point outside the upload folder.
export function createLocalStorage({ rootDir }) {
  const root = path.resolve(rootDir);
  const fullPath = (key) => {
    const resolved = path.resolve(root, key);
    if (!resolved.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return resolved;
  };

  return {
    driver: 'local',

    async save({ userId, buffer, extension }) {
      const key = `${userId}/${randomUUID()}.${extension}`;
      await mkdir(path.dirname(fullPath(key)), { recursive: true });
      await writeFile(fullPath(key), buffer);
      return { key, url: null }; // served through the API, see transaction.controller.js
    },

    async read(key) {
      return readFile(fullPath(key));
    },

    async remove(key) {
      await rm(fullPath(key), { force: true });
    },
  };
}
