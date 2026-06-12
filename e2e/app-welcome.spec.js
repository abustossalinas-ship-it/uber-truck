// @ts-check
const { test, expect } = require('@playwright/test');
const {
  resetGuestAppSession,
  openWelcomeRole,
  expectLoginOpenForRole,
  hasQaCarrierCreds,
  loginViaWelcome,
} = require('./helpers');

test.describe('Cubik app — welcome y login', () => {
  test.beforeEach(async ({ page }) => {
    await resetGuestAppSession(page);
  });

  test('Soy transportista abre login contextual', async ({ page }) => {
    await openWelcomeRole(page, 'carrier');
    await expectLoginOpenForRole(page, 'carrier');
    await expect(page.locator('#auth-app-role-badge')).toBeVisible();
    await expect(page.locator('#auth-app-role-label')).toHaveText(/Transportista/i);
    await expect(page.locator('#auth-submit')).toContainText(/Iniciar sesión/i);
  });

  test('Soy empresa abre login contextual', async ({ page }) => {
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

  test('Ingresar con rol previo abre login', async ({ page }) => {
    await page.evaluate(() => sessionStorage.setItem('ut_auth_intent_role', 'carrier'));
    await page.locator('#app-welcome-signin').click();
    await expectLoginOpenForRole(page, 'carrier');
  });

  test('Ingresar sin rol mantiene bienvenida', async ({ page }) => {
    await page.locator('#app-welcome-signin').click();
    await expect(page.locator('#app-welcome')).toBeVisible();
    await expect(page.locator('#auth-panel')).toBeHidden();
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
