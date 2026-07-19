const { chromium } = require('playwright');
const base = 'https://pbe.grev.dad';
const assetBase = 'https://agent-streamline-profile-editor-grev-dad-site.joeahh.workers.dev';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
    checkpoint('authenticated');

    const beforeResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    assert(beforeResponse.status() === 200, 'Profile API did not load.');
    const before = (await beforeResponse.json()).profile;
    const beforeCardTiles = JSON.stringify(before.cardTiles || []);
    const beforeTiles = JSON.stringify(before.tiles || []);

    const response = await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    assert(response?.status() === 200, 'Profile page did not load.');
    await page.addStyleTag({ url: `${assetBase}/profile-editor-unified.css` });
    await page.addScriptTag({ url: `${assetBase}/profile-editor-unified.js` });
    await page.locator('#profile-unified-editor').waitFor({ state: 'attached' });

    await page.locator('#profile-edit').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'visible' });

    assert(await page.locator('[data-unified-tab]').count() === 4, 'Expected four clear editor sections.');
    assert(await page.locator('[data-unified-tab="card"].is-active').count() === 1, 'Profile card should be the default editor section.');
    assert(await page.locator('#profile-card-dialog[open]').count() === 1, 'Card settings were not mounted inline.');
    assert(await page.locator('dialog:modal').count() === 0, 'A blocking modal dialog is still open.');
    assert(await page.locator('#profile-editor-toolbar').evaluate(element => getComputedStyle(element).display === 'none'), 'Old profile toolbar is still visible.');
    assert(await page.locator('[data-unified-save]').isVisible(), 'Unified Save profile action is missing.');
    assert(await page.locator('[data-unified-cancel]').isVisible(), 'Unified Cancel action is missing.');
    checkpoint('profile card section');

    await page.locator('[data-unified-tab="page"]').click();
    assert(await page.locator('#profile-design-dialog[open]').count() === 1, 'Profile design did not open inline.');
    assert(await page.locator('dialog:modal').count() === 0, 'Profile design opened as a modal.');
    assert(await page.locator('#design-page-background-type').isVisible(), 'Page design controls are missing.');
    checkpoint('profile page section');

    await page.locator('[data-unified-tab="cardTiles"]').click();
    assert(await page.locator('#profile-card-tile-editor').isVisible(), 'Card-tile add controls are missing from the unified panel.');
    const cardTileCountBefore = await page.locator('.profile-card-mini-tile').count();
    if (cardTileCountBefore < 4) {
      await page.locator('#profile-card-tile-editor [data-add-card-tile="custom"]').click();
      assert(await page.locator('#profile-card-tile-dialog[open]').count() === 1, 'Card tile settings did not open inline.');
      assert(await page.locator('dialog:modal').count() === 0, 'Card tile settings opened as a modal.');
    }
    checkpoint('card tile section');

    await page.locator('[data-unified-tab="profileTiles"]').click();
    assert(await page.locator('#profile-catalogue').isVisible(), 'Profile tile catalogue is not inside the unified editor.');
    assert(await page.locator('.profile-editor-preferences').isVisible(), 'Profile tile spacing controls are missing.');
    const lowerTile = page.locator('.profile-tile-settings-button').first();
    if (await lowerTile.count()) await lowerTile.click();
    else await page.locator('#profile-catalogue [data-add-profile-tile="text"]').click();
    assert(await page.locator('#profile-tile-dialog[open]').count() === 1, 'Lower profile tile settings did not open inline.');
    assert(await page.locator('dialog:modal').count() === 0, 'Lower tile settings opened as a modal.');
    checkpoint('profile tile section');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-unified-preview]').click();
    assert(await page.locator('#profile-unified-editor.is-collapsed').count() === 1, 'Mobile Preview toggle did not collapse the editor.');
    assert(await page.locator('[data-unified-preview]').getAttribute('aria-expanded') === 'false', 'Mobile Preview state is not exposed accessibly.');
    await page.locator('[data-unified-preview]').click();
    assert(await page.locator('#profile-unified-editor.is-collapsed').count() === 0, 'Mobile editor did not reopen.');
    checkpoint('mobile preview toggle');

    await page.locator('[data-unified-cancel]').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'hidden' });
    assert(await page.locator('dialog:modal').count() === 0, 'A modal remains after Cancel.');

    const afterResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    assert(afterResponse.status() === 200, 'Profile API did not reload after Cancel.');
    const after = (await afterResponse.json()).profile;
    assert(JSON.stringify(after.cardTiles || []) === beforeCardTiles, 'Cancel changed saved card tiles.');
    assert(JSON.stringify(after.tiles || []) === beforeTiles, 'Cancel changed saved profile tiles.');
    checkpoint('cancel restoration');

    const dashboard = await context.request.get(`${base}/api/dashboard`);
    assert(dashboard.status() === 200, 'Dashboard API compatibility failed.');
    checkpoint('dashboard compatibility');
    console.log('Unified profile editor browser verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
