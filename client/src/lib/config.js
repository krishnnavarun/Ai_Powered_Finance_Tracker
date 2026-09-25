// Where the API lives. /api works in development (Vite forwards it) and on Vercel
// (vercel.json forwards it to the Render API). Set VITE_API_URL only for another setup.
export const API_URL = import.meta.env.VITE_API_URL || '/api';
