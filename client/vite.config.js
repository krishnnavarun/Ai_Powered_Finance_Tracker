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
          // A group holds only the packages its `test` names. (The default also pulls in
          // everything they depend on — e.g. clsx, which our own code uses on every page,
          // would drag the whole charts chunk into the first load.)
          includeDependenciesRecursively: false,
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              priority: 20,
            },
            // Charts (Recharts and its d3/redux helpers) are only used by the dashboard and
            // reports pages, so they load with those pages instead of on every visit.
            {
              name: 'charts',
              // Only packages used by nothing else — a shared helper here would pull
              // the whole chunk into the first page load.
              test: /node_modules[\\/](recharts|victory-vendor|d3-[^\\/]+|internmap|decimal\.js-light|@reduxjs|react-redux|redux|redux-thunk|immer|reselect|es-toolkit|eventemitter3|tiny-invariant|use-sync-external-store)[\\/]/,
              priority: 16,
            },
            // On-device receipt reading: downloaded only when a receipt is read with AI off.
            {
              name: 'ocr',
              test: /node_modules[\\/](tesseract\.js|tesseract\.js-core|bmp-js|idb-keyval|is-url|node-fetch|regenerator-runtime|wasm-feature-detect|zlibjs)[\\/]/,
              priority: 17,
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
    // refresh cookie just works. On Vercel, vercel.json does the same forwarding.
    // (The browser tests point it at their own test API with API_PROXY_TARGET.)
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:5000' },
  },
  test: {
    // Threads start much faster than child processes, which avoids worker start-up
    // timeouts on a cold run right after `npm ci` (always the case in CI).
    pool: 'threads',
    // Page tests render whole pages in jsdom (a simulated browser that is far slower
    // than a real one). A test that takes 2 s alone can take 25 s when other programs
    // keep the CPU busy. The tests check behaviour, not speed.
    testTimeout: 45_000,
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
