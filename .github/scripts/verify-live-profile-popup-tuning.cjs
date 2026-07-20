const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const assert = (value, message) => { if (!value) throw new Error(message); };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function assetsAreLive() {
  const token = Date.now();
  const [js, css] = await Promise.all([
    fetch(`${base}/profile-editor-unified.js?verify=${token}`).then(response => response.text()),
    fetch(`${base}/profile-editor-unified.css?verify=${token}`).then(response => response.text())
  ]);
  return !js.includes("?.focus({ preventScroll: true })") &&
    js.includes('requestAnimationFrame(() => {') &&
    js.includes('state.body.scrollTop += dialogRect.top - bodyRect.top - 12;') &&
    css.includes('width:min(1320px,calc(100vw - 48px))') &&
    css.includes('height:min(940px,calc(var(--profile-visible-height,100dvh) - 40px))');
}

(async () => {
  let live = false;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (await assetsAreLive()) { live = true; break; }
    await sleep(5000);
  }
  assert(live, 'Merged popup tuning assets did not appear on PBE.');
  console.log('CHECKPOINT merged assets live');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    const login = await context.request.post(`${base}/api/auth/login`, {
      data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
    });
    assert(login.status() === 200, `Login failed (${login.status()}).`);
    const profileId = (await (await context.request.get(`${base}/api/auth/session`)).json()).user.id;
    const before = (await (await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`)).json()).profile;
    const beforeSnapshot = JSON.stringify({ cardTiles: before.cardTiles || [], tiles: before.tiles || [] });

    await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    await page.locator('#profile-edit').click();
    const popup = page.locator('#profile-unified-editor');
    await popup.waitFor({ state: 'visible' });
    await page.waitForTimeout(150);
    const initial = await popup.evaluate(dialog => ({
      activeTag: document.activeElement?.tagName || null,
      activeId: document.activeElement?.id || null,
      inputFocused: Boolean(document.activeElement?.matches?.('input,textarea,select')),
      scrollTop: dialog.querySelector('.profile-unified-body').scrollTop,
      width: dialog.getBoundingClientRect().width,
      height: dialog.getBoundingClientRect().height
    }));
    assert(!initial.inputFocused, `Mobile Edit profile focused ${initial.activeTag}#${initial.activeId}.`);
    assert(initial.scrollTop <= 1, `Mobile Edit profile opened at scrollTop ${initial.scrollTop}.`);
    console.log(`CHECKPOINT mobile initial ${JSON.stringify(initial)}`);

    await popup.locator('.profile-unified-tabs [data-unified-tab="profileTiles"]').click();
    let profileSelector = popup.locator('[data-unified-existing-list="profileTiles"] .profile-unified-existing-tile').first();
    if (await profileSelector.count()) await profileSelector.click();
    else await popup.locator('[data-add-profile-tile="text"]').click();
    await popup.locator('#profile-tile-dialog[open]').waitFor({ state: 'visible' });
    await page.waitForTimeout(150);
    const profileTile = await popup.evaluate(dialog => {
      const body = dialog.querySelector('.profile-unified-body').getBoundingClientRect();
      const editor = dialog.querySelector('#profile-tile-dialog[open]').getBoundingClientRect();
      return { bodyTop: body.top, bodyBottom: body.bottom, editorTop: editor.top, inputFocused: Boolean(document.activeElement?.matches?.('input,textarea,select')) };
    });
    assert(profileTile.editorTop >= profileTile.bodyTop + 6 && profileTile.editorTop < profileTile.bodyBottom - 24, `Profile tile editor opened outside the visible body at ${profileTile.editorTop}.`);
    assert(!profileTile.inputFocused, 'Profile tile editor focused an input.');
    await page.evaluate(() => document.querySelector('#profile-tile-dialog')?.close());

    await popup.locator('.profile-unified-tabs [data-unified-tab="cardTiles"]').click();
    let cardSelector = popup.locator('[data-unified-existing-list="cardTiles"] .profile-unified-existing-tile').first();
    if (await cardSelector.count()) await cardSelector.click();
    else await popup.locator('[data-add-card-tile="custom"]').click();
    await popup.locator('#profile-card-tile-dialog[open]').waitFor({ state: 'visible' });
    await page.waitForTimeout(150);
    const cardTile = await popup.evaluate(dialog => {
      const body = dialog.querySelector('.profile-unified-body').getBoundingClientRect();
      const editor = dialog.querySelector('#profile-card-tile-dialog[open]').getBoundingClientRect();
      return { bodyTop: body.top, bodyBottom: body.bottom, editorTop: editor.top, inputFocused: Boolean(document.activeElement?.matches?.('input,textarea,select')) };
    });
    assert(cardTile.editorTop >= cardTile.bodyTop + 6 && cardTile.editorTop < cardTile.bodyBottom - 24, `Card tile editor opened outside the visible body at ${cardTile.editorTop}.`);
    assert(!cardTile.inputFocused, 'Card tile editor focused an input.');
    await page.evaluate(() => document.querySelector('#profile-card-tile-dialog')?.close());
    await popup.locator('#profile-cancel').click();
    console.log(`CHECKPOINT nested editors ${JSON.stringify({ profileTile, cardTile })}`);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#profile-edit').click();
    await popup.waitFor({ state: 'visible' });
    const desktop = await popup.evaluate(dialog => {
      const rect = dialog.getBoundingClientRect();
      return { width: rect.width, height: rect.height, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    });
    assert(desktop.width === 1320 && desktop.height === 860, `Desktop popup measured ${desktop.width}×${desktop.height}.`);
    assert(desktop.left === 60 && desktop.right === 1380, `Desktop margins measured ${desktop.left}/${1440 - desktop.right}.`);
    await popup.locator('#profile-cancel').click();
    console.log(`CHECKPOINT desktop ${JSON.stringify(desktop)}`);

    const after = (await (await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`)).json()).profile;
    const afterSnapshot = JSON.stringify({ cardTiles: after.cardTiles || [], tiles: after.tiles || [] });
    assert(afterSnapshot === beforeSnapshot, 'Live verification changed saved profile tiles.');
    console.log('Live Profile popup tuning verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.stack || error); process.exit(1); });
