const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const raw = `https://raw.githubusercontent.com/Grevyo/grev-dad-site/${process.env.VERIFY_REF}/public`;

(async () => {
  let js = await fetch(`${raw}/profile-editor-unified.js`).then(response => response.text());
  const css = await fetch(`${raw}/profile-editor-unified.css`).then(response => response.text());
  const old = `      queueMicrotask(() => {
        dialog.scrollTop = 0;
        if (state.body) state.body.scrollTop = 0;
      });`;
  const replacement = `      requestAnimationFrame(() => {
        dialog.scrollTop = 0;
        if (!state.body) return;
        if (tab === 'card' || tab === 'page') {
          state.body.scrollTop = 0;
          return;
        }
        const bodyRect = state.body.getBoundingClientRect();
        const dialogRect = dialog.getBoundingClientRect();
        state.body.scrollTop += dialogRect.top - bodyRect.top - 12;
      });`;
  if (!js.includes(old)) throw new Error('Current popup scheduling block was not found.');
  js = js.replace(old, replacement);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    const login = await context.request.post(`${base}/api/auth/login`, {
      data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
    });
    if (login.status() !== 200) throw new Error(`Login failed (${login.status()}).`);
    const profileId = (await (await context.request.get(`${base}/api/auth/session`)).json()).user.id;
    await page.route('**/profile-editor-unified.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: js }));
    await page.route('**/profile-editor-unified.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: css }));
    await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    await page.locator('#profile-edit').click();
    const popup = page.locator('#profile-unified-editor');
    await popup.waitFor({ state: 'visible' });
    await page.waitForTimeout(150);
    console.log('INITIAL', await popup.evaluate(dialog => ({
      scrollTop: dialog.querySelector('.profile-unified-body').scrollTop,
      activeTag: document.activeElement?.tagName || null,
      activeId: document.activeElement?.id || null
    })));

    await popup.locator('.profile-unified-tabs [data-unified-tab="profileTiles"]').click();
    console.log('PROFILE_TAB', await popup.evaluate(dialog => ({
      scrollTop: dialog.querySelector('.profile-unified-body').scrollTop,
      addVisible: Boolean(dialog.querySelector('[data-add-profile-tile="text"]')?.getClientRects().length)
    })));
    await popup.locator('[data-add-profile-tile="text"]').click();
    await popup.locator('#profile-tile-dialog[open]').waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
    console.log('PROFILE_TILE', await popup.evaluate(dialog => {
      const body = dialog.querySelector('.profile-unified-body');
      const bodyRect = body.getBoundingClientRect();
      const editorRect = dialog.querySelector('#profile-tile-dialog[open]').getBoundingClientRect();
      return {
        bodyTop: bodyRect.top,
        bodyBottom: bodyRect.bottom,
        editorTop: editorRect.top,
        editorBottom: editorRect.bottom,
        scrollTop: body.scrollTop,
        scrollHeight: body.scrollHeight,
        clientHeight: body.clientHeight,
        activeTag: document.activeElement?.tagName || null,
        activeId: document.activeElement?.id || null
      };
    }));
    await page.evaluate(() => document.querySelector('#profile-tile-dialog')?.close());

    await popup.locator('.profile-unified-tabs [data-unified-tab="cardTiles"]').click();
    console.log('CARD_TAB', await popup.evaluate(dialog => ({
      scrollTop: dialog.querySelector('.profile-unified-body').scrollTop,
      addVisible: Boolean(dialog.querySelector('[data-add-card-tile="custom"]')?.getClientRects().length)
    })));
    await popup.locator('[data-add-card-tile="custom"]').click();
    await popup.locator('#profile-card-tile-dialog[open]').waitFor({ state: 'visible' });
    await page.waitForTimeout(250);
    console.log('CARD_TILE', await popup.evaluate(dialog => {
      const body = dialog.querySelector('.profile-unified-body');
      const bodyRect = body.getBoundingClientRect();
      const editorRect = dialog.querySelector('#profile-card-tile-dialog[open]').getBoundingClientRect();
      return {
        bodyTop: bodyRect.top,
        bodyBottom: bodyRect.bottom,
        editorTop: editorRect.top,
        editorBottom: editorRect.bottom,
        scrollTop: body.scrollTop,
        scrollHeight: body.scrollHeight,
        clientHeight: body.clientHeight,
        activeTag: document.activeElement?.tagName || null,
        activeId: document.activeElement?.id || null
      };
    }));
    await popup.locator('#profile-cancel').click();
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
