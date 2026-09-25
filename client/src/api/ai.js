import { api } from './client';

// { enabled, configured, provider }
export async function aiStatus() {
  const res = await api.get('/ai/status');
  return res.data.data;
}

// "spent 250 on biryani yesterday" → { draft, usedAI }
export async function parseText(text) {
  const res = await api.post('/ai/parse/text', { text });
  return res.data.data;
}

// Pasted SMS → { items: [{ index, text, status, reason?, draft?, possibleDuplicate?, via? }], usedAI }
export async function parseSms(text) {
  const res = await api.post('/ai/parse/sms', { text });
  return res.data.data;
}

// Receipt photo → AI vision → { draft, items, tax, usedAI }
export async function parseReceipt(file) {
  const form = new FormData();
  form.append('receipt', file, file.name);
  const res = await api.post('/ai/parse/receipt', form);
  return res.data.data;
}

// Text read from the photo on this device (AI off) → { draft, usedAI: false }
export async function parseReceiptText(text) {
  const res = await api.post('/ai/parse/receipt-text', { text });
  return res.data.data;
}

// [{ type, merchant?, note? }] → { suggestions: [{ categoryId, confidence, via }] }
export async function categorize(items) {
  const res = await api.post('/ai/categorize', { items });
  return res.data.data;
}
