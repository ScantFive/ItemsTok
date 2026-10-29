import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works at https://<user>.github.io/<repo>/
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        export: resolve(import.meta.dirname, 'export.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
});
