import { defineConfig } from '@playwright/test';
import { browserRuntime } from './scripts/browser-runtime.mjs';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // Software WebGL is expensive; concurrent worlds distort these checks.
  timeout: 90_000,
  expect: { timeout: 12_000 },
  outputDir: '.artifacts/browser-results',
  reporter: [['list'], ['json', { outputFile: '.artifacts/browser-results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1280, height: 720 },
    launchOptions: await browserRuntime(),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30_000,
  },
});
