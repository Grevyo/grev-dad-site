const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const ref = process.env.VERIFY_REF;
const rawBase = `https://raw.githubusercontent.com/Grevyo/grev-dad-site/${ref}/public`;
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);

async function fetchText(path) {
  const response = await fetch(`${rawBase}/${path}`);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.text();
}

(async () => {
  const [css, js] = await Promise.all([
    fetchText('profile-editor-unified.css'),
    fetchText('profile-editor-unified.js')
  ]);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 850 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);

  try {
    const login = await context.request.post(`${base}/api/auth/login`, {
      data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
    });
    assert(login.status() === 200, `Login failed (${login.status()}).`);
    const profileId = (await (await context.request.get(`${base}/api/auth/session`)).json()).user.id;
    const beforeResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    const before = (await beforeResponse.json()).profile;
    const beforeSnapshot = JSON.stringify({ cardTiles: before.cardTiles || [], tiles: before.tiles || [] });

    await page.route('**/profile-editor-unified.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: css }));
    await page.route('**/profile-editor-unified.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: js }));
    await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    await page.locator('#profile-edit').click();
    const popup = page.locator('#profile-unified-editor');
    await popup.waitFor({ state: 'visible' });

    assert(await popup.locator('.profile-card-tile-area').count() === 1, 'The live card-tile area was not moved inside the popup.');
    assert(await popup.locator('.profile-grid-region').count() === 1, 'The live lower profile grid was not moved inside the popup.');
    assert(await page.locator('#profile-card .profile-card-tile-area').count() === 0, 'The card-tile area is still stranded behind the modal.');
    assert(await page.locator('#profile-workspace > .profile-grid-region').count() === 0, 'The lower profile grid is still stranded behind the modal.');
    checkpoint('live tile areas mounted inside popup');

    await popup.locator('.profile-unified-tabs [data-unified-tab="cardTiles"]').click();
    let cardSettings = popup.locator('.profile-card-mini-settings').first();
    if (await cardSettings.count() === 0) {
      await popup.locator('[data-add-card-tile="custom"]').click();
      await popup.locator('#profile-card-tile-dialog[open]').waitFor({ state: 'visible' });
      await page.evaluate(() => document.querySelector('#profile-card-tile-dialog')?.close());
      cardSettings = popup.locator('.profile-card-mini-settings').first();
    }
    assert(await cardSettings.count() === 1, 'No card mini-tile settings control is reachable inside the popup.');
    await cardSettings.click();
    assert(await popup.locator('#profile-card-tile-dialog[open]').isVisible(), 'Card mini-tile settings did not open inside the popup.');
    await page.evaluate(() => document.querySelector('#profile-card-tile-dialog')?.close());
    checkpoint('card mini-tile settings reachable');

    await popup.locator('.profile-unified-tabs [data-unified-tab="profileTiles"]').click();
    let profileSettings = popup.locator('.profile-tile-settings-button').first();
    if (await profileSettings.count() === 0) {
      await popup.locator('[data-add-profile-tile="text"]').click();
      await popup.locator('#profile-tile-dialog[open]').waitFor({ state: 'visible' });
      await page.evaluate(() => document.querySelector('#profile-tile-dialog')?.close());
      profileSettings = popup.locator('.profile-tile-settings-button').first();
    }
    assert(await profileSettings.count() === 1, 'No lower profile-tile settings control is reachable inside the popup.');
    await profileSettings.click();
    assert(await popup.locator('#profile-tile-dialog[open]').isVisible(), 'Lower profile-tile settings did not open inside the popup.');
    await page.evaluate(() => document.querySelector('#profile-tile-dialog')?.close());
    checkpoint('lower profile-tile settings reachable');

    await popup.locator('#profile-cancel').click();
    await popup.waitFor({ state: 'hidden' });
    assert(await page.locator('#profile-card .profile-card-tile-area').count() === 1, 'Card tile area was not restored to the profile card after closing.');
    assert(await page.locator('#profile-workspace > .profile-grid-region').count() === 1, 'Lower grid was not restored after closing.');

    const after = (await (await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`)).json()).profile;
    const afterSnapshot = JSON.stringify({ cardTiles: after.cardTiles || [], tiles: after.tiles || [] });
    assert(afterSnapshot === beforeSnapshot, 'Tile-control verification changed saved profile data.');
    checkpoint('live tile areas restored without saving');

    console.log('Popup tile-control verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
