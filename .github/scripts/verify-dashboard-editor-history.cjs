const { chromium } = require('playwright');

const pbe = 'https://pbe.grev.dad';
const branch = 'https://agent-dashboard-editor-history-grev-dad-site.joeahh.workers.dev';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);

(async () => {
  const assetResponse = await fetch(`${branch}/dashboard.js?verify=${Date.now()}`);
  assert(assetResponse.ok, `Branch dashboard bundle returned ${assetResponse.status}.`);
  const dashboardBundle = await assetResponse.text();
  assert(dashboardBundle.includes('dashboard-history-tools'), 'Branch dashboard bundle does not contain the history controller.');
  assert(dashboardBundle.includes('textEditing'), 'Branch dashboard bundle does not contain the text-undo safeguard.');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    const login = await context.request.post(`${pbe}/api/auth/login`, {
      data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
    });
    assert(login.status() === 200, `PBE login failed (${login.status()}).`);
    const beforeResponse = await context.request.get(`${pbe}/api/dashboard`);
    assert(beforeResponse.status() === 200, 'Dashboard API did not load before verification.');
    const before = await beforeResponse.json();
    const beforeSnapshot = JSON.stringify({ pinnedTiles: before.pinnedTiles, preferences: before.preferences });

    await page.route('**/dashboard.js', route => route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: dashboardBundle }));
    await page.goto(`${pbe}/dashboard`, { waitUntil: 'networkidle' });
    await page.locator('#customize-dashboard').click();
    await page.locator('#dashboard-history-tools').waitFor({ state: 'visible' });

    assert(await page.locator('#dashboard-undo-layout').isDisabled(), 'Undo should start disabled.');
    assert(await page.locator('#dashboard-redo-layout').isDisabled(), 'Redo should start disabled.');
    checkpoint('history controls mounted');

    const gap = page.locator('#dashboard-tile-gap');
    const originalGap = await gap.inputValue();
    const changedGap = originalGap === '24' ? '20' : '24';
    await gap.dispatchEvent('pointerdown');
    await gap.selectOption(changedGap);
    await page.waitForTimeout(350);
    assert(!(await page.locator('#dashboard-undo-layout').isDisabled()), 'Preference change did not create an undo entry.');
    assert((await page.evaluate(() => localStorage.key(0)))?.startsWith('grev-dashboard-draft:'), 'Preference change did not create a local draft.');

    await page.locator('#dashboard-undo-layout').click();
    assert(await gap.inputValue() === originalGap, 'Undo did not restore the previous tile gap.');
    assert(!(await page.locator('#dashboard-redo-layout').isDisabled()), 'Undo did not enable Redo.');
    await page.locator('#dashboard-redo-layout').click();
    assert(await gap.inputValue() === changedGap, 'Redo did not reapply the tile gap.');
    checkpoint('preference undo and redo');

    const settingsButtons = page.locator('.dashboard-tile-settings');
    assert(await settingsButtons.count() >= 2, 'Verification requires at least two dashboard tiles.');
    await settingsButtons.nth(0).click();
    await page.locator('#dashboard-copy-style').click();
    await page.locator('#dashboard-close-tile-settings').click();
    await settingsButtons.nth(1).click();
    assert(!(await page.locator('#dashboard-paste-style').isDisabled()), 'Copied style was not available for a second tile.');
    const targetBefore = await page.evaluate(() => {
      const tile = dashboardState.workingTiles.find(item => item.featureId === dashboardState.selectedId);
      return tile ? JSON.stringify({ backgroundType: tile.backgroundType, backgroundPrimary: tile.backgroundPrimary, textColour: tile.textColour, fontFamily: tile.fontFamily }) : null;
    });
    await page.locator('#dashboard-paste-style').click();
    const targetAfter = await page.evaluate(() => {
      const tile = dashboardState.workingTiles.find(item => item.featureId === dashboardState.selectedId);
      return tile ? JSON.stringify({ backgroundType: tile.backgroundType, backgroundPrimary: tile.backgroundPrimary, textColour: tile.textColour, fontFamily: tile.fontFamily }) : null;
    });
    assert(targetAfter, 'Paste style lost the selected tile.');
    assert(!(await page.locator('#dashboard-undo-layout').isDisabled()), 'Paste style did not create an undo entry.');
    checkpoint(`copy and paste style${targetBefore === targetAfter ? ' (styles already matched)' : ''}`);

    const contentMode = page.locator('#dashboard-content-mode');
    await contentMode.selectOption('media-button');
    const titleInput = page.locator('#dashboard-custom-title');
    await titleInput.waitFor({ state: 'visible' });
    await titleInput.fill('History verification text');
    const messageBeforeTextUndo = await page.locator('#dashboard-editor-message').textContent();
    await titleInput.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
    const messageAfterTextUndo = await page.locator('#dashboard-editor-message').textContent();
    assert(!String(messageAfterTextUndo).startsWith('Undid:'), 'Dashboard shortcut intercepted native text-field undo.');
    assert(messageAfterTextUndo === messageBeforeTextUndo || !String(messageAfterTextUndo).startsWith('Undid:'), 'Text undo changed dashboard history messaging.');
    await page.locator('#dashboard-close-tile-settings').click();
    checkpoint('native text-field undo preserved');

    await page.locator('#dashboard-cancel-layout').click();
    await page.locator('#customize-dashboard').waitFor({ state: 'visible' });
    await page.locator('#customize-dashboard').click();
    await page.locator('#dashboard-restore-draft').waitFor({ state: 'visible' });
    assert(!(await page.locator('#dashboard-restore-draft').isDisabled()), 'Recoverable draft was not offered after reopening the editor.');
    await page.locator('#dashboard-restore-draft').click();
    assert(await gap.inputValue() === changedGap, 'Restore draft did not recover the changed preference.');
    await page.locator('#dashboard-discard-draft').click();
    assert(await page.locator('#dashboard-restore-draft').isDisabled(), 'Discard draft did not remove the recoverable draft.');
    checkpoint('draft recovery and discard');

    await page.locator('#dashboard-cancel-layout').click();
    const afterResponse = await context.request.get(`${pbe}/api/dashboard`);
    assert(afterResponse.status() === 200, 'Dashboard API did not reload after verification.');
    const after = await afterResponse.json();
    const afterSnapshot = JSON.stringify({ pinnedTiles: after.pinnedTiles, preferences: after.preferences });
    assert(afterSnapshot === beforeSnapshot, 'Verification changed the saved dashboard despite cancelling.');
    checkpoint('cancel left saved dashboard unchanged');

    console.log('Dashboard editor history verification passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
