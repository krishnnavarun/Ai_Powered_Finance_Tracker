import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // `@/components/...` instead of long `../../components/...` paths.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Dev only: forward /api to the local API, so the browser sees one origin and the
    // refresh cookie just works. Production uses VITE_API_URL instead.
    proxy: { '/api': 'http://localhost:5000' },
  },
  test: {
    // Threads start much faster than child processes, which avoids worker start-up
    // timeouts on a cold run right after `npm ci` (always the case in CI).
    pool: 'threads',
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
