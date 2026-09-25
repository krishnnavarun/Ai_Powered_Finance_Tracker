import * as importService from '../services/import.service.js';

export async function preview(req, res) {
  const data = await importService.previewCsv(req.user.id, req.file, req.body.mapping);
  res.json({ success: true, data });
}

export async function commit(req, res) {
  const data = await importService.commitCsv(req.user.id, req.body);
  res.status(201).json({ success: true, data });
}
