// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.QA_PORT || process.env.PORT || '3001';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './e2e',
  testIgnore: ['**/prod-smoke.spec.js'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'public/qa-last-run.json' }]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'mobile-app',
      use: {
        ...devices['Pixel 5'],
        locale: 'es-CL',
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: `node src/server.js`,
        url: `${baseURL}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          PORT: String(PORT),
          NODE_ENV: 'test',
          LANDING_HOSTS: '127.0.0.1,localhost',
        },
      },
});
