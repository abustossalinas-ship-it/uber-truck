// @ts-check
const { expect } = require('@playwright/test');

const MOCK_PROFILES = {
  carrier: {
    full_name: 'QA Transportista',
    company_name: 'Flota QA E2E',
    role: 'carrier',
  },
  shipper: {
    full_name: 'QA Embarcador',
    company_name: 'Empresa QA E2E',
    role: 'shipper',
  },
};

/** @param {import('@playwright/test').Page} page */
async function resetGuestAppSession(page) {
  await page.goto('/app', { waitUntil: 'load' });
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    localStorage.removeItem('ut_token');
    localStorage.removeItem('ut_user');
    localStorage.setItem('cubik_device_id', 'qa-e2e-playwright');
    sessionStorage.removeItem('ut_auth_intent_role');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('body.cubik-app');
  await page.waitForSelector('#app-gate:not([hidden])');
  await page.waitForSelector('#app-welcome:not([hidden])');
  await page.waitForSelector('#app-welcome-roles [data-auth-intent="carrier"]');
  await page.waitForFunction(() => typeof window.openAuthPanel === 'function');
}

/** @param {import('@playwright/test').Page} page */
async function openWelcomeRole(page, role) {
  const btn = page.locator(`#app-welcome-roles [data-auth-intent="${role}"]`);
  await btn.waitFor({ state: 'visible' });
  await btn.click();
}

/** @param {import('@playwright/test').Page} page */
async function expectLoginOpenForRole(page, role) {
  await page.waitForFunction(() => {
    const panel = document.getElementById('auth-panel');
    return panel && !panel.hidden && !panel.hasAttribute('hidden');
  });
  await page.locator('#app-welcome').waitFor({ state: 'hidden' });
  await page.waitForSelector('#form-auth [name="email"]');
  const isAppRoute = await page.evaluate(() => document.body.classList.contains('cubik-app-route'));
  if (isAppRoute) {
    await page.waitForFunction(
      (r) => {
        try {
          return sessionStorage.getItem('ut_auth_intent_role') === r;
        } catch (_) {
          return false;
        }
      },
      role
    );
  } else {
    await expectToggleRole(page, role);
  }
}

/** @param {import('@playwright/test').Page} page */
async function expectToggleRole(page, role) {
  const toggle = page.locator(`#auth-role-toggle [data-auth-toggle="${role}"]`);
  await toggle.waitFor({ state: 'visible' });
  await page.waitForFunction(
    (r) =>
      document.querySelector(`#auth-role-toggle [data-auth-toggle="${r}"]`)?.getAttribute(
        'aria-selected'
      ) === 'true',
    role
  );
}

/** @param {import('@playwright/test').Page} page */
async function expectAuthedApp(page) {
  await page.locator('#app-chrome').waitFor({ state: 'visible', timeout: 20_000 });
  await page.locator('#app-gate').waitFor({ state: 'hidden' });
  await page.locator('#app-view-home').waitFor({ state: 'visible' });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, role?: 'carrier'|'shipper' }} creds
 */
async function loginViaWelcome(page, { email, password, role = 'carrier' }) {
  await resetGuestAppSession(page);
  await openWelcomeRole(page, role);
  await page.fill('#form-auth [name="email"]', email);
  await page.fill('#form-auth [name="password"]', password);
  const loginWait = page.waitForResponse(
    (r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST'
  );
  await page.locator('#auth-submit').click();
  const loginRes = await loginWait;
  const loginJson = await loginRes.json();
  if (loginJson.need_otp) {
    await page.locator('#auth-otp-step').waitFor({ state: 'visible' });
    const code = loginJson.dev_code;
    if (!code) {
      throw new Error(
        'Login requiere OTP por dispositivo nuevo. En dev el API debe devolver dev_code o usar cuenta ya confiada.'
      );
    }
    const digits = String(code).replace(/\D/g, '').slice(0, 4);
    const inputs = page.locator('.auth-otp-digit');
    for (let i = 0; i < 4; i++) {
      await inputs.nth(i).fill(digits[i] || '');
    }
    const verifyWait = page.waitForResponse(
      (r) => r.url().includes('/api/auth/otp/verify') && r.request().method() === 'POST'
    );
    await page.locator('#auth-otp-submit').click();
    await verifyWait;
  }
  await expectAuthedApp(page);
}

/** @param {import('@playwright/test').Page} page @param {'carrier'|'shipper'} role */
async function loginAsMockUser(page, role = 'carrier') {
  await page.goto('/app', { waitUntil: 'load' });
  await page.waitForFunction(
    () => typeof Auth !== 'undefined' && typeof Auth.save === 'function'
  );
  await page.evaluate(
    ({ profiles, r }) => {
      const p = profiles[r];
      Auth.save('qa-e2e-mock-token', {
        id: `qa-mock-${r}`,
        email: `qa.${r}@cubik.test`,
        full_name: p.full_name,
        name: p.full_name,
        role: p.role,
        company_name: p.company_name,
        kyc_status: 'approved',
        is_available: true,
      });
    },
    { profiles: MOCK_PROFILES, r: role }
  );
  await expectAuthedApp(page);
}

/** @param {import('@playwright/test').Page} page @param {'home'|'options'|'activity'|'account'} tab */
async function tapAppTab(page, tab) {
  await page.locator(`.app-nav-item[data-app-tab="${tab}"]`).click();
  await page.waitForFunction((t) => document.body.dataset.appTab === t, tab);
}

/** @param {import('@playwright/test').Page} page @param {'board'|'carrier'|'shipper'|'trips'} action */
async function openDeepFromHome(page, action) {
  const quick = {
    board: '#app-quick-board',
    carrier: '#app-quick-carrier',
    shipper: '#app-quick-shipper',
    trips: '[data-app-quick="trips"]',
  };
  const selector = quick[action];
  await page.locator(selector).click();
  await page.waitForFunction(() => document.body.classList.contains('app-deep'));
}

/** @param {import('@playwright/test').Page} page */
async function expectBoardPanel(page) {
  await page.waitForFunction(() => document.body.classList.contains('app-main-visible'));
  const board = page.locator('#panel-board');
  await board.waitFor({ state: 'visible' });
  await expect(board.locator('h2').first()).toContainText(/emparej/i);
}

/** @param {import('@playwright/test').APIRequestContext} request */
async function seedDemoData(request) {
  const res = await request.post('/api/demo/seed', {
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-Seed-Key': process.env.DEMO_SEED_KEY || '',
    },
  });
  return res.json();
}

