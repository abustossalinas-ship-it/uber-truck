// @ts-check
const { test, expect } = require('@playwright/test');
const { expectLoginOpenForRole } = require('./helpers');

test.describe('Landing v2 — transportistas y empresas', () => {
  test('/transportistas carga hero y CTAs', async ({ page }) => {
    await page.goto('/transportistas');
    await expect(page.locator('h1')).toContainText(/encuentra cargas/i);
    await expect(page.locator('.lv2-nav-links a.active')).toHaveText(/Transportistas/i);
    await expect(page.locator('a[href="/app?role=carrier"]').first()).toBeVisible();
  });

  test('/empresas carga hero y CTAs', async ({ page }) => {
    await page.goto('/empresas');
    await expect(page.locator('h1')).toContainText(/transporte confiable/i);
    await expect(page.locator('.lv2-nav-links a.active')).toHaveText(/Empresas/i);
    await expect(page.locator('a[href="/app?role=shipper"]').first()).toBeVisible();
  });

  test('Transportistas → app abre login carrier', async ({ page }) => {
    await page.goto('/transportistas');
    await page.locator('a.lv2-btn-primary[href="/app?role=carrier"]').first().click();
    await page.waitForURL(/\/app\?role=carrier/);
    await expectLoginOpenForRole(page, 'carrier');
  });

  test('Empresas → app abre login shipper', async ({ page }) => {
    await page.goto('/empresas');
    await page.locator('a.lv2-btn-primary[href="/app?role=shipper"]').first().click();
    await page.waitForURL(/\/app\?role=shipper/);
    await expectLoginOpenForRole(page, 'shipper');
  });
});
