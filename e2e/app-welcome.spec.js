// @ts-check
const { test, expect } = require('@playwright/test');
const {
  resetGuestAppSession,
  openWelcomeRole,
  expectLoginOpenForRole,
  expectToggleRole,
  hasQaCarrierCreds,
  loginViaWelcome,
} = require('./helpers');

test.describe('Cubik app — welcome y login', () => {
  test.beforeEach(async ({ page }) => {
    await resetGuestAppSession(page);
  });

  test('Comenzar como Transportista abre login contextual', async ({ page }) => {
    await openWelcomeRole(page, 'carrier');
    await expectLoginOpenForRole(page, 'carrier');
    await expect(page.locator('#auth-submit')).toContainText(/Entrar/i);
  });

  test('Comenzar como Empresa abre login contextual', async ({ page }) => {
    await openWelcomeRole(page, 'shipper');
    await expectLoginOpenForRole(page, 'shipper');
  });

  test('Atrás con formulario vacío vuelve al welcome', async ({ page }) => {
    await openWelcomeRole(page, 'carrier');
    await expectLoginOpenForRole(page, 'carrier');
    const wentBack = await page.evaluate(() =>
      typeof handleAuthBackNavigation === 'function' ? handleAuthBackNavigation() : false
    );
    expect(wentBack).toBe(true);
    await expect(page.locator('#app-welcome')).toBeVisible();
    await expect(page.locator('#auth-panel')).toBeHidden();
  });

  test('Toggle cambia rol sin volver al welcome', async ({ page }) => {
    await openWelcomeRole(page, 'carrier');
    await expectLoginOpenForRole(page, 'carrier');
    await page.locator('#auth-toggle-shipper').click();
    await expectToggleRole(page, 'shipper');
    await expect(page.locator('#app-welcome')).toBeHidden();
  });
});

test.describe('Cubik app — login opcional (QA_* en .env)', () => {
  test.skip(!hasQaCarrierCreds(), 'Define QA_CARRIER_EMAIL y QA_CARRIER_PASSWORD para probar login real');

  test('Login transportista llega a Inicio', async ({ page }) => {
    await loginViaWelcome(page, {
      email: process.env.QA_CARRIER_EMAIL,
      password: process.env.QA_CARRIER_PASSWORD,
      role: 'carrier',
    });
  });
});
