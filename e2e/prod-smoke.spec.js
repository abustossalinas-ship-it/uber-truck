// @ts-check
/**
 * Smoke contra Railway (misma UI que ?app=1 en web y APK modo remoto).
 * Ejecutar: npm run test:e2e:prod
 */
const { test, expect } = require('@playwright/test');
const {
  resetGuestAppSession,
  openWelcomeRole,
  expectLoginOpenForRole,
} = require('./helpers');

const PROD_ORIGIN =
  process.env.PLAYWRIGHT_PROD_URL || 'https://www.getcubik.cl';

test.describe('Producción — welcome/login (APK remoto / web app)', () => {
  test('deploy.json responde con versión', async ({ request }) => {
    const res = await request.get(`${PROD_ORIGIN}/deploy.json`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('auth-ui.js en prod no tiene sintaxis rota', async ({ request }) => {
    const deploy = await (await request.get(`${PROD_ORIGIN}/deploy.json`)).json();
    const res = await request.get(`${PROD_ORIGIN}/auth-ui.js?v=${deploy.version}`);
    expect(res.ok()).toBeTruthy();
    const src = await res.text();
    expect(src).toContain('window.openAuthPanel = openAuthPanel');
    expect(src).not.toMatch(/querySelector\([^)]+\)\?\.[\w]+\s*=/);
  });

  test('Comenzar Transportista abre login en prod', async ({ page }) => {
    await resetGuestAppSession(page);
    await openWelcomeRole(page, 'carrier');
    await expectLoginOpenForRole(page, 'carrier');
  });

  test('Comenzar Empresa abre login en prod', async ({ page }) => {
    await resetGuestAppSession(page);
    await openWelcomeRole(page, 'shipper');
    await expectLoginOpenForRole(page, 'shipper');
  });
});

test.describe('Producción — landing y piloto', () => {
  test('Portada / carga headline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(/mueven Chile|Menos viajes vacíos|Conectamos cargas/i);
    await expect(page.locator('#lv3-loading, #landing-loading')).toBeHidden();
  });

  test('/probar carga para testers', async ({ page }) => {
    await page.goto('/probar');
    await expect(page.locator('h1')).toContainText(/Cubik/i);
  });

  test('Landing → app → atrás sin overlay pegado', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lv3-nav-actions a.lv3-btn-teal[href="/app"]').click();
    await page.waitForURL(/\/app/);
    await page.goBack();
    await expect(page.locator('#lv3-loading, #landing-loading')).toBeHidden();
  });
});
