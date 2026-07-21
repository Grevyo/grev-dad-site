const { chromium } = require('playwright');

const base = 'http://127.0.0.1:8787';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);

async function jsonRequest(request, method, path, data) {
  const response = await request.fetch(`${base}${path}`, {
    method,
    headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    data
  });
  const body = await response.json();
  if (!response.ok()) throw new Error(`${method} ${path} failed (${response.status()}): ${body.message || JSON.stringify(body)}`);
  return body;
}

function onboardingLists(payload) {
  const relationships = payload.relationshipOptions || payload.relationships || payload.options?.relationships || [];
  const intentions = payload.intentionOptions || payload.intentions || payload.options?.intentions || [];
  return { relationships, intentions };
}

async function completeOnboarding(request) {
  const onboarding = await jsonRequest(request, 'GET', '/api/onboarding');
  const { relationships, intentions } = onboardingLists(onboarding);
  assert(relationships.length, `No relationship options in onboarding payload: ${JSON.stringify(onboarding)}`);
  assert(intentions.length, `No intention options in onboarding payload: ${JSON.stringify(onboarding)}`);
  await jsonRequest(request, 'POST', '/api/onboarding/relationship', { relationshipId: relationships[0].id });
  await jsonRequest(request, 'POST', '/api/onboarding/intentions', { intentionIds: intentions.slice(0, 2).map(item => item.id) });
}

async function createUser(browser, suffix, owner = false) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const password = `ExperiencePass-${suffix}-2026!`;
  const username = `experience_${suffix}`;
  const signup = await context.request.post(`${base}/api/auth/signup`, {
    data: { username, displayName: `Experience ${suffix}`, email: `${username}@example.test`, password, rememberMe: false }
  });
  const signupBody = await signup.json();
  assert(signup.status() === 201, `Signup failed: ${signup.status()} ${JSON.stringify(signupBody)}`);
  await completeOnboarding(context.request);
  if (owner) await jsonRequest(context.request, 'POST', '/api/bootstrap/owner', { password });
  const session = await jsonRequest(context.request, 'GET', '/api/auth/session');
  assert(session.user?.id, 'New user session has no ID.');
  return { context, password, username, id: session.user.id };
}

