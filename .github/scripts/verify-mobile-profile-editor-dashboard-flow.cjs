const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const rawBase = 'https://raw.githubusercontent.com/Grevyo/grev-dad-site/agent/match-mobile-profile-editor-to-dashboard/public';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to fetch branch asset ${url} (${response.status}).`);
  return response.text();
}

(async () => {
  const [profileHtml, unifiedCss, unifiedJs, unifiedA11y] = await Promise.all([
    fetchText(`${rawBase}/profile.html`),
    fetchText(`${rawBase}/profile-editor-unified.css`),
    fetchText(`${rawBase}/profile-editor-unified.js`),
    fetchText(`${rawBase}/profile-editor-unified-a11y.js`)
  ]);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(20_000);
  try {
    let profileId = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const login = await context.request.post(`${base}/api/auth/login`, {
        data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
      });
      if (login.status() === 200) {
        const session = await context.request.get(`${base}/api/auth/session`);
        if (session.status() === 200) {
          const payload = await session.json();
          profileId = payload.user?.id || null;
          if (profileId) break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    assert(profileId, 'Could not create a valid PBE session.');
    checkpoint('PBE authenticated');

    const beforeResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    assert(beforeResponse.status() === 200, 'Profile API did not load.');
    const before = (await beforeResponse.json()).profile;
    const beforeSnapshot = JSON.stringify({
      card: before.card,
      cardTiles: before.cardTiles || [],
      design: before.design,
      preferences: before.preferences,
      tiles: before.tiles || []
    });

    const dashboardResponse = await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    assert(dashboardResponse?.status() === 200, 'Dashboard did not load.');
    checkpoint('dashboard loaded');
    await page.locator('#customize-dashboard').click();
    assert(await page.locator('#dashboard-editor-toolbar').isVisible(), 'Dashboard editor toolbar did not open inline.');
    const dashboardFlow = await page.evaluate(() => ({
      bodyPosition: getComputedStyle(document.body).position,
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      toolbarBeforeGrid: Boolean(document.querySelector('#dashboard-editor-toolbar')?.compareDocumentPosition(document.querySelector('#dashboard-grid')) & Node.DOCUMENT_POSITION_FOLLOWING)
    }));
    assert(dashboardFlow.bodyPosition !== 'fixed', 'Dashboard editing unexpectedly fixes the page body.');
    assert(dashboardFlow.toolbarBeforeGrid, 'Dashboard toolbar is not before the live grid.');
    await page.locator('#dashboard-cancel-layout').click();
    checkpoint('dashboard inline editing baseline');

    await page.route('**/profile/**', async route => {
      if (route.request().resourceType() !== 'document') return route.continue();
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        headers: { 'cache-control': 'no-store' },
        body: profileHtml
      });
    });
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
      body: `${unifiedJs}\n${unifiedA11y}`
    }));

    const profileResponse = await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    assert(profileResponse?.status() === 200, 'Profile page did not load.');
    checkpoint('branch profile UI loaded over PBE');
    const initialOrder = await page.evaluate(() => {
      const toolbar = document.querySelector('#profile-editor-toolbar');
      const card = document.querySelector('#profile-card');
      return Boolean(toolbar && card && (toolbar.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    assert(initialOrder, 'Profile editor toolbar is not before the live profile card.');

    await page.locator('#profile-edit').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'visible' });
    assert(await page.locator('#profile-editor-toolbar').isVisible(), 'Mobile profile toolbar is hidden.');
    assert(await page.locator('[data-unified-preview]').isHidden(), 'Old mobile Preview/collapse button is still visible.');
    assert(await page.locator('.profile-unified-save-actions').isHidden(), 'Duplicate panel Save/Cancel actions are visible on mobile.');

    const profileFlow = await page.evaluate(() => {
      const toolbar = document.querySelector('#profile-editor-toolbar');
      const panel = document.querySelector('#profile-unified-editor');
      const card = document.querySelector('#profile-card');
      const message = document.querySelector('#profile-editor-message');
      const panelStyle = getComputedStyle(panel);
      const bodyStyle = getComputedStyle(document.body);
      return {
        bodyPosition: bodyStyle.position,
        bodyOverflowY: bodyStyle.overflowY,
        lockedClass: document.body.classList.contains('profile-mobile-editor-scroll-locked'),
        panelPosition: panelStyle.position,
        panelHeight: panel.getBoundingClientRect().height,
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
        toolbarBeforePanel: Boolean(toolbar.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING),
        panelBeforeCard: Boolean(panel.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING),
        messageInToolbar: message?.parentElement === toolbar,
        actionCount: [...toolbar.querySelectorAll('.profile-editor-actions button')].filter(button => getComputedStyle(button).display !== 'none').length
      };
    });
    assert(profileFlow.bodyPosition !== 'fixed', 'Profile editing still fixes the mobile page body.');
    assert(!profileFlow.lockedClass, 'Profile editing still applies the old mobile scroll lock.');
    assert(profileFlow.panelPosition === 'static', 'Profile controls are not inline on mobile.');
    assert(profileFlow.toolbarBeforePanel && profileFlow.panelBeforeCard, 'Mobile editor order is not toolbar, controls, live preview.');
    assert(profileFlow.pageHeight > profileFlow.viewportHeight, 'Mobile profile editor does not use normal page scrolling.');
    assert(profileFlow.actionCount === 4, 'The dashboard-style profile toolbar actions are incomplete.');
    assert(profileFlow.messageInToolbar, 'Profile editor feedback is not beside the mobile toolbar actions.');
    checkpoint('profile inline editing structure');

    const tabs = ['card', 'cardTiles', 'page', 'profileTiles'];
    for (const tab of tabs) {
      await page.locator(`[data-unified-tab="${tab}"]`).click();
      assert(await page.locator(`[data-unified-section="${tab}"]`).isVisible(), `${tab} section did not become visible.`);
      const selected = await page.locator(`[data-unified-tab="${tab}"]`).getAttribute('aria-selected');
      assert(selected === 'true', `${tab} tab did not expose its selected state.`);
    }
    checkpoint('all mobile profile sections');

    await page.locator('[data-unified-tab="card"]').click();
    const nameInput = page.locator('#profile-card-display-name');
    await nameInput.focus();
    await page.setViewportSize({ width: 390, height: 520 });
    await page.waitForTimeout(150);
    const focusFlow = await page.evaluate(() => ({
      bodyPosition: getComputedStyle(document.body).position,
      bodyLocked: document.body.classList.contains('profile-mobile-editor-scroll-locked'),
      activeInsideEditor: Boolean(document.querySelector('#profile-unified-editor')?.contains(document.activeElement)),
      scrollY: window.scrollY
    }));
    assert(focusFlow.bodyPosition !== 'fixed' && !focusFlow.bodyLocked, 'Keyboard-sized viewport reintroduced the old page lock.');
    assert(focusFlow.activeInsideEditor, 'Focused profile control was lost after the viewport changed.');
    checkpoint('normal page scrolling with focused input');

    await page.locator('#profile-card-website').fill('invalid-url');
    await page.locator('#profile-save').click();
    const feedback = page.locator('#profile-editor-message');
    assert(await feedback.isVisible(), 'Validation feedback is not visible beside Save.');
    const feedbackState = await feedback.evaluate(element => ({
      parentId: element.parentElement?.id || '',
      text: element.textContent || '',
      isError: element.classList.contains('error')
    }));
    assert(feedbackState.parentId === 'profile-editor-toolbar', 'Validation feedback moved away from the mobile toolbar.');
    assert(feedbackState.isError && /http:\/\//i.test(feedbackState.text), 'Invalid website feedback was not shown clearly.');
    assert(await page.locator('#profile-unified-editor').isVisible(), 'Invalid Save unexpectedly closed the editor.');
    checkpoint('visible save validation feedback');

    await page.locator('#profile-cancel').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'hidden' });
    assert(await page.locator('#profile-edit').isVisible(), 'Edit profile button did not return after Cancel.');
    assert(await page.locator('#profile-editor-toolbar').isHidden(), 'Profile editor toolbar remained visible after Cancel.');
    assert(!await page.evaluate(() => document.body.classList.contains('profile-unified-editing')), 'Editing body class remained after Cancel.');

    const afterResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    assert(afterResponse.status() === 200, 'Profile API did not reload after Cancel.');
    const after = (await afterResponse.json()).profile;
    const afterSnapshot = JSON.stringify({
      card: after.card,
      cardTiles: after.cardTiles || [],
      design: after.design,
      preferences: after.preferences,
      tiles: after.tiles || []
    });
    assert(afterSnapshot === beforeSnapshot, 'Mobile flow verification changed saved profile data.');
    checkpoint('cancel restoration');

    await page.setViewportSize({ width: 1200, height: 850 });
    await page.waitForTimeout(100);
    await page.locator('#profile-edit').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'visible' });
    const desktopFlow = await page.evaluate(() => ({
      panelPosition: getComputedStyle(document.querySelector('#profile-unified-editor')).position,
      toolbarVisible: getComputedStyle(document.querySelector('#profile-editor-toolbar')).display !== 'none',
      messageInPanel: Boolean(document.querySelector('[data-unified-message-slot]')?.contains(document.querySelector('#profile-editor-message'))),
      shellMarginRight: getComputedStyle(document.querySelector('.profile-shell')).marginRight
    }));
    assert(desktopFlow.panelPosition === 'fixed', 'Desktop profile side editor is no longer fixed.');
    assert(!desktopFlow.toolbarVisible, 'Desktop now shows the duplicate inline toolbar.');
    assert(desktopFlow.messageInPanel, 'Desktop editor feedback did not return to the side panel.');
    await page.locator('[data-unified-cancel]').click();
    checkpoint('desktop side editor preserved');

    console.log('Mobile profile editor dashboard-flow verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
