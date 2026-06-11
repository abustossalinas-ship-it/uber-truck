// @ts-check
const { test, expect } = require('@playwright/test');

const PRIMARY = '#06b6d4';
const DARK = '#0f172a';
const BG = '#f8fafc';

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
  test('tokens CSS en sitio principal', async ({ page }) => {
    await page.goto('/?v=149');
    const primary = await readToken(page, '--cubik-primary');
    const dark = await readToken(page, '--cubik-dark');
    expect(primary.toLowerCase()).toBe(PRIMARY);
    expect(dark.toLowerCase()).toBe(DARK);

    const headerBg = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.site-header')).backgroundColor
    );
    expect(colorClose(headerBg, DARK)).toBeTruthy();
  });

  test('tokens y nav oscuro en transportistas', async ({ page }) => {
    await page.goto('/transportistas?v=149');
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

  test('empresas comparte paleta con transportistas', async ({ page }) => {
    await page.goto('/empresas?v=149');
    const btn = page.locator('.lv3-btn-teal').first();
    await expect(btn).toBeVisible();
    const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg).toMatch(/gradient|06b6d4|22d3ee/i);
  });

  test('app — header oscuro y nav activo turquesa', async ({ page }) => {
    await page.goto('/app?v=149');
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
  });
});
