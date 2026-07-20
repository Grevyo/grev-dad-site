const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.setDefaultNavigationTimeout(25_000);

  try {
    let profileId = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const login = await context.request.post(`${base}/api/auth/login`, {
        data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false },
        timeout: 10_000
      });
      if (login.status() === 200) {
        const session = await context.request.get(`${base}/api/auth/session`, { timeout: 10_000 });
        if (session.status() === 200) {
          const payload = await session.json();
          profileId = payload.user?.id || null;
          if (profileId) break;
        }
      }
      await sleep(3000);
    }
    assert(profileId, 'Could not authenticate against PBE.');
    checkpoint('PBE authenticated');

    let deployed = false;
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const html = await context.request.get(`${base}/profile/${encodeURIComponent(profileId)}?verify=${Date.now()}`, { timeout: 10_000 });
      const css = await context.request.get(`${base}/profile-editor-unified.css?verify=${Date.now()}`, { timeout: 10_000 });
      if (html.status() === 200 && css.status() === 200) {
        const htmlText = await html.text();
        const cssText = await css.text();
        const toolbarIndex = htmlText.indexOf('id="profile-editor-toolbar"');
        const cardIndex = htmlText.indexOf('id="profile-card"');
        deployed = toolbarIndex >= 0 && cardIndex > toolbarIndex && cssText.includes('.profile-editor-actions #profile-design-settings{display:none!important}');
        if (deployed) break;
      }
      await sleep(5000);
    }
    assert(deployed, 'Merged mobile profile editor assets did not reach PBE.');
    checkpoint('merged assets deployed');

    const beforeResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`, { timeout: 10_000 });
    assert(beforeResponse.status() === 200, 'Profile API did not load.');
    const before = (await beforeResponse.json()).profile;
    const snapshot = profile => JSON.stringify({
      card: profile.card,
      cardTiles: profile.cardTiles || [],
      design: profile.design,
      preferences: profile.preferences,
      tiles: profile.tiles || []
    });
    const beforeSnapshot = snapshot(before);

    const dashboardResponse = await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    assert(dashboardResponse?.status() === 200, 'Dashboard did not load.');
    await page.locator('#customize-dashboard').click();
    assert(await page.locator('#dashboard-editor-toolbar').isVisible(), 'Dashboard editor toolbar did not open inline.');
    const dashboardInline = await page.evaluate(() => ({
      bodyFixed: getComputedStyle(document.body).position === 'fixed',
      toolbarBeforeGrid: Boolean(document.querySelector('#dashboard-editor-toolbar')?.compareDocumentPosition(document.querySelector('#dashboard-grid')) & Node.DOCUMENT_POSITION_FOLLOWING)
    }));
    assert(!dashboardInline.bodyFixed && dashboardInline.toolbarBeforeGrid, 'Dashboard baseline is not inline editing.');
    await page.locator('#dashboard-cancel-layout').click();
    checkpoint('dashboard inline baseline');

    const profileResponse = await page.goto(`${base}/profile/${encodeURIComponent(profileId)}?verify=${Date.now()}`, { waitUntil: 'networkidle' });
    assert(profileResponse?.status() === 200, 'Profile page did not load.');
    await page.locator('#profile-edit').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'visible' });

    const flow = await page.evaluate(() => {
      const toolbar = document.querySelector('#profile-editor-toolbar');
      const panel = document.querySelector('#profile-unified-editor');
      const card = document.querySelector('#profile-card');
      const message = document.querySelector('#profile-editor-message');
      return {
        bodyFixed: getComputedStyle(document.body).position === 'fixed',
        bodyLocked: document.body.classList.contains('profile-mobile-editor-scroll-locked'),
        panelPosition: getComputedStyle(panel).position,
        toolbarVisible: getComputedStyle(toolbar).display !== 'none',
        toolbarBeforePanel: Boolean(toolbar.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING),
        panelBeforeCard: Boolean(panel.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING),
        messageInToolbar: message?.parentElement === toolbar,
        visibleActions: [...toolbar.querySelectorAll('.profile-editor-actions button')].filter(button => getComputedStyle(button).display !== 'none').map(button => button.id),
        pageScrollable: document.documentElement.scrollHeight > innerHeight
      };
    });
    assert(!flow.bodyFixed && !flow.bodyLocked, 'Profile editor still locks the mobile page.');
    assert(flow.panelPosition === 'static' && flow.toolbarVisible, 'Profile controls are not inline on mobile.');
    assert(flow.toolbarBeforePanel && flow.panelBeforeCard, 'Profile order is not toolbar, controls, live preview.');
    assert(flow.messageInToolbar, 'Profile feedback is not beside the mobile toolbar.');
    assert(flow.pageScrollable, 'Profile editor does not use normal page scrolling.');
    assert(JSON.stringify(flow.visibleActions) === JSON.stringify(['profile-card-settings', 'profile-pack', 'profile-cancel', 'profile-save']), `Unexpected mobile toolbar actions: ${flow.visibleActions.join(', ')}`);
    assert(await page.locator('[data-unified-preview]').isHidden(), 'Old mobile Preview button is still visible.');
    checkpoint('live inline profile structure');

    for (const tab of ['card', 'cardTiles', 'page', 'profileTiles']) {
      const button = page.locator(`.profile-unified-tabs button[data-unified-tab="${tab}"]`);
      await button.click();
      assert(await page.locator(`[data-unified-section="${tab}"]`).isVisible(), `${tab} section did not open.`);
      assert(await button.getAttribute('aria-selected') === 'true', `${tab} tab is missing selected state.`);
    }
    checkpoint('all live profile sections');

    await page.locator('.profile-unified-tabs button[data-unified-tab="card"]').click();
    await page.locator('#profile-card-display-name').focus();
    await page.setViewportSize({ width: 390, height: 520 });
    await sleep(180);
    const focus = await page.evaluate(() => ({
      bodyFixed: getComputedStyle(document.body).position === 'fixed',
      bodyLocked: document.body.classList.contains('profile-mobile-editor-scroll-locked'),
      focusedInside: Boolean(document.querySelector('#profile-unified-editor')?.contains(document.activeElement))
    }));
    assert(!focus.bodyFixed && !focus.bodyLocked && focus.focusedInside, 'Focused input does not behave with normal mobile scrolling.');
    checkpoint('live focused input scrolling');

    await page.locator('#profile-card-website').fill('invalid-url');
    await page.locator('#profile-save').click();
    const feedback = page.locator('#profile-editor-message');
    assert(await feedback.isVisible(), 'Save validation feedback is not visible.');
    const feedbackState = await feedback.evaluate(element => ({
      parent: element.parentElement?.id || '',
      error: element.classList.contains('error'),
      text: element.textContent || ''
    }));
    assert(feedbackState.parent === 'profile-editor-toolbar' && feedbackState.error && /http:\/\//i.test(feedbackState.text), 'Save validation feedback is not clear beside Save.');
    assert(await page.locator('#profile-unified-editor').isVisible(), 'Invalid Save closed the editor.');
    checkpoint('live save validation feedback');

    await page.locator('#profile-cancel').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'hidden' });
    assert(await page.locator('#profile-editor-toolbar').isHidden(), 'Profile toolbar remained visible after Cancel.');
    assert(!await page.evaluate(() => document.body.classList.contains('profile-unified-editing')), 'Editing class remained after Cancel.');
    const afterResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`, { timeout: 10_000 });
    assert(afterResponse.status() === 200 && snapshot((await afterResponse.json()).profile) === beforeSnapshot, 'Cancel changed saved profile data.');
    checkpoint('live cancel restoration');

    await page.setViewportSize({ width: 1200, height: 850 });
    await sleep(120);
    await page.locator('#profile-edit').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'visible' });
    const desktop = await page.evaluate(() => ({
      panelFixed: getComputedStyle(document.querySelector('#profile-unified-editor')).position === 'fixed',
      toolbarHidden: getComputedStyle(document.querySelector('#profile-editor-toolbar')).display === 'none',
      messageInPanel: Boolean(document.querySelector('[data-unified-message-slot]')?.contains(document.querySelector('#profile-editor-message')))
    }));
    assert(desktop.panelFixed && desktop.toolbarHidden && desktop.messageInPanel, 'Desktop side editor was not preserved.');
    await page.locator('[data-unified-cancel]').click();
    checkpoint('live desktop side editor preserved');

    console.log('Live mobile profile dashboard-flow verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
