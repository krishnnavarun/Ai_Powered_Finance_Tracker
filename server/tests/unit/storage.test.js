import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCloudinaryStorage, signParams } from '../../src/storage/cloudinaryStorage.js';
import { createLocalStorage } from '../../src/storage/localStorage.js';
import { contentTypeForKey, detectImageType } from '../../src/utils/imageType.js';
import { FAKE_JPEG, JPEG, PNG, WEBP } from '../helpers/images.js';

describe('detectImageType', () => {
  it.each([
    [JPEG, 'image/jpeg', 'jpg'],
    [PNG, 'image/png', 'png'],
    [WEBP, 'image/webp', 'webp'],
  ])('recognises %#', (buffer, type, extension) => {
    expect(detectImageType(buffer)).toEqual({ type, extension });
  });

  it('rejects anything else, whatever its name', () => {
    expect(detectImageType(FAKE_JPEG)).toBeNull();
    expect(detectImageType(Buffer.from('%PDF-1.7 ...............'))).toBeNull();
    expect(detectImageType(Buffer.alloc(3))).toBeNull();
  });

  it('maps a stored key back to its content type', () => {
    expect(contentTypeForKey('abc/def.png')).toBe('image/png');
    expect(contentTypeForKey('abc/def.bin')).toBe('application/octet-stream');
  });
});

describe('local storage', () => {
  let dir;
  let storage;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'pp-storage-'));
    storage = createLocalStorage({ rootDir: dir });
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('saves, reads and removes a file inside a per-user folder', async () => {
    const { key } = await storage.save({ userId: 'user1', buffer: PNG, extension: 'png' });
    expect(key).toMatch(/^user1\/[0-9a-f-]{36}\.png$/);
    expect(await storage.read(key)).toEqual(PNG);

    await storage.remove(key);
    await expect(storage.read(key)).rejects.toThrow();
  });

  it('refuses keys that point outside the upload folder', async () => {
    await expect(storage.read('../../etc/passwd')).rejects.toThrow('Invalid storage key');
  });

  it('ignores removing a file that is already gone', async () => {
    await expect(storage.remove('user1/missing.png')).resolves.toBeUndefined();
  });
});

describe('cloudinary storage', () => {
  it('signs parameters exactly like the Cloudinary documentation example', () => {
    const params = {
      eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
      public_id: 'sample_image',
      timestamp: 1315060510,
    };
    expect(signParams(params, 'abcd')).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  const make = (fetchImpl) =>
    createCloudinaryStorage({
      cloudName: 'demo',
      apiKey: 'key123',
      apiSecret: 'secret',
      fetchImpl,
    });

  it('uploads as a private, signed image and returns a key with the format', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ public_id: 'paisa-pal/receipts/u1/abc', format: 'jpg' }),
    });

    const { key } = await make(fetchImpl).save({
      userId: 'u1',
      buffer: JPEG,
      extension: 'jpg',
      contentType: 'image/jpeg',
    });

    expect(key).toBe('paisa-pal/receipts/u1/abc.jpg');
    const [url, { method, body }] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    expect(method).toBe('POST');
    expect(body.get('type')).toBe('private');
    expect(body.get('api_key')).toBe('key123');
    const signedParams = {
      public_id: body.get('public_id'),
      timestamp: body.get('timestamp'),
      type: 'private',
    };
    expect(body.get('signature')).toBe(signParams(signedParams, 'secret'));
    expect(body.get('file')).toBeInstanceOf(Blob);
  });

  it('downloads a private image with a signed request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => PNG.buffer });

    await make(fetchImpl).read('paisa-pal/receipts/u1/abc.png');

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe('/v1_1/demo/image/download');
    expect(url.searchParams.get('public_id')).toBe('paisa-pal/receipts/u1/abc');
    expect(url.searchParams.get('format')).toBe('png');
    expect(url.searchParams.get('type')).toBe('private');
    expect(url.searchParams.get('signature')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('reports a failed upload', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(
      make(fetchImpl).save({
        userId: 'u1',
        buffer: JPEG,
        extension: 'jpg',
        contentType: 'image/jpeg',
      }),
    ).rejects.toThrow('Cloudinary upload failed with 401');
  });
});
