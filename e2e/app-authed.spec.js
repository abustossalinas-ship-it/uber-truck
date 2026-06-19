// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loginAsMockUser,
  tapAppTab,
  openDeepFromHome,
  expectBoardPanel,
  loginViaWelcome,
  hasQaCarrierCreds,
} = require('./helpers');

test.describe('Cubik app — sesión mock (sin backend)', () => {
  test('Transportista: Inicio muestra saludo y acceso a Emparejar', async ({ page }) => {
    await loginAsMockUser(page, 'carrier');
    await expect(page.locator('#app-home-greeting')).toContainText(/Hola/i);
    await expect(page.locator('#app-quick-board')).toBeVisible();
    await openDeepFromHome(page, 'board');
    await expectBoardPanel(page);
    await expect(page.locator('#app-top-title')).toContainText(/Emparejar/i);
  });

  test('Transportista: atrás desde Emparejar vuelve a Inicio', async ({ page }) => {
    await loginAsMockUser(page, 'carrier');
    await openDeepFromHome(page, 'board');
    await page.locator('#app-top-back').click();
    await page.waitForFunction(() => !document.body.classList.contains('app-deep'));
    await expect(page.locator('#app-view-home')).toBeVisible();
    await expect(page.locator('#app-top-title')).toContainText(/Inicio/i);
  });

  test('Embarcador: Opciones muestra Publicar carga y Emparejar', async ({ page }) => {
    await loginAsMockUser(page, 'shipper');
    await tapAppTab(page, 'options');
    await expect(page.locator('#app-opt-shipper')).toBeVisible();
    await expect(page.locator('[data-app-action="board"]')).toBeVisible();
    await page.locator('[data-app-action="board"]').click();
    await expectBoardPanel(page);
  });

  test('Actividad muestra sección Mis viajes', async ({ page }) => {
    await loginAsMockUser(page, 'carrier');
    await tapAppTab(page, 'activity');
    await expect(page.locator('#panel-trips h2')).toContainText(/Mis viajes/i);
  });

  test('Cuenta muestra perfil y cerrar sesión', async ({ page }) => {
    await loginAsMockUser(page, 'carrier');
    await tapAppTab(page, 'account');
    await expect(page.locator('#app-btn-logout')).toBeVisible();
    await expect(page.locator('#app-view-account')).toBeVisible();
  });

  test('Cuenta: acordeón multas se despliega antes de cerrar sesión', async ({ page }) => {
    await loginAsMockUser(page, 'shipper');
    await tapAppTab(page, 'account');
    const logout = page.locator('#app-btn-logout');
    const penaltiesBtn = page.locator('[data-profile-action="penalties"]');
    await penaltiesBtn.click();
    await expect(penaltiesBtn).toHaveAttribute('aria-expanded', 'true');
    const slot = page.locator('#app-panel-slot-penalties');
    await expect(slot).toBeVisible();
    const logoutBox = await logout.boundingBox();
    const slotBox = await slot.boundingBox();
    expect(slotBox && logoutBox && slotBox.y < logoutBox.y).toBeTruthy();
  });

  test('Cuenta: acordeón no bloquea la navegación inferior', async ({ page }) => {
    await loginAsMockUser(page, 'carrier');
    await tapAppTab(page, 'account');
    await page.locator('[data-profile-action="password"]').click();
    await expect(page.locator('[data-profile-action="password"]')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(page.locator('#app-panel-slot-password #change-password-panel')).toBeVisible();
    await tapAppTab(page, 'home');
    await expect(page.locator('#app-view-home')).toBeVisible();
    await tapAppTab(page, 'account');
    await page.locator('[data-profile-action="kyc"]').click();
    await expect(page.locator('#app-panel-slot-kyc')).toBeVisible();
    await tapAppTab(page, 'options');
    await expect(page.locator('#app-view-options')).toBeVisible();
  });

  test('Cuenta: acordeón permanece abierto tras Auth.render', async ({ page }) => {
    await loginAsMockUser(page, 'shipper');
    await tapAppTab(page, 'account');
    await page.locator('[data-profile-action="help"]').click();
    await expect(page.locator('#app-panel-slot-help')).toBeVisible();
    await page.evaluate(() => {
      if (typeof Auth !== 'undefined' && typeof Auth.render === 'function') Auth.render();
    });
    await expect(page.locator('#app-panel-slot-help')).toBeVisible();
    await expect(page.locator('[data-profile-action="help"]')).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('Cubik app — login real (QA_* en .env)', () => {
  test.skip(!hasQaCarrierCreds(), 'Define QA_CARRIER_EMAIL y QA_CARRIER_PASSWORD');

  test('Login transportista navega a Emparejar', async ({ page }) => {
    await loginViaWelcome(page, {
      email: process.env.QA_CARRIER_EMAIL,
      password: process.env.QA_CARRIER_PASSWORD,
      role: 'carrier',
    });
    await openDeepFromHome(page, 'board');
    await expectBoardPanel(page);
  });
});
