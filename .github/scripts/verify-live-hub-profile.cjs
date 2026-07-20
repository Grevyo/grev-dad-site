const { chromium } = require('playwright');
const base = 'https://pbe.grev.dad';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`LIVE CHECKPOINT: ${message}`);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  try {
    const login = await context.request.post(`${base}/api/auth/login`, {
      data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
    });
    assert(login.status() === 200, `PBE login failed (${login.status()}).`);
    const sessionResponse = await context.request.get(`${base}/api/auth/session`);
    const session = await sessionResponse.json();
    const profileId = session.user?.id;
    assert(profileId, 'PBE session has no user ID.');

    const hub = await context.newPage();
    hub.on('pageerror', error => errors.push(`hub: ${error.message}`));
    await hub.goto(`${base}/hub`, { waitUntil: 'networkidle' });
    await hub.locator('.hub-shell').waitFor({ state: 'visible' });
    assert(await hub.locator('#hub-tabs').count() === 1, 'Content Hub tabs are missing.');
    assert(await hub.locator('#hub-create').count() === 1, 'Content Hub create action is missing.');
    assert(await hub.locator('#grev-chat-panel').count() === 1, 'Content Hub chat panel is missing or duplicated.');
    assert(await hub.locator('#global-notification-button').count() === 1, 'Content Hub notification launcher is missing or duplicated.');
    checkpoint('live Content Hub');

    const profile = await context.newPage();
    profile.on('pageerror', error => errors.push(`profile: ${error.message}`));
    await profile.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    await profile.locator('.profile-card-xp .chat-xp').waitFor({ state: 'visible' });
    await profile.locator('#profile-achievements').waitFor({ state: 'visible' });
    assert(await profile.locator('#profile-achievements .profile-achievement img').count() >= 8, 'Achievement artwork is not rendered.');
    assert(await profile.locator('#grev-chat-panel').count() === 1, 'Profile chat panel is missing or duplicated.');
    checkpoint('live Profile XP and achievements');

    assert(errors.length === 0, `Live browser errors: ${errors.join(' | ')}`);
    console.log(`LIVE PBE HUB PROFILE=PASS user=${profileId}`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(`LIVE PBE HUB PROFILE=FAIL ${error.stack || error.message || error}`);
  process.exit(1);
});
