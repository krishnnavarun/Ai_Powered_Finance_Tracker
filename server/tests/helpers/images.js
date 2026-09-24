// Tiny but valid image files for upload tests.

// A real 1×1 PNG.
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// Starts like every JPEG (FF D8 FF …), which is what the server checks.
export const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.alloc(64, 1),
]);

// "RIFF" + size + "WEBP" …
export const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(32, 2),
]);

// Not an image, whatever its name says.
export const FAKE_JPEG = Buffer.from('MZ this is really a program, not a photo');
