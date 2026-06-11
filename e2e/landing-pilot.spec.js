// @ts-check
const { test, expect } = require('@playwright/test');
const { expectLoginOpenForRole } = require('./helpers');

const heroShipper = '.hero-actions a[href="/empresas"]';
const heroCarrier = '.hero-actions a[href="/transportistas"]';

test.describe('Landing getcubik — portada y navegación', () => {
  test('Portada muestra headline y CTAs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(/Menos viajes vacíos/i);
    await expect(page.locator(heroShipper)).toBeVisible();
    await expect(page.locator(heroCarrier)).toBeVisible();
    await expect(page.locator('#landing-loading')).toBeHidden();
  });

  test('Soy empresa navega a landing y luego app', async ({ page }) => {
    await page.goto('/');
    await page.locator(heroShipper).click();
    await page.waitForURL(/\/empresas/);
    await page.locator('a[href="/app?role=shipper"]').first().click();
    await page.waitForURL(/\/app\?role=shipper/);
    await expectLoginOpenForRole(page, 'shipper');
  });

  test('Soy transportista navega a landing y luego app', async ({ page }) => {
    await page.goto('/');
    await page.locator(heroCarrier).click();
    await page.waitForURL(/\/transportistas/);
    await page.locator('a[href="/app?role=carrier"]').first().click();
    await page.waitForURL(/\/app\?role=carrier/);
    await expectLoginOpenForRole(page, 'carrier');
  });

  test('Atrás desde app no deja overlay Abriendo Cubik pegado', async ({ page }) => {
    await page.goto('/transportistas');
    await page.locator('a[href="/app?role=carrier"]').first().click();
    await page.waitForURL(/\/app\?/);
    await page.goBack();
    await expect(page.locator('#lv3-loading')).toBeHidden();
    await expect(page.locator('h1')).toContainText(/rentabilidad de tu camión/i);
  });
});

test.describe('Piloto — /probar', () => {
  test('Página testers carga', async ({ page }) => {
    await page.goto('/probar');
    await expect(page.locator('h1')).toContainText(/Cubik/i);
    await expect(page.getByRole('link', { name: /Abrir Cubik/i })).toBeVisible();
  });

  test('Desde landing link a probar', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/probar"]').first().click();
    await page.waitForURL(/\/probar/);
    await expect(page.locator('h1')).toContainText(/Cubik/i);
  });
});
