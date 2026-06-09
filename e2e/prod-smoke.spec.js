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
  process.env.PLAYWRIGHT_PROD_URL || 'https://uber-truck-production.up.railway.app';

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
