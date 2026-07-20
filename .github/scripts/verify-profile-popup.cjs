const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const rawBase = 'https://raw.githubusercontent.com/Grevyo/grev-dad-site/agent/profile-editor-native-popup/public';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Unable to fetch ${url} (${response.status}).`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const [unifiedCss, unifiedJs, unifiedA11y] = await Promise.all([
    fetchText(`${rawBase}/profile-editor-unified.css`),
    fetchText(`${rawBase}/profile-editor-unified.js`),
    fetchText(`${rawBase}/profile-editor-unified-a11y.js`)
  ]);
  checkpoint('branch popup assets fetched');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(20000);

  try {
    const login = await context.request.post(`${base}/api/auth/login`, {
      data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false },
      timeout: 15000
    });
    assert(login.status() === 200, `PBE login failed (${login.status()}).`);
    const session = await context.request.get(`${base}/api/auth/session`, { timeout: 15000 });
    assert(session.status() === 200, `PBE session failed (${session.status()}).`);
    const profileId = (await session.json()).user?.id;
    assert(profileId, 'Authenticated session had no user ID.');
    checkpoint('PBE authenticated');

    const beforeResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    assert(beforeResponse.status() === 200, 'Profile API did not load before verification.');
    const before = (await beforeResponse.json()).profile;
    const beforeSnapshot = JSON.stringify({
      card: before.card,
      cardTiles: before.cardTiles || [],
      design: before.design,
      preferences: before.preferences,
      tiles: before.tiles || []
    });

    await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await page.locator('#customize-dashboard').click();
    const tileSettings = page.locator('.dashboard-tile-settings').first();
    await tileSettings.waitFor({ state: 'visible' });
    await tileSettings.click();
    const dashboardDialog = page.locator('#dashboard-tile-settings-dialog');
    await dashboardDialog.waitFor({ state: 'visible' });
    const dashboardPopup = await dashboardDialog.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const backdrop = getComputedStyle(dialog, '::backdrop');
      return {
        tag: dialog.tagName,
        open: dialog.open,
        modal: dialog.matches(':modal'),
        position: getComputedStyle(dialog).position,
        centredX: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 4,
        backdrop: backdrop.backgroundColor,
        blur: backdrop.backdropFilter
      };
    });
    assert(dashboardPopup.tag === 'DIALOG' && dashboardPopup.open && dashboardPopup.modal, 'Dashboard tile editor baseline is not a native modal dialog.');
    assert(dashboardPopup.centredX, 'Dashboard tile editor baseline is not centred.');
    await page.locator('#dashboard-close-tile-settings').click();
    await page.locator('#dashboard-cancel-layout').click();
    checkpoint('dashboard popup baseline');

    await page.route('**/profile-editor-unified.css', route => route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      headers: { 'cache-control': 'no-store' },
      body: unifiedCss
    }));
    await page.route('**/profile-editor-unified.js', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      headers: { 'cache-control': 'no-store' },
      body: unifiedJs
    }));
    await page.route('**/profile-editor-unified-a11y.js', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      headers: { 'cache-control': 'no-store' },
      body: unifiedA11y
    }));

    await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    const shellBeforeMobile = await page.locator('.profile-shell').evaluate(shell => {
      const rect = shell.getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    });
    await page.locator('#profile-edit').click();
    const profileDialog = page.locator('#profile-unified-editor');
    await profileDialog.waitFor({ state: 'visible' });

    const mobilePopup = await profileDialog.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const body = dialog.querySelector('.profile-unified-body');
      const header = dialog.querySelector('.profile-unified-header');
      const footer = dialog.querySelector('.profile-unified-footer');
      const backdrop = getComputedStyle(dialog, '::backdrop');
      const shellRect = document.querySelector('.profile-shell').getBoundingClientRect();
      return {
        tag: dialog.tagName,
        open: dialog.open,
        modal: dialog.matches(':modal'),
        position: getComputedStyle(dialog).position,
        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        centredX: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 4,
        centredY: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) < 8,
        hasBackdrop: backdrop.backgroundColor !== 'rgba(0, 0, 0, 0)',
        bodyScrollable: body.scrollHeight > body.clientHeight,
        headerVisible: header.getBoundingClientRect().top >= rect.top - 1,
        footerVisible: footer.getBoundingClientRect().bottom <= rect.bottom + 1,
        shellLeft: shellRect.left,
        shellWidth: shellRect.width,
        toolbarVisible: getComputedStyle(document.querySelector('#profile-editor-toolbar')).display !== 'none'
      };
    });
    assert(mobilePopup.tag === 'DIALOG' && mobilePopup.open && mobilePopup.modal, 'Mobile Profile editor is not a native modal dialog.');
    assert(mobilePopup.centredX && mobilePopup.centredY, 'Mobile Profile popup is not centred.');
    assert(mobilePopup.rect.left >= 6 && mobilePopup.rect.right <= 384, 'Mobile Profile popup is not bounded inside the viewport.');
    assert(mobilePopup.hasBackdrop, 'Mobile Profile popup has no modal backdrop.');
    assert(!mobilePopup.toolbarVisible, 'Old page editing toolbar is still visible behind the popup.');
    assert(Math.abs(mobilePopup.shellLeft - shellBeforeMobile.left) < 2 && Math.abs(mobilePopup.shellWidth - shellBeforeMobile.width) < 2, 'Mobile profile page shifted or resized when the popup opened.');
    assert(mobilePopup.headerVisible && mobilePopup.footerVisible, 'Mobile popup header or footer is outside the modal.');
    checkpoint('mobile native popup geometry');

    for (const tab of ['card', 'cardTiles', 'page', 'profileTiles']) {
      const button = profileDialog.locator(`.profile-unified-tabs [data-unified-tab="${tab}"]`);
      await button.click();
      assert(await profileDialog.locator(`[data-unified-section="${tab}"]`).isVisible(), `${tab} popup section did not open.`);
      assert(await button.getAttribute('aria-selected') === 'true', `${tab} popup tab did not expose selected state.`);
    }
    checkpoint('all popup sections');

    await profileDialog.locator('.profile-unified-tabs [data-unified-tab="card"]').click();
    const bodyScroll = await profileDialog.locator('.profile-unified-body').evaluate(body => {
      const before = body.scrollTop;
      body.scrollTop = body.scrollHeight;
      return { before, after: body.scrollTop, maximum: body.scrollHeight - body.clientHeight };
    });
    const fixedChrome = await profileDialog.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const header = dialog.querySelector('.profile-unified-header').getBoundingClientRect();
      const footer = dialog.querySelector('.profile-unified-footer').getBoundingClientRect();
      return { headerTop: header.top, footerBottom: footer.bottom, dialogTop: rect.top, dialogBottom: rect.bottom };
    });
    if (bodyScroll.maximum > 0) assert(bodyScroll.after > 0, 'Popup body did not scroll internally.');
    assert(fixedChrome.headerTop >= fixedChrome.dialogTop - 1 && fixedChrome.footerBottom <= fixedChrome.dialogBottom + 1, 'Popup header/footer moved outside the dialog while content scrolled.');
    checkpoint('popup-only scrolling');

    const websiteInput = profileDialog.locator('#profile-card-website');
    await websiteInput.fill('not-a-valid-url');
    await profileDialog.locator('[data-unified-save]').click();
    const message = profileDialog.locator('#profile-editor-message');
    await message.waitFor({ state: 'visible' });
    const messageText = (await message.textContent() || '').trim();
    assert(messageText.length > 0, 'Save validation produced no visible popup feedback.');
    assert(await profileDialog.locator('.profile-unified-footer #profile-editor-message').count() === 1, 'Save validation feedback is not beside the popup Save controls.');
    checkpoint('popup validation feedback');

    await profileDialog.locator('[data-unified-cancel]').click();
    await profileDialog.waitFor({ state: 'hidden' });
    assert(await page.locator('#profile-edit').isVisible(), 'Edit profile did not return after popup Cancel.');
    assert(!await page.evaluate(() => document.body.classList.contains('profile-unified-editing')), 'Popup editing body state remained after Cancel.');

    await page.locator('#profile-edit').click();
    await profileDialog.waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await profileDialog.waitFor({ state: 'hidden' });
    assert(await page.locator('#profile-edit').isVisible(), 'Escape did not cancel and close the Profile popup.');
    checkpoint('popup cancel and Escape');

    const afterResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    assert(afterResponse.status() === 200, 'Profile API did not reload after popup cancellation.');
    const after = (await afterResponse.json()).profile;
    const afterSnapshot = JSON.stringify({
      card: after.card,
      cardTiles: after.cardTiles || [],
      design: after.design,
      preferences: after.preferences,
      tiles: after.tiles || []
    });
    assert(afterSnapshot === beforeSnapshot, 'Popup verification changed saved profile data.');

    await page.setViewportSize({ width: 1200, height: 850 });
    await page.reload({ waitUntil: 'networkidle' });
    const shellBeforeDesktop = await page.locator('.profile-shell').evaluate(shell => {
      const rect = shell.getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    });
    await page.locator('#profile-edit').click();
    await profileDialog.waitFor({ state: 'visible' });
    const desktopPopup = await profileDialog.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const shellRect = document.querySelector('.profile-shell').getBoundingClientRect();
      return {
        modal: dialog.matches(':modal'),
        centredX: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 4,
        centredY: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) < 4,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        shellLeft: shellRect.left,
        shellWidth: shellRect.width
      };
    });
    assert(desktopPopup.modal && desktopPopup.centredX && desktopPopup.centredY, 'Desktop Profile editor is not a centred modal popup.');
    assert(desktopPopup.left > 100 && desktopPopup.right < 1100 && desktopPopup.width <= 922, 'Desktop Profile popup behaves like a sidebar or full-width panel.');
    assert(Math.abs(desktopPopup.shellLeft - shellBeforeDesktop.left) < 2 && Math.abs(desktopPopup.shellWidth - shellBeforeDesktop.width) < 2, 'Desktop profile page shifted or resized when the popup opened.');
    await profileDialog.locator('[data-unified-cancel]').click();
    checkpoint('desktop native popup geometry');

    console.log('Profile native-popup verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
