import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@lib': fileURLToPath(new URL('./src/libs', import.meta.url)),
      '@app': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
    clearMocks: false,
    mockReset: false,
    restoreMocks: false,
  },
});
