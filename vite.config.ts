import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  server: {
    proxy: { '/api': 'http://127.0.0.1:3000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.ts?(x)', '../server/src/**/*.test.ts'],
    coverage: { reporter: ['text', 'html'] },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
