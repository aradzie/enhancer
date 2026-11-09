import { defineConfig } from '@playwright/test';

const basePath = process.env.VITE_BASE_PATH && process.env.VITE_BASE_PATH !== './' ? process.env.VITE_BASE_PATH : '/';
const baseURL = `http://127.0.0.1:5173${basePath}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run ${process.env.PLAYWRIGHT_PRODUCTION ? 'preview' : 'dev'} -- --port 5173 --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
