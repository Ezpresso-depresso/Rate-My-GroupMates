import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './tests/demo-browser',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5189' },
  webServer: {
    command: `"${process.execPath}" scripts/start-afterparty.mjs --port 5189 --no-open`,
    url: 'http://127.0.0.1:5189', reuseExistingServer: false,
  },
});
