import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works at https://<user>.github.io/<repo>/
  base: './',
  test: {
    environment: 'jsdom',
  },
});
