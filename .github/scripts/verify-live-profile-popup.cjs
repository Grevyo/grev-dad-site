const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function mergedAssetsAreLive() {
  const token = Date.now();
  const [js, css] = await Promise.all([
    fetch(`${base}/profile-editor-unified.js?verify=${token}`).then(response => response.text()),
    fetch(`${base}/profile-editor-unified.css?verify=${token}`).then(response => response.text())
  ]);
  return js.includes('profile-unified-existing-tiles') &&
    js.includes("document.createElement('dialog')") &&
    css.includes('.profile-unified-editor::backdrop') &&
    css.includes('.profile-unified-existing-tile');
}

(async () => {
  let live = false;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await mergedAssetsAreLive()) {
      live = true;
      break;
    }
    await sleep(5000);
  }
  assert(live, 'Merged Profile popup assets did not appear on the real PBE domain.');
  checkpoint('merged assets live on PBE');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(25000);

  try {
    const login = await context.request.post(`${base}/api/auth/login`, {
      data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
    });
    assert(login.status() === 200, `PBE login failed (${login.status()}).`);
    const session = await context.request.get(`${base}/api/auth/session`);
    assert(session.status() === 200, `PBE session failed (${session.status()}).`);
    const profileId = (await session.json()).user?.id;
    assert(profileId, 'Authenticated PBE session had no profile ID.');

    const beforeResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    assert(beforeResponse.status() === 200, 'Profile API did not load before live verification.');
    const before = (await beforeResponse.json()).profile;
    const beforeSnapshot = JSON.stringify({
      card: before.card,
      cardTiles: before.cardTiles || [],
      design: before.design,
      preferences: before.preferences,
      tiles: before.tiles || []
    });
    checkpoint('PBE authenticated');

    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await page.locator('#customize-dashboard').click();
    const settingsButton = page.locator('.dashboard-tile-settings').first();
    await settingsButton.waitFor({ state: 'visible' });
    await settingsButton.click();
    const dashboardDialog = page.locator('#dashboard-tile-settings-dialog');
    await dashboardDialog.waitFor({ state: 'visible' });
    const dashboardBaseline = await dashboardDialog.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      return {
        native: dialog.tagName === 'DIALOG' && dialog.matches(':modal'),
        centred: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 4
      };
    });
    assert(dashboardBaseline.native && dashboardBaseline.centred, 'Dashboard tile-settings popup baseline failed.');
    await page.locator('#dashboard-close-tile-settings').click();
    await page.locator('#dashboard-cancel-layout').click();
    checkpoint('Dashboard popup baseline');

    const profileUrl = `${base}/profile/${encodeURIComponent(profileId)}`;
    await page.goto(profileUrl, { waitUntil: 'networkidle' });
    assert(await page.locator('script[src="/profile-editor-unified-a11y.js"]').count() === 1, 'Live Profile page is not loading the accessibility controller.');
    const shellBeforeMobile = await page.locator('.profile-shell').evaluate(shell => {
      const rect = shell.getBoundingClientRect();
      return { width: rect.width, left: rect.left };
    });

    await page.locator('#profile-edit').click();
    const popup = page.locator('#profile-unified-editor');
    await popup.waitFor({ state: 'visible' });
    const mobilePopup = await popup.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const shell = document.querySelector('.profile-shell').getBoundingClientRect();
      const close = dialog.querySelector('[data-unified-close]');
      const backdrop = getComputedStyle(dialog, '::backdrop');
      return {
        native: dialog.tagName === 'DIALOG' && dialog.matches(':modal'),
        centredX: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 4,
        centredY: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) < 8,
        bounded: rect.left >= 6 && rect.right <= innerWidth - 6,
        closeVisible: close && getComputedStyle(close).display !== 'none' && close.getBoundingClientRect().width > 0,
        backdropVisible: backdrop.backgroundColor !== 'rgba(0, 0, 0, 0)',
        shellWidth: shell.width,
        shellLeft: shell.left,
        bodyScrollable: dialog.querySelector('.profile-unified-body').scrollHeight > dialog.querySelector('.profile-unified-body').clientHeight
      };
    });
    assert(mobilePopup.native && mobilePopup.centredX && mobilePopup.centredY && mobilePopup.bounded, 'Live mobile Profile editor is not a centred native popup.');
    assert(mobilePopup.closeVisible && mobilePopup.backdropVisible, 'Live mobile popup is missing Close or backdrop.');
    assert(Math.abs(mobilePopup.shellWidth - shellBeforeMobile.width) < 2 && Math.abs(mobilePopup.shellLeft - shellBeforeMobile.left) < 2, 'Live mobile profile shifted behind the popup.');
    checkpoint('live mobile popup geometry');

    const tabs = popup.locator('.profile-unified-tabs [role="tab"]');
    assert(await tabs.count() === 4, 'Live popup does not expose four accessible tabs.');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    assert(await tabs.nth(1).getAttribute('aria-selected') === 'true', 'Live popup arrow-key tab navigation failed.');

    await popup.locator('.profile-unified-tabs [data-unified-tab="cardTiles"]').click();
    let cardSelector = popup.locator('[data-unified-existing-list="cardTiles"] .profile-unified-existing-tile').first();
    if (await cardSelector.count() === 0) {
      await popup.locator('[data-add-card-tile="custom"]').click();
      await popup.locator('#profile-card-tile-dialog[open]').waitFor({ state: 'visible' });
      await page.evaluate(() => document.querySelector('#profile-card-tile-dialog')?.close());
      cardSelector = popup.locator('[data-unified-existing-list="cardTiles"] .profile-unified-existing-tile').first();
      await cardSelector.waitFor({ state: 'visible' });
    }
    await cardSelector.click();
    await popup.locator('#profile-card-tile-dialog[open]').waitFor({ state: 'visible' });
    await page.evaluate(() => document.querySelector('#profile-card-tile-dialog')?.close());

    await popup.locator('.profile-unified-tabs [data-unified-tab="profileTiles"]').click();
    let profileSelector = popup.locator('[data-unified-existing-list="profileTiles"] .profile-unified-existing-tile').first();
    if (await profileSelector.count() === 0) {
      await popup.locator('[data-add-profile-tile="text"]').click();
      await popup.locator('#profile-tile-dialog[open]').waitFor({ state: 'visible' });
      await page.evaluate(() => document.querySelector('#profile-tile-dialog')?.close());
      profileSelector = popup.locator('[data-unified-existing-list="profileTiles"] .profile-unified-existing-tile').first();
      await profileSelector.waitFor({ state: 'visible' });
    }
    await profileSelector.click();
    await popup.locator('#profile-tile-dialog[open]').waitFor({ state: 'visible' });
    await page.evaluate(() => document.querySelector('#profile-tile-dialog')?.close());
    checkpoint('live existing tile selectors');

    await popup.locator('.profile-unified-tabs [data-unified-tab="card"]').click();
    await popup.locator('#profile-card-website').fill('not-a-valid-url');
    await popup.locator('#profile-save').click();
    const message = popup.locator('#profile-editor-message');
    await message.waitFor({ state: 'visible' });
    assert((await message.textContent() || '').trim().length > 0, 'Live popup validation feedback was empty.');
    assert(await popup.locator('.profile-unified-footer #profile-editor-message').count() === 1, 'Live validation feedback is not beside Save.');

    await popup.locator('#profile-cancel').click();
    await popup.waitFor({ state: 'hidden' });
    await page.locator('#profile-edit').click();
    await popup.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await popup.waitFor({ state: 'hidden' });
    checkpoint('live validation, Cancel and Escape');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: 'networkidle' });
    const shellBeforeDesktop = await page.locator('.profile-shell').evaluate(shell => {
      const rect = shell.getBoundingClientRect();
      return { width: rect.width, left: rect.left };
    });
    await page.locator('#profile-edit').click();
    await popup.waitFor({ state: 'visible' });
    const desktopPopup = await popup.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const shell = document.querySelector('.profile-shell').getBoundingClientRect();
      return {
        native: dialog.matches(':modal'),
        centredX: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 4,
        centredY: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) < 4,
        width: rect.width,
        shellWidth: shell.width,
        shellLeft: shell.left
      };
    });
    assert(desktopPopup.native && desktopPopup.centredX && desktopPopup.centredY && desktopPopup.width <= 922, 'Live desktop Profile editor behaves like a sidebar rather than a popup.');
    assert(Math.abs(desktopPopup.shellWidth - shellBeforeDesktop.width) < 2 && Math.abs(desktopPopup.shellLeft - shellBeforeDesktop.left) < 2, 'Live desktop profile shifted behind the popup.');
    await popup.locator('#profile-cancel').click();

    const after = (await (await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`)).json()).profile;
    const afterSnapshot = JSON.stringify({
      card: after.card,
      cardTiles: after.cardTiles || [],
      design: after.design,
      preferences: after.preferences,
      tiles: after.tiles || []
    });
    assert(afterSnapshot === beforeSnapshot, 'Live Profile popup verification changed saved profile data.');
    checkpoint('live desktop popup and exact restoration');

    console.log('Live PBE Profile popup verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