/** @param {import('@playwright/test').APIRequestContext} request */
async function healthSnapshot(request) {
  const res = await request.get('/health');
  return res.json();
}

function hasQaCarrierCreds() {
  return Boolean(process.env.QA_CARRIER_EMAIL && process.env.QA_CARRIER_PASSWORD);
}

function hasQaShipperCreds() {
  return Boolean(process.env.QA_SHIPPER_EMAIL && process.env.QA_SHIPPER_PASSWORD);
}

/**
 * Verifica que el logo tenga tinta visible en todo el alto (detecta PNG recortado / mal generado).
 * @param {import('@playwright/test').Page} page
 * @param {string} imgSelector
 */
async function expectLogoInkCoverage(page, imgSelector) {
  const result = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    if (!el || !(el instanceof HTMLImageElement)) {
      return { ok: false, reason: 'img not found' };
    }
    if (typeof el.decode === 'function') {
      try {
        await el.decode();
      } catch (_) {}
    }
    const w = el.naturalWidth || el.width || 168;
    const h = el.naturalHeight || el.height || 40;
    if (w < 8 || h < 8) {
      return { ok: false, reason: 'dimensions too small', w, h };
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reason: 'no canvas' };
    ctx.drawImage(el, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const bandHasInk = (y0, y1) => {
      for (let y = y0; y < y1; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 24) return true;
        }
      }
      return false;
    };
    const top = bandHasInk(0, Math.max(1, Math.floor(h * 0.22)));
    const mid = bandHasInk(Math.floor(h * 0.35), Math.floor(h * 0.65));
    const bottom = bandHasInk(Math.floor(h * 0.78), h);
    return { ok: top && mid && bottom, top, mid, bottom, w, h };
  }, imgSelector);

  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ img: string, container: string, srcPattern?: RegExp, minNaturalWidth?: number, minRenderedHeight?: number, checkInk?: boolean }} opts
 */
async function expectLogoFramed(page, opts) {
  const {
    img: imgSelector,
    container: containerSelector,
    srcPattern = /logo-cubik-nav/,
    minNaturalWidth = 140,
    minRenderedHeight = 26,
    checkInk = true,
  } = opts;

  const img = page.locator(imgSelector).first();
  await expect(img).toBeVisible();
  if (srcPattern) {
    await expect(img).toHaveAttribute('src', srcPattern);
  }

  const result = await page.evaluate(
    ({ imgSel, containerSel, minNatW, minRenderH }) => {
      const el = document.querySelector(imgSel);
      const container = document.querySelector(containerSel);
      if (!el || !(el instanceof HTMLImageElement)) {
        return { ok: false, reason: 'img not found' };
      }
      if (!container) {
        return { ok: false, reason: 'container not found' };
      }
      const ir = el.getBoundingClientRect();
      const cr = container.getBoundingClientRect();
      const tol = 2;
      const ratio = ir.width / Math.max(ir.height, 1);
      const clipped =
        ir.top < cr.top - tol ||
        ir.bottom > cr.bottom + tol ||
        ir.left < cr.left - tol ||
        ir.right > cr.right + tol;

      return {
        ok:
          el.complete &&
          el.naturalWidth >= minNatW &&
          ir.height >= minRenderH &&
          !clipped &&
          ratio >= 2.6 &&
          ratio <= 3.6,
        naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight,
        rendered: { w: ir.width, h: ir.height, top: ir.top, bottom: ir.bottom },
        container: { top: cr.top, bottom: cr.bottom },
        ratio,
        clipped,
        src: el.currentSrc || el.src,
      };
    },
    {
      imgSel: imgSelector,
      containerSel: containerSelector,
      minNatW: minNaturalWidth,
      minRenderH: minRenderedHeight,
    }
  );

  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
  if (checkInk) {
    await expectLogoInkCoverage(page, imgSelector);
  }
}

/** @param {import('@playwright/test').APIRequestContext} request @param {string} assetPath */
async function expectPngHasAlpha(request, assetPath) {
  const res = await request.get(assetPath);
  expect(res.ok()).toBeTruthy();
  const buf = Buffer.from(await res.body());
  expect(buf.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const colorType = buf[25];
  expect([4, 6]).toContain(colorType);
}

module.exports = {
  resetGuestAppSession,
  openWelcomeRole,
  expectLoginOpenForRole,
  expectToggleRole,
  expectAuthedApp,
  loginViaWelcome,
  loginAsMockUser,
  tapAppTab,
  openDeepFromHome,
  expectBoardPanel,
  seedDemoData,
  healthSnapshot,
  hasQaCarrierCreds,
  hasQaShipperCreds,
  expectLogoFramed,
  expectLogoInkCoverage,
  expectPngHasAlpha,
};