async function saveBioAndPrivacy(user) {
  const profilePayload = await jsonRequest(user.context.request, 'GET', `/api/profiles/${encodeURIComponent(user.id)}`);
  const profile = profilePayload.profile;
  const card = { ...profile.card, bio: 'This biography is private to the profile owner.' };
  const save = await jsonRequest(user.context.request, 'PUT', '/api/profile', {
    card,
    tiles: profile.tiles || [],
    preferences: profile.preferences,
    cardTiles: profile.cardTiles || [],
    design: profile.design
  });
  assert(save.profile?.card?.bio, 'Profile biography was not saved.');
  const privacy = await jsonRequest(user.context.request, 'PUT', '/api/profile/privacy', {
    fields: { bio: { visibility: 'private', groupId: null } },
    tiles: {},
    interactions: { guestbookEnabled: true, reactionsEnabled: true }
  });
  assert(privacy.fields.bio.visibility === 'private', 'Biography privacy was not saved.');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let owner;
  let visitor;
  try {
    owner = await createUser(browser, 'owner', true);
    visitor = await createUser(browser, 'visitor', false);
    checkpoint('two onboarded accounts');

    const dashboard = await jsonRequest(owner.context.request, 'GET', '/api/dashboard');
    const featureIds = new Set(dashboard.features.map(feature => feature.id));
    for (const featureId of ['feature-live-clock','feature-live-activity','feature-quick-profile','feature-quick-page','feature-quick-guestbook','feature-quick-theme']) {
      assert(featureIds.has(featureId), `${featureId} is missing from dashboard features.`);
    }

    let pages = await jsonRequest(owner.context.request, 'GET', '/api/experience/dashboard/pages');
    assert(pages.pages.some(page => page.id === 'home'), 'Home dashboard page is missing.');
    pages = await jsonRequest(owner.context.request, 'POST', '/api/experience/dashboard/pages', {
      name: 'Gaming', scope: 'personal', layout: { tiles: [], preferences: dashboard.preferences }
    });
    const gaming = pages.pages.find(page => page.name === 'Gaming');
    assert(gaming && pages.activePageId === gaming.id, 'Personal dashboard page was not created and activated.');
    pages = await jsonRequest(owner.context.request, 'PUT', `/api/experience/dashboard/pages/${encodeURIComponent(gaming.id)}`, {
      name: 'Gaming & Servers',
      layout: {
        tiles: [{ featureId: 'feature-live-clock', x: 0, y: 0, width: 2, height: 1 }],
        preferences: dashboard.preferences
      }
    });
    assert(pages.pages.find(page => page.id === gaming.id)?.layout.tiles.length === 1, 'Dashboard page layout was not updated.');
    const live = await jsonRequest(owner.context.request, 'GET', '/api/experience/dashboard/live');
    assert(Array.isArray(live.activity) && typeof live.summary.groupCount === 'number', 'Live dashboard payload is invalid.');
    checkpoint('dashboard pages and live APIs');

    await saveBioAndPrivacy(owner);
    const filtered = await jsonRequest(visitor.context.request, 'GET', `/api/profiles/${encodeURIComponent(owner.id)}`);
    assert(filtered.profile.card.bio === null, 'Private biography leaked to another account.');

    let interactions = await jsonRequest(visitor.context.request, 'POST', `/api/profiles/${encodeURIComponent(owner.id)}/guestbook`, { message: 'Hello from the visitor account.' });
    assert(interactions.entries.some(entry => entry.message.includes('visitor')), 'Guestbook message was not created.');
    interactions = await jsonRequest(visitor.context.request, 'POST', `/api/profiles/${encodeURIComponent(owner.id)}/reaction`, { reaction: 'wave' });
    assert(interactions.ownReaction === 'wave' && interactions.reactions.wave === 1, 'Profile reaction was not stored.');
    checkpoint('privacy, guestbook and reactions APIs');

    const dashboardPage = await owner.context.newPage();
    const errors = [];
    dashboardPage.on('pageerror', error => errors.push(`dashboard: ${error.message}`));
    await dashboardPage.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await dashboardPage.locator('#dashboard-page-bar').waitFor({ state: 'visible' });
    assert(await dashboardPage.locator('.dashboard-page-tab').count() >= 2, 'Dashboard page tabs were not rendered.');
    await dashboardPage.locator('#dashboard-manage-pages').click();
    await dashboardPage.locator('#dashboard-page-manager').waitFor({ state: 'visible' });
    await dashboardPage.locator('[data-close-pages]').click();
    await dashboardPage.locator('#customize-dashboard').click();
    await dashboardPage.locator('#dashboard-editor-toolbar').waitFor({ state: 'visible' });
    for (const selector of ['#dashboard-undo-layout','#dashboard-redo-layout','#dashboard-copy-style','#dashboard-paste-style']) {
      assert(await dashboardPage.locator(selector).count() === 1, `${selector} is missing from the dashboard editor.`);
    }
    await dashboardPage.locator('#dashboard-cancel-layout').click();
    checkpoint('dashboard page bar and editing tools UI');

    const profilePage = await owner.context.newPage();
    profilePage.on('pageerror', error => errors.push(`profile: ${error.message}`));
    await profilePage.goto(`${base}/profile/${encodeURIComponent(owner.id)}`, { waitUntil: 'networkidle' });
    await profilePage.locator('#profile-interactions').waitFor({ state: 'visible' });
    assert(await profilePage.locator('#profile-guestbook-list .profile-guestbook-entry').count() === 1, 'Guestbook entry is not visible on the profile.');
    assert(await profilePage.locator('[data-profile-reaction="wave"] b').textContent() === '1', 'Reaction count is not visible on the profile.');
    await profilePage.locator('.profile-guestbook-author').click();
    await profilePage.locator('#global-profile-card-popover').waitFor({ state: 'visible' });
    await profilePage.locator('.global-profile-card-close').click();

    await profilePage.locator('#profile-edit').click();
    const editor = profilePage.locator('#profile-unified-editor');
    await editor.waitFor({ state: 'visible' });
    await editor.locator('[data-unified-tab="page"]').click();
    assert(await editor.locator('#profile-theme-starters .profile-theme-card').count() === 6, 'Profile themes were not rendered.');
    await editor.locator('.profile-theme-card[data-theme-id="terminal"]').click();
    await editor.locator('[data-unified-tab="profileTiles"]').click();
    assert(await editor.locator('#profile-homepage-starters [data-profile-starter="homepage"]').count() === 1, 'Homepage starters were not rendered.');
    const beforeTiles = profileStateLength = await profilePage.evaluate(() => profileState.working.tiles.length);
    await editor.locator('[data-profile-starter="homepage"]').click();
    const afterTiles = await profilePage.evaluate(() => profileState.working.tiles.length);
    assert(afterTiles === beforeTiles + 4, 'Full homepage starter did not add four sections.');
    await editor.locator('[data-unified-tab="privacy"]').click();
    await editor.locator('#profile-privacy-panel').waitFor({ state: 'visible' });
    assert(await editor.locator('.profile-privacy-row[data-privacy-key="bio"] .profile-privacy-visibility').inputValue() === 'private', 'Saved field privacy is not shown in the editor.');
    await editor.locator('#profile-cancel').click();
    checkpoint('profile homepage, themes, privacy and mini cards UI');

    assert(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);

    pages = await jsonRequest(owner.context.request, 'DELETE', `/api/experience/dashboard/pages/${encodeURIComponent(gaming.id)}`);
    assert(!pages.pages.some(page => page.id === gaming.id), 'Temporary dashboard page was not deleted.');
    checkpoint('cleanup');
    console.log('Experience foundation local verification passed.');
  } finally {
    await owner?.context.close();
    await visitor?.context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
