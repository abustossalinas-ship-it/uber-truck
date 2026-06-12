// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Landing v3 — transportistas y empresas', () => {
  test('/transportistas carga hero y CTAs', async ({ page }) => {
    await page.goto('/transportistas');
    await expect(page.locator('h1')).toContainText(/rentabilidad de tu camión/i);
    await expect(page.locator('.lv3-nav-links a.active')).toHaveText(/Transportistas/i);
    await expect(page.locator('[data-prospect-whatsapp]').first()).toBeVisible();
    await expect(page.locator('[data-prospect-demo]').first()).toBeVisible();
  });

  test('/empresas carga hero y CTAs', async ({ page }) => {
    await page.goto('/empresas');
    await expect(page.locator('h1')).toContainText(/logística eficiente/i);
    await expect(page.locator('.lv3-nav-links a.active')).toHaveText(/Para empresas/i);
    await expect(page.locator('[data-prospect-whatsapp]').first()).toBeVisible();
    await expect(page.locator('[data-prospect-demo]').first()).toBeVisible();
  });

  test('Agendar demo abre modal en empresas', async ({ page }) => {
    await page.goto('/empresas');
    await page.locator('.lv3-hero [data-prospect-demo]').click();
    await expect(page.locator('#prospect-modal')).toBeVisible();
    await expect(page.locator('#prospect-modal-title')).toContainText(/Encantados/i);
    await expect(page.locator('.prospect-modal-close')).toBeVisible();
  });

  test('Clic fuera del modal no cierra con datos', async ({ page }) => {
    await page.goto('/empresas');
    await page.locator('.lv3-hero [data-prospect-demo]').click();
    await page.fill('#prospect-name', 'Juan QA');
    await page.locator('.prospect-modal-backdrop').click({ position: { x: 8, y: 8 } });
    await expect(page.locator('#prospect-modal')).toBeVisible();
    await expect(page.locator('#prospect-name')).toHaveValue('Juan QA');
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.prospect-modal-close').click();
    await expect(page.locator('#prospect-modal')).toBeHidden();
  });
});
