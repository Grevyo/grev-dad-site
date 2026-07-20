const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3
  });
  const page = await context.newPage();
  try {
    let profileId = null;
    for (let attempt = 0; attempt < 24; attempt += 1) {
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
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    assert(profileId, 'Could not authenticate against PBE.');

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

    const response = await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    assert(response?.status() === 200, 'Profile page did not load.');
    assert(await page.locator('link[href="/profile-editor-unified.css"]').count() === 1, 'Unified editor stylesheet is not deployed.');
    assert(await page.locator('script[src="/profile-editor-unified-a11y.js"]').count() === 1, 'Unified editor mobile controller is not deployed.');

    await page.evaluate(() => window.scrollTo(0, Math.min(320, document.documentElement.scrollHeight - innerHeight)));
    const pageScrollBefore = await page.evaluate(() => window.scrollY);
    await page.locator('#profile-edit').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'visible' });

    assert(await page.locator('body.profile-mobile-editor-scroll-locked').count() === 1, 'Expanded mobile editor did not lock the background page.');
    const lockedStyles = await page.locator('body').evaluate(body => ({ position: body.style.position, overflow: body.style.overflow, top: body.style.top }));
    assert(lockedStyles.position === 'fixed' && lockedStyles.overflow === 'hidden', 'Background lock styles were not applied.');
    assert(lockedStyles.top === `-${pageScrollBefore}px`, 'Background scroll position was not preserved in the lock.');

    const metrics = await page.locator('#profile-unified-editor').evaluate(editor => {
      const scroller = editor.querySelector('.profile-unified-body');
      const panel = editor.getBoundingClientRect();
      const styles = getComputedStyle(scroller);
      return {
        panelBottom: Math.round(panel.bottom),
        viewportHeight: innerHeight,
        overflowY: styles.overflowY,
        touchAction: styles.touchAction,
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight
      };
    });
    assert(metrics.panelBottom <= metrics.viewportHeight + 1, 'Editor extends below the visible mobile viewport.');
    assert(metrics.overflowY === 'auto' && metrics.touchAction === 'pan-y', 'Editor controls are not configured as the touch scroll container.');
    assert(metrics.scrollHeight > metrics.clientHeight, 'Editor body is not scrollable on the live profile.');

    const scroller = page.locator('.profile-unified-body');
    await scroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const bottom = await scroller.evaluate(element => ({ top: element.scrollTop, max: element.scrollHeight - element.clientHeight }));
    assert(bottom.max > 0 && Math.abs(bottom.top - bottom.max) < 3, 'Editor body could not scroll to its final controls.');
    assert(await page.evaluate(() => window.scrollY) === 0, 'The page underneath moved while the editor body scrolled.');
    checkpoint('live independent mobile scrolling');

    await page.locator('[data-unified-tab="page"]').click();
    await scroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
    const lastControl = page.locator('#profile-unified-panel-page input, #profile-unified-panel-page textarea, #profile-unified-panel-page select').last();
    await lastControl.focus();
    await page.setViewportSize({ width: 390, height: 520 });
    await page.waitForTimeout(180);
    const focus = await page.evaluate(() => {
      const editor = document.querySelector('#profile-unified-editor');
      const scroller = editor.querySelector('.profile-unified-body');
      const control = document.activeElement;
      const panelRect = editor.getBoundingClientRect();
      const bodyRect = scroller.getBoundingClientRect();
      const controlRect = control.getBoundingClientRect();
      return {
        visibleHeight: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--profile-visible-height')),
        bottomOffset: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--profile-editor-bottom-offset')),
        panelBottom: panelRect.bottom,
        viewportHeight: innerHeight,
        bodyTop: bodyRect.top,
        bodyBottom: bodyRect.bottom,
        controlTop: controlRect.top,
        controlBottom: controlRect.bottom
      };
    });
    assert(focus.visibleHeight <= 520, 'Visible viewport height was not refreshed.');
    assert(focus.panelBottom <= focus.viewportHeight + 1, 'Editor was not kept inside the reduced viewport.');
    assert(focus.controlTop >= focus.bodyTop - 1 && focus.controlBottom <= focus.bodyBottom + 1, 'Focused control was left outside the visible editor body.');
    checkpoint('live reduced viewport and focus visibility');

    await page.locator('[data-unified-preview]').click();
    assert(await page.locator('#profile-unified-editor.is-collapsed').count() === 1, 'Preview did not collapse the mobile editor.');
    assert(await page.locator('body.profile-mobile-editor-scroll-locked').count() === 0, 'Preview did not release the background page.');
    const restored = await page.evaluate(() => window.scrollY);
    assert(Math.abs(restored - pageScrollBefore) < 3, 'Preview did not restore the original page scroll position.');

    await page.locator('[data-unified-preview]').click();
    assert(await page.locator('body.profile-mobile-editor-scroll-locked').count() === 1, 'Reopening the editor did not relock background scrolling.');
    checkpoint('live preview release and relock');

    await page.locator('[data-unified-cancel]').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'hidden' });
    assert(await page.locator('body.profile-mobile-editor-scroll-locked').count() === 0, 'Closing the editor left the page locked.');

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
    assert(afterSnapshot === beforeSnapshot, 'Live verification changed stored profile data.');
    checkpoint('live cancel restoration');

    await page.setViewportSize({ width: 1100, height: 800 });
    await page.locator('#profile-edit').click();
    assert(await page.locator('[data-unified-preview]').isHidden(), 'Preview toggle is visible on desktop.');
    assert(await page.locator('body.profile-mobile-editor-scroll-locked').count() === 0, 'Desktop editor incorrectly uses mobile page locking.');
    await page.locator('[data-unified-cancel]').click();
    checkpoint('live desktop unaffected');

    console.log('Live mobile profile editor scroll verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
