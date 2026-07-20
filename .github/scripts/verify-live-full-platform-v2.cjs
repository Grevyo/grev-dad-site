const { chromium } = require('playwright');
const base = 'https://pbe.grev.dad';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`LIVE CHECKPOINT: ${message}`);

async function api(request, method, path, data) {
  const response = await request.fetch(`${base}${path}`, {
    method,
    headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    data
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status() < 200 || response.status() >= 300) {
    throw new Error(`${method} ${path} failed (${response.status()}): ${payload.message || JSON.stringify(payload)}`);
  }
  return payload;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  try {
    const login = await context.request.post(`${base}/api/auth/login`, {
      data: { identifier: 'LADMIN', password: process.env.LADMIN_BOOTSTRAP_PASSWORD, rememberMe: false }
    });
    const loginBody = await login.json().catch(() => ({}));
    assert(login.status() === 200, `PBE login failed (${login.status()}): ${JSON.stringify(loginBody)}`);
    const session = await api(context.request, 'GET', '/api/auth/session');
    const profileId = session.user?.id;
    assert(profileId, 'PBE session has no user ID.');

    const [dashboard, modules, notifications, rooms, progression, pages, layouts] = await Promise.all([
      api(context.request, 'GET', '/api/dashboard'),
      api(context.request, 'GET', '/api/platform/modules'),
      api(context.request, 'GET', '/api/platform/notifications'),
      api(context.request, 'GET', '/api/chat/rooms'),
      api(context.request, 'GET', `/api/progression/${encodeURIComponent(profileId)}`),
      api(context.request, 'GET', '/api/experience/dashboard/pages'),
      api(context.request, 'GET', '/api/dashboard/layouts/home')
    ]);
    const featureIds = new Set(dashboard.features.map(feature => feature.id));
    for (const id of ['feature-module-tasks','feature-module-projects','feature-chat-global','feature-chat-groups','feature-chat-direct','feature-achievements']) {
      assert(featureIds.has(id), `${id} is missing from the live Dashboard catalogue.`);
    }
    assert(modules.byType && Array.isArray(modules.byType.task), 'Functional module API is not active.');
    assert(Array.isArray(notifications.notifications), 'Notification API is not active.');
    assert(rooms.rooms.some(room => room.id === 'chat-global'), 'Global chat room is missing on PBE.');
    assert(progression.profile?.level >= 1 && progression.achievements?.length >= 8, 'Progression or achievement API is incomplete.');
    assert(pages.pages.some(item => item.id === 'home'), 'Dashboard pages API is incomplete.');
    assert(layouts.pageKey === 'home' && layouts.layouts && typeof layouts.layouts === 'object' && !Array.isArray(layouts.layouts), 'Responsive layout API shape is invalid.');
    checkpoint('authenticated APIs and migrations live');

    const dashboardPage = await context.newPage();
    dashboardPage.on('pageerror', error => pageErrors.push(`dashboard: ${error.message}`));
    await dashboardPage.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    assert(await dashboardPage.locator('#grev-chat-panel').count() === 1, 'Dashboard has duplicate chat panels.');
    assert(await dashboardPage.locator('#global-notification-button').count() === 1, 'Dashboard notification launcher is missing or duplicated.');
    assert(await dashboardPage.locator('#global-content-hub-link').count() === 1, 'Dashboard Content Hub link is missing.');
    await dashboardPage.locator('#customize-dashboard').click();
    await dashboardPage.locator('#dashboard-editor-toolbar').waitFor({ state: 'visible' });
    await dashboardPage.locator('#dashboard-advanced-tools').waitFor({ state: 'visible' });
    for (const selector of ['#dashboard-multi-select','#dashboard-duplicate-tiles','#dashboard-copy-tiles','#dashboard-paste-tiles','#dashboard-layout-versions','[data-dashboard-mode="desktop"]','[data-dashboard-mode="mobile"]']) {
      assert(await dashboardPage.locator(selector).count() === 1, `${selector} is missing from the live advanced editor.`);
    }
    await dashboardPage.locator('#dashboard-cancel-layout').click();
    await dashboardPage.locator('#grev-chat-launcher').click();
    await dashboardPage.locator('#grev-chat-panel').waitFor({ state: 'visible' });
    await dashboardPage.locator('.grev-chat-room[data-room-id="chat-global"]').click();
    await dashboardPage.locator('[data-chat-minimise]').click();
    await dashboardPage.locator('#grev-chat-dock').waitFor({ state: 'visible' });
    await dashboardPage.locator('#grev-chat-dock').click();
    await dashboardPage.locator('#grev-chat-panel').waitFor({ state: 'visible' });
    checkpoint('live Dashboard editor and minimisable chat');

    const hubPage = await context.newPage();
    hubPage.on('pageerror', error => pageErrors.push(`hub: ${error.message}`));
    await hubPage.goto(`${base}/hub`, { waitUntil: 'networkidle' });
    await hubPage.locator('#hub-root').waitFor({ state: 'visible' });
    assert(await hubPage.locator('[data-hub-tab="tasks"]').count() === 1, 'Content Hub task tab is missing.');
    assert(await hubPage.locator('[data-hub-tab="projects"]').count() === 1, 'Content Hub project tab is missing.');
    assert(await hubPage.locator('#grev-chat-panel').count() === 1, 'Content Hub has duplicate chat panels.');
    checkpoint('live Content Hub');

    const profilePage = await context.newPage();
    profilePage.on('pageerror', error => pageErrors.push(`profile: ${error.message}`));
    await profilePage.goto(`${base}/profile/${encodeURIComponent(profileId)}`, { waitUntil: 'networkidle' });
    await profilePage.locator('.profile-card-xp .chat-xp').waitFor({ state: 'visible' });
    await profilePage.locator('#profile-achievements').waitFor({ state: 'visible' });
    assert(await profilePage.locator('#profile-achievements .profile-achievement img').count() >= 8, 'Achievement artwork is not rendered on the live profile.');
    assert(await profilePage.locator('#grev-chat-panel').count() === 1, 'Profile has duplicate chat panels.');
    checkpoint('live profile XP and achievements');

    assert(pageErrors.length === 0, `Live browser errors: ${pageErrors.join(' | ')}`);
    console.log(`LIVE PBE FULL PLATFORM=PASS user=${profileId} level=${progression.profile.level} xp=${progression.profile.totalXp}`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(`LIVE PBE FULL PLATFORM=FAIL ${error.stack || error.message || error}`);
  process.exit(1);
});
