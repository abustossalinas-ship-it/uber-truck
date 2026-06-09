// @ts-check

/** @param {import('@playwright/test').Page} page */
async function resetGuestAppSession(page) {
  await page.goto('/?app=1', { waitUntil: 'load' });
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

module.exports = { resetGuestAppSession, openWelcomeRole, expectLoginOpenForRole, expectToggleRole };
