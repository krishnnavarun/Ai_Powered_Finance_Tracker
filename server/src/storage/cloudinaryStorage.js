import { createHash, randomUUID } from 'node:crypto';

const API = 'https://api.cloudinary.com/v1_1';

// Cloudinary request signature: parameters sorted by name, joined as a=1&b=2, followed
// by the API secret, then SHA-1 (hex). https://cloudinary.com/documentation/signatures
export function signParams(params, apiSecret) {
  const toSign = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1')
    .update(toSign + apiSecret)
    .digest('hex');
}

// Stores receipts on Cloudinary as *private* images: nobody can open them by URL.
// The API downloads them with a signed request and serves them only to their owner.
export function createCloudinaryStorage({ cloudName, apiKey, apiSecret, fetchImpl = fetch }) {
  const signed = (params) => ({
    ...params,
    api_key: apiKey,
    signature: signParams(params, apiSecret),
  });
  const timestamp = () => Math.floor(Date.now() / 1000);

  async function call(action, body) {
    const res = await fetchImpl(`${API}/${cloudName}/image/${action}`, { method: 'POST', body });
    if (!res.ok) throw new Error(`Cloudinary ${action} failed with ${res.status}`);
    return res.json();
  }

  return {
    driver: 'cloudinary',

    async save({ userId, buffer, extension, contentType }) {
      const params = signed({
        public_id: `paisa-pal/receipts/${userId}/${randomUUID()}`,
        timestamp: timestamp(),
        type: 'private',
      });
      const form = new FormData();
      for (const [key, value] of Object.entries(params)) form.append(key, String(value));
      form.append('file', new Blob([buffer], { type: contentType }), `receipt.${extension}`);

      const result = await call('upload', form);
      return { key: `${result.public_id}.${result.format}`, url: null };
    },

    async read(key) {
      const dot = key.lastIndexOf('.');
      const params = signed({
        public_id: key.slice(0, dot),
        format: key.slice(dot + 1),
        type: 'private',
        timestamp: timestamp(),
      });
      const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
      const res = await fetchImpl(`${API}/${cloudName}/image/download?${query}`);
      if (!res.ok) throw new Error(`Cloudinary download failed with ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },

    async remove(key) {
      const params = signed({
        public_id: key.slice(0, key.lastIndexOf('.')),
        type: 'private',
        timestamp: timestamp(),
      });
      const form = new FormData();
      for (const [name, value] of Object.entries(params)) form.append(name, String(value));
      await call('destroy', form);
    },
  };
}
