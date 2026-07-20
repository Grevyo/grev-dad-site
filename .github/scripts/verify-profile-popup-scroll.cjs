const fs = require('node:fs');
const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const assert = (value, message) => {
  if (!value) throw new Error(message);
};

(async () => {
  const js = fs.readFileSync('public/profile-editor-unified.js', 'utf8');
  const css = fs.readFileSync('public/profile-editor-unified.css', 'utf8');
  assert(!js.includes("?.focus({ preventScroll: true })"), 'Automatic input focus remains in the popup code.');
  assert(js.includes('state.body.scrollTop += dialogRect.top - bodyRect.top - 12;'), 'Explicit nested-editor scrolling is missing.');
  assert(css.includes('width:min(1320px,calc(100vw - 48px))'), 'Larger desktop width is missing.');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    const login = await context.request.post(`${base}/api/auth/login`, {
      data: {
        identifier: 'LADMIN',
        password: process.env.LADMIN_BOOTSTRAP_PASSWORD,
        rememberMe: false
      }
    });
    assert(login.status() === 200, `Login failed (${login.status()}).`);
    const session = await context.request.get(`${base}/api/auth/session`);
    const profileId = (await session.json()).user.id;

    await page.route('**/profile-editor-unified.js', route => route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: js
    }));
    await page.route('**/profile-editor-unified.css', route => route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: css
    }));

    await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    await page.locator('#profile-edit').click();
    const popup = page.locator('#profile-unified-editor');
    await popup.waitFor({ state: 'visible' });
    await page.waitForTimeout(100);

    const initial = await popup.evaluate(dialog => ({
      activeTag: document.activeElement?.tagName || null,
      activeId: document.activeElement?.id || null,
      inputFocused: Boolean(document.activeElement?.matches?.('input,textarea,select')),
      bodyScrollTop: dialog.querySelector('.profile-unified-body')?.scrollTop ?? -1,
      width: dialog.getBoundingClientRect().width,
      height: dialog.getBoundingClientRect().height
    }));
    assert(!initial.inputFocused, `Opening Edit profile focused ${initial.activeTag}#${initial.activeId}.`);
    assert(initial.bodyScrollTop <= 1, `Opening Edit profile jumped to ${initial.bodyScrollTop}px.`);

    await popup.locator('.profile-unified-tabs [data-unified-tab="profileTiles"]').click();
    await popup.locator('[data-add-profile-tile="text"]').click();
    const profileTileDialog = popup.locator('#profile-tile-dialog[open]');
    await profileTileDialog.waitFor({ state: 'visible' });
    await page.waitForTimeout(100);
    const profileTile = await popup.evaluate(dialog => {
      const body = dialog.querySelector('.profile-unified-body').getBoundingClientRect();
      const editor = dialog.querySelector('#profile-tile-dialog[open]').getBoundingClientRect();
      return {
        bodyTop: body.top,
        bodyBottom: body.bottom,
        editorTop: editor.top,
        inputFocused: Boolean(document.activeElement?.matches?.('input,textarea,select')),
        activeTag: document.activeElement?.tagName || null,
        scrollTop: dialog.querySelector('.profile-unified-body').scrollTop
      };
    });
    assert(profileTile.editorTop >= profileTile.bodyTop + 6, `Profile tile editor top ${profileTile.editorTop} is above the popup body ${profileTile.bodyTop}.`);
    assert(profileTile.editorTop < profileTile.bodyBottom - 24, `Profile tile editor opened below the visible popup body at ${profileTile.editorTop}.`);
    assert(!profileTile.inputFocused, `Profile tile editor focused ${profileTile.activeTag}.`);
    await page.evaluate(() => document.querySelector('#profile-tile-dialog')?.close());

    await popup.locator('.profile-unified-tabs [data-unified-tab="cardTiles"]').click();
    await popup.locator('[data-add-card-tile="custom"]').click();
    const cardTileDialog = popup.locator('#profile-card-tile-dialog[open]');
    await cardTileDialog.waitFor({ state: 'visible' });
    await page.waitForTimeout(100);
    const cardTile = await popup.evaluate(dialog => {
      const body = dialog.querySelector('.profile-unified-body').getBoundingClientRect();
      const editor = dialog.querySelector('#profile-card-tile-dialog[open]').getBoundingClientRect();
      return {
        bodyTop: body.top,
        bodyBottom: body.bottom,
        editorTop: editor.top,
        inputFocused: Boolean(document.activeElement?.matches?.('input,textarea,select')),
        activeTag: document.activeElement?.tagName || null,
        scrollTop: dialog.querySelector('.profile-unified-body').scrollTop
      };
    });
    assert(cardTile.editorTop >= cardTile.bodyTop + 6, `Card tile editor top ${cardTile.editorTop} is above the popup body ${cardTile.bodyTop}.`);
    assert(cardTile.editorTop < cardTile.bodyBottom - 24, `Card tile editor opened below the visible popup body at ${cardTile.editorTop}.`);
    assert(!cardTile.inputFocused, `Card tile editor focused ${cardTile.activeTag}.`);
    await page.evaluate(() => document.querySelector('#profile-card-tile-dialog')?.close());
    await popup.locator('#profile-cancel').click();
    await popup.waitFor({ state: 'hidden' });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#profile-edit').click();
    await popup.waitFor({ state: 'visible' });
    const desktop = await popup.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right
      };
    });
    assert(desktop.width === 1320, `Desktop popup width was ${desktop.width}px.`);
    assert(desktop.height === 860, `Desktop popup height was ${desktop.height}px.`);
    assert(desktop.left === 60 && desktop.right === 1380, `Desktop margins were ${desktop.left}px/${1440 - desktop.right}px.`);
    await popup.locator('#profile-cancel').click();

    console.log(`INITIAL ${JSON.stringify(initial)}`);
    console.log(`PROFILE_TILE ${JSON.stringify(profileTile)}`);
    console.log(`CARD_TILE ${JSON.stringify(cardTile)}`);
    console.log(`DESKTOP ${JSON.stringify(desktop)}`);
    console.log('Profile popup scrolling verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
