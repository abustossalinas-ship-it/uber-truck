// @ts-check
const { test, expect } = require('@playwright/test');
const {
  expectLogoFramed,
  expectPngHasAlpha,
  expectLoginOpenForRole,
} = require('./helpers');

const V = '0.0.167';

test.describe('Logo Cubik — encuadre y assets', () => {
  test('asset app oficial es PNG maestro (362×114, alpha)', async ({ request }) => {
    await expectPngHasAlpha(request, `/brand/logo-cubik-official-light.png?v=${V}`);
    const res = await request.get(`/brand/logo-cubik-official-light.png?v=${V}`);
    const buf = Buffer.from(await res.body());
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    expect(w).toBe(362);
    expect(h).toBe(114);
  });

  test('assets PNG nav oscuro tienen canal alpha', async ({ request }) => {
    await expectPngHasAlpha(request, `/brand/logo-cubik-nav.png?v=${V}`);
  });

  test('/transportistas — logo nav blanco encuadrado', async ({ page }) => {
    await page.goto(`/transportistas?v=${V}`);
    await expectLogoFramed(page, {
      img: '.lv3-brand img',
      container: '.lv3-nav',
      srcPattern: /logo-cubik-nav\.png/,
    });
  });

  test('/ — sitio principal nav oscuro con logo blanco', async ({ page }) => {
    await page.goto(`/?v=${V}`);
    const img = page.locator('.lv3-brand img').first();
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', /logo-cubik-nav\.png/);
    await expectLogoFramed(page, {
      img: '.lv3-brand img',
      container: '.lv3-nav',
      srcPattern: /logo-cubik-nav\.png/,
      minNaturalWidth: 300,
    });
  });

  test('/app — bienvenida logo oficial encuadrado', async ({ page }) => {
    await page.goto(`/app?v=${V}`);
    await page.waitForSelector('body.cubik-app');
    await page.waitForSelector('#app-gate:not([hidden])');
    const img = page.locator('.app-gate-logo').first();
    await expect(img).toBeVisible();
    const dims = await img.evaluate((el) => ({
      nw: el.naturalWidth,
      nh: el.naturalHeight,
    }));
    expect(dims.nw).toBe(362);
    expect(dims.nh).toBe(114);
    await expectLogoFramed(page, {
      img: '.app-gate-logo',
      container: '.app-gate-hero',
      srcPattern: /logo-cubik-official-light\.png/,
      minNaturalWidth: 360,
      ratioMin: 2.5,
      ratioMax: 5,
    });
  });

  test('/app?role=carrier — login contextual sin logo duplicado', async ({ page }) => {
    await page.goto(`/app?role=carrier&v=${V}`);
    await page.waitForSelector('body.cubik-app');
    await expectLoginOpenForRole(page, 'carrier');

    await expect(page.locator('#auth-app-role-badge')).toBeVisible();
    await expect(page.locator('#auth-app-role-label')).toHaveText(/Transportista/i);
    await expect(page.locator('#auth-submit')).toContainText(/Iniciar sesión/i);

    const authLogo = await page.evaluate(() => {
      const panel = document.getElementById('auth-panel');
      if (!panel) return null;
      const cs = getComputedStyle(panel, '::before');
      return { display: cs.display, bg: cs.backgroundImage };
    });

    expect(authLogo).not.toBeNull();
    expect(authLogo.display).toBe('none');
  });
});
