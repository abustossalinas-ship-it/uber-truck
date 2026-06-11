// @ts-check
const { test, expect } = require('@playwright/test');

const PRIMARY = '#06b6d4';
const DARK = '#0f172a';
const BG = '#f8fafc';
const NAV_INACTIVE = '#94a3b8';
const CACHE = '151';

/** @param {import('@playwright/test').Page} page */
async function readToken(page, name) {
  return page.evaluate((varName) => {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  }, name);
}

/** @param {string} hex */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** @param {string} cssColor @param {string} hex */
function colorClose(cssColor, hex) {
  const m = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return cssColor.toLowerCase().includes(hex.toLowerCase());
  const t = hexToRgb(hex);
  return (
    Math.abs(+m[1] - t.r) <= 2 &&
    Math.abs(+m[2] - t.g) <= 2 &&
    Math.abs(+m[3] - t.b) <= 2
  );
}

test.describe('Cubik Brand 2.0 — design system', () => {
  test('sitio principal — landing v3 con hero oscuro', async ({ page }) => {
    await page.goto(`/?v=${CACHE}`);
    await expect(page.locator('body.lv3-home')).toBeVisible();
    await expect(page.locator('.lv3-accent')).toContainText('mueve Chile');

    const primary = await readToken(page, '--cubik-primary');
    expect(primary.toLowerCase()).toBe(PRIMARY);

    const navBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.lv3-nav')).backgroundColor
    );
    expect(colorClose(navBg, DARK)).toBeTruthy();

    const ctaBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.lv3-btn-teal')).backgroundImage
    );
    expect(ctaBg).toMatch(/gradient|06b6d4|22d3ee/i);
  });

  test('tokens y nav oscuro en transportistas', async ({ page }) => {
    await page.goto(`/transportistas?v=${CACHE}`);
    const teal = await readToken(page, '--cubik-teal');
    expect(teal.toLowerCase()).toBe(PRIMARY);

    const navBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.lv3-nav')).backgroundColor
    );
    expect(colorClose(navBg, DARK)).toBeTruthy();

    const featuresBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.lv3-features')).backgroundColor
    );
    expect(colorClose(featuresBg, BG)).toBeTruthy();
  });

  test('header global idéntico en home, empresas y transportistas', async ({ page }) => {
    for (const path of ['/', '/empresas', '/transportistas']) {
      await page.goto(`${path}?v=${CACHE}`);
      await expect(page.locator('.lv3-nav .lv3-btn-ghost')).toHaveText('Iniciar sesión');
      await expect(page.locator('.lv3-nav .lv3-btn-teal')).toHaveText('Regístrate gratis');
      const navH = await page.evaluate(() =>
        getComputedStyle(document.querySelector('.lv3-nav')).minHeight
      );
      expect(navH).toBe('64px');
    }
  });

  test('hero comparte CTA primario y secundario', async ({ page }) => {
    for (const path of ['/', '/empresas', '/transportistas']) {
      await page.goto(`${path}?v=${CACHE}`);
      await expect(page.locator('.lv3-hero .lv3-btn-teal').first()).toBeVisible();
      await expect(page.locator('.lv3-hero .lv3-btn-secondary').first()).toBeVisible();
      await expect(page.locator('.lv3-hero-metrics-inner .lv3-metric')).toHaveCount(4);
    }
  });

  test('empresas comparte paleta con transportistas', async ({ page }) => {
    await page.goto(`/empresas?v=${CACHE}`);
    const btn = page.locator('.lv3-btn-teal').first();
    await expect(btn).toBeVisible();
    const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toMatch(/gradient|06b6d4|22d3ee/i);
  });

  test('app — header oscuro, nav activo/inactivo y cards inicio', async ({ page }) => {
    await page.goto(`/app?v=${CACHE}`);
    await page.waitForSelector('body.cubik-app');

    const gateBg = await readToken(page, '--cubik-bg');
    expect(gateBg.toLowerCase()).toBe(BG);

    await page.evaluate(() => {
      document.body.classList.add('app-authed');
      const chrome = document.getElementById('app-chrome');
      if (chrome) chrome.style.display = 'flex';
    });

    const topBg = await page.evaluate(() => {
      const bar = document.querySelector('.app-top-bar');
      return bar ? getComputedStyle(bar).backgroundColor : '';
    });
    if (topBg) expect(colorClose(topBg, DARK)).toBeTruthy();

    const activeColor = await page.evaluate(() => {
      const item = document.querySelector('.app-nav-item.active');
      return item ? getComputedStyle(item).color : '';
    });
    if (activeColor) expect(colorClose(activeColor, PRIMARY)).toBeTruthy();

    const inactiveColor = await readToken(page, '--cubik-nav-inactive');
    expect(inactiveColor.toLowerCase()).toBe(NAV_INACTIVE);

    const accentCard = page.locator('.app-quick-card.accent').first();
    await expect(accentCard).toBeVisible();
    const accentBorder = await accentCard.evaluate((el) => getComputedStyle(el).borderLeftColor);
    expect(colorClose(accentBorder, PRIMARY)).toBeTruthy();
    await expect(accentCard.locator('.app-quick-icon svg')).toBeVisible();
  });
});
