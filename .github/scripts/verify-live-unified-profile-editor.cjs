const { chromium } = require('playwright');

const base = 'https://pbe.grev.dad';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  try {
    let profileId = null;
    for (let attempt = 1; attempt <= 36; attempt += 1) {
      const login = await context.request.post(`${base}/api/auth/login`, {
        data: {
          identifier: 'LADMIN',
          password: process.env.LADMIN_BOOTSTRAP_PASSWORD,
          rememberMe: false
        }
      });
      if (login.status() === 200) {
        const session = await context.request.get(`${base}/api/auth/session`);
        if (session.status() === 200) {
          const payload = await session.json();
          profileId = payload.user?.id || null;
          if (profileId) break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    assert(profileId, 'The real PBE deployment did not become ready for authenticated verification.');
    checkpoint('authenticated');

    for (const asset of ['profile-editor-unified.css', 'profile-editor-unified.js']) {
      const response = await context.request.get(`${base}/${asset}`);
      assert(response.status() === 200, `${asset} was not served by real PBE.`);
      const body = await response.text();
      assert(body.includes('profile-unified-editor'), `${asset} did not contain the unified editor implementation.`);
    }
    checkpoint('assets');

    const beforeResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    assert(beforeResponse.status() === 200, 'The profile API did not load before browser verification.');
    const before = (await beforeResponse.json()).profile;
    assert(before?.isSelf === true, 'The authenticated profile was not recognised as the owner profile.');
    const snapshots = {
      card: JSON.stringify(before.card || null),
      design: JSON.stringify(before.design || null),
      preferences: JSON.stringify(before.preferences || null),
      cardTiles: JSON.stringify(before.cardTiles || []),
      tiles: JSON.stringify(before.tiles || [])
    };

    const response = await page.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    assert(response?.status() === 200, 'The real PBE profile page did not load.');
    assert(await page.locator('link[href="/profile-editor-unified.css"]').count() === 1, 'The profile page does not link the unified editor stylesheet.');
    assert(await page.locator('script[src="/profile-editor-unified.js"]').count() === 1, 'The profile page does not load the unified editor script.');

    await page.locator('#profile-edit').waitFor({ state: 'visible' });
    await page.locator('#profile-edit').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'visible' });

    const tabs = page.locator('.profile-unified-tabs [data-unified-tab]');
    assert(await tabs.count() === 4, 'Expected exactly four unified editor navigation tabs.');
    assert(await page.locator('.profile-unified-tabs').getAttribute('role') === 'tablist', 'The editor navigation is not exposed as a tablist.');
    for (const name of ['card', 'cardTiles', 'page', 'profileTiles']) {
      const tab = page.locator(`.profile-unified-tabs [data-unified-tab="${name}"]`);
      assert(await tab.getAttribute('role') === 'tab', `The ${name} section is not exposed as a tab.`);
      const controls = await tab.getAttribute('aria-controls');
      assert(controls && await page.locator(`#${controls}[role="tabpanel"]`).count() === 1, `The ${name} tab is not linked to its panel.`);
    }
    assert(await page.locator('.profile-unified-tabs [data-unified-tab="card"].is-active').count() === 1, 'The Profile card section was not selected by default.');
    assert(await page.locator('#profile-card-dialog[open]').count() === 1, 'Profile card settings were not mounted inline.');
    assert(await page.locator('dialog:modal').count() === 0, 'A blocking modal is open in the unified editor.');
    assert(await page.locator('#profile-editor-toolbar').evaluate(element => getComputedStyle(element).display === 'none'), 'The legacy profile toolbar is still visible.');
    assert(await page.locator('[data-unified-save]').isVisible(), 'The unified Save profile action is missing.');
    assert(await page.locator('[data-unified-cancel]').isVisible(), 'The unified Cancel action is missing.');
    assert(await page.locator('[data-unified-preview]').isHidden(), 'The mobile Preview toggle is incorrectly visible on desktop.');
    checkpoint('profile card section');

    await page.locator('.profile-unified-tabs [data-unified-tab="page"]').click();
    assert(await page.locator('#profile-design-dialog[open]').count() === 1, 'Profile design settings were not mounted inline.');
    assert(await page.locator('#design-page-background-type').isVisible(), 'Profile page controls are missing.');
    assert(await page.locator('dialog:modal').count() === 0, 'Profile page settings opened as a blocking modal.');
    checkpoint('profile page section');

    await page.locator('.profile-unified-tabs [data-unified-tab="cardTiles"]').click();
    assert(await page.locator('#profile-card-tile-editor').isVisible(), 'Profile-card tile controls are missing from the unified panel.');
    const existingCardTileSettings = page.locator('.profile-card-mini-settings').first();
    if (await existingCardTileSettings.count()) {
      await existingCardTileSettings.click();
    } else {
      await page.locator('#profile-card-tile-editor [data-add-card-tile="custom"]').click();
    }
    assert(await page.locator('#profile-card-tile-dialog[open]').count() === 1, 'Profile-card tile settings were not mounted inline.');
    assert(await page.locator('dialog:modal').count() === 0, 'Profile-card tile settings opened as a blocking modal.');
    checkpoint('card tile section');

    await page.locator('.profile-unified-tabs [data-unified-tab="profileTiles"]').click();
    assert(await page.locator('#profile-catalogue').isVisible(), 'The lower profile-tile catalogue is not inside the unified editor.');
    assert(await page.locator('.profile-editor-preferences').isVisible(), 'Profile tile density and spacing controls are missing.');
    const existingProfileTileSettings = page.locator('.profile-tile-settings-button').first();
    if (await existingProfileTileSettings.count()) {
      await existingProfileTileSettings.click();
    } else {
      await page.locator('#profile-catalogue [data-add-profile-tile="text"]').click();
    }
    assert(await page.locator('#profile-tile-dialog[open]').count() === 1, 'Lower profile-tile settings were not mounted inline.');
    assert(await page.locator('dialog:modal').count() === 0, 'Lower profile-tile settings opened as a blocking modal.');
    checkpoint('profile tile section');

    await page.locator('.profile-unified-tabs [data-unified-tab="card"]').focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('.profile-unified-tabs [data-unified-tab="cardTiles"]').getAttribute('aria-selected') === 'true', 'Arrow-key tab navigation did not select the next section.');
    await page.keyboard.press('End');
    assert(await page.locator('.profile-unified-tabs [data-unified-tab="profileTiles"]').getAttribute('aria-selected') === 'true', 'End did not select the final editor section.');
    checkpoint('keyboard navigation');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-unified-preview]').waitFor({ state: 'visible' });
    await page.locator('[data-unified-preview]').click();
    assert(await page.locator('#profile-unified-editor.is-collapsed').count() === 1, 'The mobile Preview action did not collapse the editor.');
    assert(await page.locator('[data-unified-preview]').getAttribute('aria-expanded') === 'false', 'The collapsed mobile editor state is not exposed accessibly.');
    await page.locator('[data-unified-preview]').click();
    assert(await page.locator('#profile-unified-editor.is-collapsed').count() === 0, 'The mobile editor did not reopen.');
    checkpoint('mobile preview toggle');

    await page.locator('[data-unified-cancel]').click();
    await page.locator('#profile-unified-editor').waitFor({ state: 'hidden' });
    assert(await page.locator('dialog:modal').count() === 0, 'A blocking modal remained after Cancel.');

    const afterResponse = await context.request.get(`${base}/api/profiles/${encodeURIComponent(profileId)}`);
    assert(afterResponse.status() === 200, 'The profile API did not reload after Cancel.');
    const after = (await afterResponse.json()).profile;
    for (const key of Object.keys(snapshots)) {
      assert(JSON.stringify(after[key] ?? (key.endsWith('Tiles') ? [] : null)) === snapshots[key], `Cancel changed the saved ${key} data.`);
    }
    checkpoint('cancel restoration');

    const dashboard = await context.request.get(`${base}/api/dashboard`);
    assert(dashboard.status() === 200, 'The existing dashboard API is no longer compatible.');
    checkpoint('dashboard compatibility');

    console.log('Live unified profile editor verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
