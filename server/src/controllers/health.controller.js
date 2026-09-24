import { getHealth } from '../services/health.service.js';

// 200 when healthy, 503 otherwise — hosting platforms (Render/Railway) use this to restart the API.
export function healthCheck(_req, res) {
  const { healthy, ...data } = getHealth();
  res.status(healthy ? 200 : 503).json({ success: healthy, data });
}
