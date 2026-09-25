// Reads the text in a photo right here in the browser, for when AI is off. The photo
// never leaves the device; only the text is sent on to be read. Tesseract (and its
// language data) is downloaded the first time this is used, not with the app.
export async function readTextOnDevice(file, onProgress) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress?.(Math.round(message.progress * 100));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
