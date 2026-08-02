import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wasm()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  optimizeDeps: {
    exclude: ['voro3d'],
  },
  build: {
    target: 'esnext',
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
