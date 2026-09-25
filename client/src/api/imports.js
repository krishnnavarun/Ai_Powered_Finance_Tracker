import { api } from './client';

// Reads a bank statement CSV without saving anything. `mapping` = the columns the user
// picked ({ headerIndex, mapping }) when the automatic guess was wrong.
export async function previewCsv(file, mapping) {
  const form = new FormData();
  if (mapping) form.append('mapping', JSON.stringify(mapping));
  form.append('statement', file, file.name);
  const res = await api.post('/import/csv/preview', form);
  return res.data.data;
}

// { walletId, keepBalance, rows } → { imported }
export async function commitCsv(body) {
  const res = await api.post('/import/csv/commit', body);
  return res.data.data;
}
