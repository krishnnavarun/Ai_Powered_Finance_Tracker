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
  build: {
    rolldownOptions: {
      output: {
        // Libraries get their own files: they change far less often than our code,
        // so browsers keep them cached across deploys.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              priority: 20,
            },
            // Only pages with forms import these, so this file loads only when one is opened.
            {
              name: 'forms',
              test: /node_modules[\\/](zod|react-hook-form|@hookform)[\\/]/,
              priority: 15,
            },
            {
              name: 'ui',
              test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react)[\\/]/,
              priority: 10,
            },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 0 },
          ],
        },
      },
    },
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
