// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const prodURL =
  process.env.PLAYWRIGHT_PROD_URL || 'https://uber-truck-production.up.railway.app';

module.exports = defineConfig({
  testDir: './e2e',
  testMatch: 'prod-smoke.spec.js',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'public/qa-last-run-prod.json' }]],
  timeout: 60_000,
  use: {
    baseURL: prodURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
    ...devices['Pixel 5'],
    locale: 'es-CL',
  },
});
