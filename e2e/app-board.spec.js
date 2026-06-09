// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loginViaWelcome,
  openDeepFromHome,
  expectBoardPanel,
  seedDemoData,
  healthSnapshot,
  hasQaCarrierCreds,
} = require('./helpers');

test.describe('Cubik app — tablero con datos (QA + Supabase)', () => {
  test.skip(!hasQaCarrierCreds(), 'Define QA_CARRIER_EMAIL y QA_CARRIER_PASSWORD');

  test('Demo seed carga tablero con cargas y ofertas', async ({ page, request }) => {
    const health = await healthSnapshot(request);
    test.skip(
      health.storage !== 'supabase' || !health.supabase?.connected,
      'Supabase no conectado en el servidor de prueba'
    );

    const seed = await seedDemoData(request);
    expect(seed.ok).toBeTruthy();

    await loginViaWelcome(page, {
      email: process.env.QA_CARRIER_EMAIL,
      password: process.env.QA_CARRIER_PASSWORD,
      role: 'carrier',
    });

    await openDeepFromHome(page, 'board');
    await expectBoardPanel(page);

    await page.waitForFunction(
      () => {
        const loadSel = document.getElementById('match-load');
        const loadsList = document.getElementById('list-loads');
        const hasLoadOptions = loadSel && loadSel.options.length > 1;
        const hasLoadCards = loadsList && loadsList.textContent.trim().length > 20;
        return hasLoadOptions || hasLoadCards;
      },
      undefined,
      { timeout: 20_000 }
    );

    const offerCount = await page.locator('#match-offer option').count();
    const loadsHtml = await page.locator('#list-loads').innerText();
    expect(offerCount > 1 || loadsHtml.length > 10).toBeTruthy();
  });
});
