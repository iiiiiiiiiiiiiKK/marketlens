import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `VITE_BASE` lets the CI build target a GitHub Pages sub-path
// (e.g. "/marketlens/") while local builds stay at "/".
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          // The charting engine is only needed once a market is opened.
          charts: ['lightweight-charts'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});
