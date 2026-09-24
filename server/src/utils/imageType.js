// Works out an image's real type from its first bytes (its "magic number"), instead of
// trusting the file name or the browser's claim — a renamed .exe won't pass as a .jpg.
const SIGNATURES = [
  {
    type: 'image/jpeg',
    extension: 'jpg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    type: 'image/png',
    extension: 'png',
    matches: (b) =>
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte),
  },
  {
    type: 'image/webp',
    extension: 'webp',
    matches: (b) =>
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

// → { type: 'image/png', extension: 'png' } or null if it isn't a JPEG, PNG or WebP.
export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const match = SIGNATURES.find((signature) => signature.matches(buffer));
  return match ? { type: match.type, extension: match.extension } : null;
}

export function contentTypeForKey(key) {
  const extension = key.slice(key.lastIndexOf('.') + 1);
  return (
    SIGNATURES.find((signature) => signature.extension === extension)?.type ??
    'application/octet-stream'
  );
}
