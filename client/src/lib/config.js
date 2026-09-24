// In development Vite proxies /api to the local server (see vite.config.js), so the
// default works as-is. In production set VITE_API_URL to the deployed API, e.g.
// https://paisa-pal-api.onrender.com/api
export const API_URL = import.meta.env.VITE_API_URL || '/api';
