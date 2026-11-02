import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./setup/globalSetup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // One file at a time: they share one backend + database (each test uses its own fresh accounts).
    fileParallelism: false,
  },
});
