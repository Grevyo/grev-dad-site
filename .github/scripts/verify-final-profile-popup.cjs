const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const ref = process.env.VERIFY_REF;
const rawRoot = `https://raw.githubusercontent.com/Grevyo/grev-dad-site/${ref}/public`;
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);

async function text(path) {
  const response = await fetch(`${rawRoot}/${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.text();
}

(async () => {
  const [html, css, js, a11y] = await Promise.all([
    text('profile.html'),
    text('profile-editor-unified.css'),
    text('profile-editor-unified.js'),
    text('profile-editor-unified-a11y.js')
  ]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    const login = await context.request.post(`${base}/api/auth/login`, {
      data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
    });
    assert(login.status() === 200, `Login failed (${login.status()}).`);
    const profileId = (await (await context.request.get(`${base}/api/auth/session`)).json()).user.id;
    const profileUrl = `${base}/profile/${encodeURIComponent(profileId)}`;
    const before = (await (await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`)).json()).profile;
    const beforeSnapshot = JSON.stringify({ card: before.card, cardTiles: before.cardTiles || [], design: before.design, preferences: before.preferences, tiles: before.tiles || [] });

    await page.route(profileUrl, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
    await page.route('**/profile-editor-unified.css', route => route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: css }));
    await page.route('**/profile-editor-unified.js', route => route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: js }));
    await page.route('**/profile-editor-unified-a11y.js', route => route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: a11y }));

    await page.goto(profileUrl, { waitUntil: 'networkidle' });
    assert(await page.locator('script[src="/profile-editor-unified-a11y.js"]').count() === 1, 'Profile page does not load the popup accessibility controller.');
    const shellBefore = await page.locator('.profile-shell').evaluate(shell => ({ width: shell.getBoundingClientRect().width, left: shell.getBoundingClientRect().left }));
    await page.locator('#profile-edit').click();
    const popup = page.locator('#profile-unified-editor');
    await popup.waitFor({ state: 'visible' });

    const mobile = await popup.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const shell = document.querySelector('.profile-shell').getBoundingClientRect();
      const close = dialog.querySelector('[data-unified-close]');
      return {
        tag: dialog.tagName,
        modal: dialog.matches(':modal'),
        centredX: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 4,
        centredY: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) < 8,
        bounded: rect.left >= 6 && rect.right <= innerWidth - 6,
        closeVisible: close && getComputedStyle(close).display !== 'none' && close.getBoundingClientRect().width > 0,
        shellWidth: shell.width,
        shellLeft: shell.left
      };
    });
    assert(mobile.tag === 'DIALOG' && mobile.modal && mobile.centredX && mobile.centredY && mobile.bounded, 'Mobile Profile editor is not the expected centred native modal.');
    assert(mobile.closeVisible, 'Popup header Close button is not visible.');
    assert(Math.abs(mobile.shellWidth - shellBefore.width) < 2 && Math.abs(mobile.shellLeft - shellBefore.left) < 2, 'Underlying profile shifted when modal opened.');
    checkpoint('mobile modal and unchanged page');

    const tabs = popup.locator('.profile-unified-tabs [role="tab"]');
    assert(await tabs.count() === 4, 'Popup accessibility controller did not configure four tabs.');
    const firstTab = tabs.first();
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');
    assert(await tabs.nth(1).getAttribute('aria-selected') === 'true', 'Arrow-key tab navigation is not active.');
    checkpoint('loaded accessibility controller');

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
    checkpoint('existing tile selectors');

    await popup.locator('#profile-cancel').click();
    await popup.waitFor({ state: 'hidden' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: 'networkidle' });
    const desktopShellBefore = await page.locator('.profile-shell').evaluate(shell => ({ width: shell.getBoundingClientRect().width, left: shell.getBoundingClientRect().left }));
    await page.locator('#profile-edit').click();
    await popup.waitFor({ state: 'visible' });
    const desktop = await popup.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      const shell = document.querySelector('.profile-shell').getBoundingClientRect();
      return {
        centredX: Math.abs((rect.left + rect.right) / 2 - innerWidth / 2) < 4,
        centredY: Math.abs((rect.top + rect.bottom) / 2 - innerHeight / 2) < 4,
        width: rect.width,
        shellWidth: shell.width,
        shellLeft: shell.left
      };
    });
    assert(desktop.centredX && desktop.centredY && desktop.width <= 922, 'Desktop Profile editor is not a centred bounded popup.');
    assert(Math.abs(desktop.shellWidth - desktopShellBefore.width) < 2 && Math.abs(desktop.shellLeft - desktopShellBefore.left) < 2, 'Desktop profile shifted when modal opened.');
    await popup.locator('#profile-cancel').click();

    const after = (await (await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`)).json()).profile;
    const afterSnapshot = JSON.stringify({ card: after.card, cardTiles: after.cardTiles || [], design: after.design, preferences: after.preferences, tiles: after.tiles || [] });
    assert(afterSnapshot === beforeSnapshot, 'Final popup verification changed saved profile data.');
    checkpoint('desktop popup and cancel restoration');
    console.log('Final Profile popup verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
