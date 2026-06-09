// @ts-check
const { test, expect } = require('@playwright/test');
const { resetGuestAppSession, openWelcomeRole, expectLoginOpenForRole, expectToggleRole } = require('./helpers');

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
  test.skip(
    !process.env.QA_CARRIER_EMAIL || !process.env.QA_CARRIER_PASSWORD,
    'Define QA_CARRIER_EMAIL y QA_CARRIER_PASSWORD para probar login real'
  );

  test('Login transportista llega a Inicio', async ({ page }) => {
    await resetGuestAppSession(page);
    await openWelcomeRole(page, 'carrier');
    await page.fill('#form-auth [name="email"]', process.env.QA_CARRIER_EMAIL);
    await page.fill('#form-auth [name="password"]', process.env.QA_CARRIER_PASSWORD);
    await page.locator('#auth-submit').click();
    await expect(page.locator('#app-chrome')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#app-view-home')).toBeVisible();
    await expect(page.locator('#app-gate')).toBeHidden();
  });
});
