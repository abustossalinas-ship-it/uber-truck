const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('http://127.0.0.1:3001/?app=1', { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(4000);

  const state = await page.evaluate(() => {
    const btn = document.querySelector('#app-welcome-roles [data-auth-intent="carrier"]');
    return {
      openAuthPanel: typeof window.openAuthPanel,
      welcomeBound: btn?.dataset?.welcomeBound ?? null,
      authMounted: document.getElementById('app-gate')?.dataset?.authMounted ?? null,
      cubikApp: document.body.classList.contains('cubik-app'),
      authPanelHidden: document.getElementById('auth-panel')?.hidden,
      authUiScript: Boolean(document.querySelector('script[src*="auth-ui.js"]')),
    };
  });

  console.log(JSON.stringify({ state, errors }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
