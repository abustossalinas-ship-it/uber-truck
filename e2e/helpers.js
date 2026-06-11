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
  await expectToggleRole(page, role);
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
  await page.locator('#auth-submit').click();
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
};
