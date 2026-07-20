const { chromium } = require('playwright');

const base = 'http://127.0.0.1:8787';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`HARDENING: ${message}`);

async function login(browser, suffix) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const response = await context.request.post(`${base}/api/auth/login`, {
    data: { identifier: `experience_${suffix}`, password: `ExperiencePass-${suffix}-2026!`, rememberMe: false }
  });
  assert(response.status() === 200, `${suffix} login failed.`);
  const session = await context.request.get(`${base}/api/auth/session`);
  const payload = await session.json();
  return { context, id: payload.user.id };
}

async function api(request, method, path, data) {
  const response = await request.fetch(`${base}${path}`, {
    method,
    headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    data
  });
  const payload = await response.json();
  if (!response.ok()) throw new Error(`${method} ${path}: ${payload.message || response.status()}`);
  return payload;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let owner;
  let visitor;
  try {
    owner = await login(browser, 'owner');
    visitor = await login(browser, 'visitor');
    const dashboard = await api(visitor.context.request, 'GET', '/api/dashboard');

    let visitorPages = await api(visitor.context.request, 'POST', '/api/experience/dashboard/pages', {
      name: 'Visitor private page',
      scope: 'personal',
      layout: { tiles: [], preferences: dashboard.preferences }
    });
    const visitorPage = visitorPages.pages.find(page => page.name === 'Visitor private page');
    assert(visitorPage, 'Visitor personal page was not created.');
    const ownerPages = await api(owner.context.request, 'GET', '/api/experience/dashboard/pages');
    assert(!ownerPages.pages.some(page => page.id === visitorPage.id), 'Admin can see another user’s personal dashboard page.');
    checkpoint('personal dashboard pages isolated from admins');

    let ownerPagesAfterCreate = await api(owner.context.request, 'POST', '/api/experience/dashboard/pages', {
      name: 'Metadata hardening',
      scope: 'personal',
      layout: {
        tiles: [{
          featureId: 'feature-live-clock', x: 0, y: 0, width: 2, height: 1,
          route: 'https://attacker.invalid', name: 'Injected name', presentation: 'action',
          backgroundType: 'solid', backgroundPrimary: '#123456'
        }],
        preferences: dashboard.preferences
      }
    });
    const hardenedPage = ownerPagesAfterCreate.pages.find(page => page.name === 'Metadata hardening');
    const savedTile = hardenedPage.layout.tiles[0];
    assert(savedTile.featureId === 'feature-live-clock', 'Feature ID was not preserved.');
    assert(savedTile.backgroundPrimary === '#123456', 'Allowed appearance field was lost.');
    assert(!('route' in savedTile) && !('name' in savedTile) && !('presentation' in savedTile), 'Untrusted feature metadata was persisted.');
    checkpoint('dashboard page tile metadata whitelisted');

    await api(owner.context.request, 'PUT', '/api/profile/privacy', {
      fields: {
        bio: { visibility: 'private', groupId: null },
        username: { visibility: 'private', groupId: null },
        status: { visibility: 'private', groupId: null },
        memberSince: { visibility: 'private', groupId: null }
      },
      tiles: {},
      interactions: { guestbookEnabled: true, reactionsEnabled: true }
    });
    const hidden = await api(visitor.context.request, 'GET', `/api/profiles/${encodeURIComponent(owner.id)}`);
    assert(hidden.profile.username === null, 'Private username remains in root profile JSON.');
    assert(hidden.profile.createdAt === null, 'Private member-since date remains in root profile JSON.');
    assert(hidden.profile.isVerified === null && hidden.profile.isOwner === null && hidden.profile.isAdmin === null, 'Private status flags remain in root profile JSON.');
    checkpoint('private identity fields removed from JSON');

    const page = await owner.context.newPage();
    await page.goto(`${base}/profile/${encodeURIComponent(owner.id)}`, { waitUntil: 'networkidle' });
    await page.locator('#profile-edit').click();
    const editor = page.locator('#profile-unified-editor');
    await editor.waitFor({ state: 'visible' });
    const profileTilesTab = editor.locator('[data-unified-tab="profileTiles"]');
    await profileTilesTab.focus();
    await page.keyboard.press('ArrowRight');
    const privacy = editor.locator('[data-unified-tab="privacy"]');
    assert(await privacy.getAttribute('aria-selected') === 'true', 'ArrowRight from Profile tiles did not reach Privacy.');
    await editor.locator('#profile-cancel').click();
    checkpoint('five-tab keyboard navigation');

    await api(visitor.context.request, 'DELETE', `/api/experience/dashboard/pages/${encodeURIComponent(visitorPage.id)}`);
    await api(owner.context.request, 'DELETE', `/api/experience/dashboard/pages/${encodeURIComponent(hardenedPage.id)}`);
    console.log('Experience hardening verification passed.');
  } finally {
    await owner?.context.close();
    await visitor?.context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(`HARDENING FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
