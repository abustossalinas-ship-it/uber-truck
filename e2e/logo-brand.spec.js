// @ts-check
const { test, expect } = require('@playwright/test');
const {
  expectLogoFramed,
  expectPngHasAlpha,
  resetGuestAppSession,
  expectLoginOpenForRole,
} = require('./helpers');

const LIGHT_V = '0.0.148';
const NAV_V = '0.0.145';

test.describe('Logo Cubik — encuadre y assets', () => {
  test('asset demo/app es PNG maestro usuario (360×114, alpha)', async ({ request }) => {
    await expectPngHasAlpha(request, `/brand/logo-cubik-nav-light.png?v=${LIGHT_V}`);
    const res = await request.get(`/brand/logo-cubik-nav-light.png?v=${LIGHT_V}`);
    const buf = Buffer.from(await res.body());
    // IHDR width/height at bytes 16-23 (big-endian)
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    expect(w).toBe(360);
    expect(h).toBe(114);
  });

  test('assets PNG nav oscuro tienen canal alpha', async ({ request }) => {
    await expectPngHasAlpha(request, `/brand/logo-cubik-nav.png?v=${NAV_V}`);
  });

  test('/transportistas — logo nav blanco encuadrado', async ({ page }) => {
    await page.goto('/transportistas?v=145');
    await expectLogoFramed(page, {
      img: '.lv3-brand img',
      container: '.lv3-nav',
      srcPattern: /logo-cubik-nav\.png/,
    });
  });

  test('/ — demo logo maestro encuadrado (B correcta)', async ({ page }) => {
    await page.goto(`/?v=${LIGHT_V}`);
    const img = page.locator('.brand-logo').first();
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', new RegExp(`logo-cubik-nav-light\\.png\\?v=${LIGHT_V}`));
    const dims = await img.evaluate((el) => ({
      nw: el.naturalWidth,
      nh: el.naturalHeight,
    }));
    expect(dims.nw).toBe(360);
    expect(dims.nh).toBe(114);
    await expectLogoFramed(page, {
      img: '.brand-logo',
      container: '.site-header',
      srcPattern: /logo-cubik-nav-light\.png/,
      minNaturalWidth: 360,
    });
  });

  test('/app — bienvenida logo maestro encuadrado', async ({ page }) => {
    await page.goto(`/app?v=${LIGHT_V}`);
    await page.waitForSelector('body.cubik-app');
    await page.waitForSelector('#app-gate:not([hidden])');
    const img = page.locator('.app-gate-logo').first();
    await expect(img).toBeVisible();
    const dims = await img.evaluate((el) => ({
      nw: el.naturalWidth,
      nh: el.naturalHeight,
      src: el.currentSrc,
    }));
    expect(dims.nw).toBe(360);
    expect(dims.nh).toBe(114);
    expect(dims.src).toMatch(new RegExp(`v=${LIGHT_V}`));
    await expectLogoFramed(page, {
      img: '.app-gate-logo',
      container: '.app-gate-hero',
      srcPattern: /logo-cubik-nav-light\.png/,
      minNaturalWidth: 360,
    });
  });

  test('/app?role=carrier — login usa logo maestro', async ({ page }) => {
    await page.goto(`/app?role=carrier&v=${LIGHT_V}`);
    await page.waitForSelector('body.cubik-app');
    await expectLoginOpenForRole(page, 'carrier');

    const authLogo = await page.evaluate(() => {
      const panel = document.getElementById('auth-panel');
      if (!panel) return null;
      const cs = getComputedStyle(panel, '::before');
      return {
        bg: cs.backgroundImage,
        h: parseFloat(cs.height),
        w: parseFloat(cs.width),
      };
    });

    expect(authLogo).not.toBeNull();
    expect(authLogo.bg).toMatch(new RegExp(`logo-cubik-nav-light\\.png\\?v=${LIGHT_V}`));
    expect(authLogo.h).toBeGreaterThanOrEqual(32);
    expect(authLogo.w).toBeGreaterThanOrEqual(120);
  });
});
