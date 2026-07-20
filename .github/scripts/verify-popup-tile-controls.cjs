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

    assert(await page.locator('#profile-card .profile-card-tile-area').count() === 1, 'The card tile renderer lost its original profile-card area.');
    assert(await page.locator('#profile-workspace > .profile-grid-region').count() === 1, 'The lower tile renderer lost its original grid region.');
    assert(await popup.locator('[data-unified-existing="cardTiles"]').count() === 1, 'Card-tile selector panel is missing from the popup.');
    assert(await popup.locator('[data-unified-existing="profileTiles"]').count() === 1, 'Profile-tile selector panel is missing from the popup.');
    checkpoint('modal-native tile selector panels');

    await popup.locator('.profile-unified-tabs [data-unified-tab="cardTiles"]').click();
    let cardSelector = popup.locator('[data-unified-existing-list="cardTiles"] .profile-unified-existing-tile').first();
    if (await cardSelector.count() === 0) {
      await popup.locator('[data-add-card-tile="custom"]').click();
      await popup.locator('#profile-card-tile-dialog[open]').waitFor({ state: 'visible' });
      await page.evaluate(() => document.querySelector('#profile-card-tile-dialog')?.close());
      await popup.locator('[data-unified-existing-list="cardTiles"] .profile-unified-existing-tile').first().waitFor({ state: 'visible' });
      cardSelector = popup.locator('[data-unified-existing-list="cardTiles"] .profile-unified-existing-tile').first();
    }
    assert(await cardSelector.count() === 1, 'No existing card tile can be selected inside the popup.');
    await cardSelector.click();
    await popup.locator('#profile-card-tile-dialog[open]').waitFor({ state: 'visible' });
    assert(await popup.locator('#profile-card-tile-dialog[open]').isVisible(), 'Card tile selector did not open the original settings editor.');
    await page.evaluate(() => document.querySelector('#profile-card-tile-dialog')?.close());
    checkpoint('existing card tile opens original editor');

    await popup.locator('.profile-unified-tabs [data-unified-tab="profileTiles"]').click();
    let profileSelector = popup.locator('[data-unified-existing-list="profileTiles"] .profile-unified-existing-tile').first();
    if (await profileSelector.count() === 0) {
      await popup.locator('[data-add-profile-tile="text"]').click();
      await popup.locator('#profile-tile-dialog[open]').waitFor({ state: 'visible' });
      await page.evaluate(() => document.querySelector('#profile-tile-dialog')?.close());
      await popup.locator('[data-unified-existing-list="profileTiles"] .profile-unified-existing-tile').first().waitFor({ state: 'visible' });
      profileSelector = popup.locator('[data-unified-existing-list="profileTiles"] .profile-unified-existing-tile').first();
    }
    assert(await profileSelector.count() === 1, 'No existing lower profile tile can be selected inside the popup.');
    await profileSelector.click();
    await popup.locator('#profile-tile-dialog[open]').waitFor({ state: 'visible' });
    assert(await popup.locator('#profile-tile-dialog[open]').isVisible(), 'Profile tile selector did not open the original settings editor.');
    await page.evaluate(() => document.querySelector('#profile-tile-dialog')?.close());
    checkpoint('existing lower tile opens original editor');

    await popup.locator('#profile-cancel').click();
    await popup.waitFor({ state: 'hidden' });
    assert(await page.locator('#profile-card .profile-card-tile-area').count() === 1, 'Card tile area changed location after closing the popup.');
    assert(await page.locator('#profile-workspace > .profile-grid-region').count() === 1, 'Lower grid changed location after closing the popup.');

    const after = (await (await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`)).json()).profile;
    const afterSnapshot = JSON.stringify({ cardTiles: after.cardTiles || [], tiles: after.tiles || [] });
    assert(afterSnapshot === beforeSnapshot, 'Tile selector verification changed saved profile data.');
    checkpoint('tile selectors cancel without saving');

    console.log('Popup tile-selector verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
