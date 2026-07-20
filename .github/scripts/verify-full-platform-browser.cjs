const { chromium } = require('playwright');

const base = 'http://127.0.0.1:8787';
const assert = (value, message) => { if (!value) throw new Error(message); };
const checkpoint = message => console.log(`CHECKPOINT: ${message}`);
const tinyGif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

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

function onboardingLists(payload) {
  return {
    relationships: payload.relationshipOptions || payload.relationships || payload.options?.relationships || [],
    intentions: payload.intentionOptions || payload.intentions || payload.options?.intentions || []
  };
}

async function onboard(request, selection = null) {
  const payload = await api(request, 'GET', '/api/onboarding');
  const lists = onboardingLists(payload);
  assert(lists.relationships.length, `No onboarding relationship options: ${JSON.stringify(payload)}`);
  assert(lists.intentions.length, `No onboarding intention options: ${JSON.stringify(payload)}`);
  const relationshipId = selection?.relationshipId || lists.relationships[0].id;
  const intentionIds = selection?.intentionIds || lists.intentions.slice(0, 2).map(item => item.id);
  await api(request, 'POST', '/api/onboarding/relationship', { relationshipId });
  await api(request, 'POST', '/api/onboarding/intentions', { intentionIds });
  return { relationshipId, intentionIds };
}

async function createUser(browser, suffix, selection = null, owner = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const username = `platform_${suffix}`;
  const password = `Platform-${suffix}-Pass-2026!`;
  const signup = await context.request.post(`${base}/api/auth/signup`, {
    data: { username, displayName: `Platform ${suffix}`, email: `${username}@example.test`, password, rememberMe: false }
  });
  const signupBody = await signup.json().catch(() => ({}));
  assert(signup.status() === 201, `Signup ${suffix} failed (${signup.status()}): ${JSON.stringify(signupBody)}`);
  const choices = await onboard(context.request, selection);
  if (owner) await api(context.request, 'POST', '/api/bootstrap/owner', { password });
  const session = await api(context.request, 'GET', '/api/auth/session');
  assert(session.user?.id, `${suffix} session has no user ID.`);
  return { context, username, password, id: session.user.id, choices };
}

async function createItem(user, payload) {
  return api(user.context.request, 'POST', '/api/platform/items', payload);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let owner;
  let visitor;
  const browserErrors = [];
  try {
    owner = await createUser(browser, 'owner', null, true);
    visitor = await createUser(browser, 'visitor', owner.choices, false);
    checkpoint('two onboarded accounts created');

    const ownerPagesInitial = await api(owner.context.request, 'GET', '/api/experience/dashboard/pages');
    const visitorPagesInitial = await api(visitor.context.request, 'GET', '/api/experience/dashboard/pages');
    const sharedGroup = ownerPagesInitial.groups.find(group => visitorPagesInitial.groups.some(other => other.id === group.id));
    assert(sharedGroup, 'The two onboarding accounts did not share a group.');
    checkpoint(`shared group available: ${sharedGroup.name}`);

    const task = (await createItem(owner, {
      type: 'task', title: 'Finish platform verification', body: 'Exercise the functional dashboard and chat systems.',
      visibility: 'private', data: { priority: 'high', progress: 25 }
    })).item;
    await createItem(owner, {
      type: 'event', title: 'Platform review', body: 'Review the new feature suite.', visibility: 'account',
      startsAt: Math.floor(Date.now() / 1000) + 3600, endsAt: Math.floor(Date.now() / 1000) + 7200,
      data: { location: 'Grev.dad', allDay: false }
    });
    await createItem(owner, {
      type: 'project', title: 'Grev.dad community platform', body: 'Dashboard, profile, chat and progression.', visibility: 'account',
      data: { status: 'active', progress: 70, url: 'https://pbe.grev.dad' }
    });
    const media = (await createItem(owner, {
      type: 'media', title: 'Verification GIF', body: 'Reusable one-pixel GIF.', visibility: 'account',
      data: { mediaUrl: tinyGif, alt: 'Verification GIF', category: 'test' }
    })).item;
    assert(media.data.mediaUrl === tinyGif, 'Uploaded media data URL was altered or truncated.');
    const announcement = (await createItem(owner, {
      type: 'announcement', title: 'Group platform test', body: 'The shared group announcement system is active.',
      visibility: 'group', groupId: sharedGroup.id, data: { importance: 'important' }
    })).item;
    await api(owner.context.request, 'PUT', `/api/platform/items/${encodeURIComponent(task.id)}`, { completed: true });
    await api(owner.context.request, 'PUT', '/api/platform/presence', {
      availability: 'online', statusText: 'Testing Grev.dad', activityType: 'working', activityText: 'Full platform upgrade'
    });
    const modules = await api(owner.context.request, 'GET', '/api/platform/modules');
    assert(modules.byType.task.some(item => item.id === task.id && item.completedAt), 'Completed task missing from functional module payload.');
    assert(modules.byType.media.some(item => item.id === media.id && item.data.mediaUrl === tinyGif), 'Media module did not preserve uploaded GIF.');
    const visitorNotifications = await api(visitor.context.request, 'GET', '/api/platform/notifications');
    assert(visitorNotifications.notifications.some(item => item.metadata?.itemId === announcement.id), 'Group announcement did not notify the other group member.');
    checkpoint('functional content, media, presence and notifications');

    const desktopLayout = {
      tiles: [
        { featureId: 'feature-module-tasks', x: 0, y: 0, width: 3, height: 2 },
        { featureId: 'instance-browser-test', sourceFeatureId: 'feature-live-clock', x: 3, y: 0, width: 2, height: 1, customTitle: 'Copied clock' }
      ],
      preferences: { density: 'comfortable', tileGap: 12, outerMargin: 0, showDescriptions: true }
    };
    const mobileLayout = {
      tiles: [
        { featureId: 'feature-module-tasks', x: 0, y: 0, width: 2, height: 2 },
        { featureId: 'feature-chat-global', x: 0, y: 2, width: 2, height: 2 }
      ],
      preferences: { density: 'compact', tileGap: 8, outerMargin: 0, showDescriptions: false }
    };
    await api(owner.context.request, 'PUT', '/api/dashboard/layouts/home/desktop', { layout: desktopLayout });
    await api(owner.context.request, 'PUT', '/api/dashboard/layouts/home/mobile', { layout: mobileLayout });
    const layouts = await api(owner.context.request, 'GET', '/api/dashboard/layouts/home');
    assert(layouts.layouts.desktop.layout.tiles.some(tile => tile.sourceFeatureId === 'feature-live-clock'), 'Duplicated tile sourceFeatureId did not persist.');
    assert(layouts.layouts.mobile.layout.tiles.length === 2, 'Separate mobile dashboard layout did not persist.');
    await api(owner.context.request, 'PUT', '/api/dashboard/drafts/home/desktop', { layout: desktopLayout });
    const draft = await api(owner.context.request, 'GET', '/api/dashboard/drafts/home/desktop');
    assert(draft.draft?.layout?.tiles?.length === 2, 'Dashboard autosaved draft API failed.');
    const versions = await api(owner.context.request, 'POST', '/api/dashboard/versions/home/desktop', { name: 'Browser checkpoint', layout: desktopLayout });
    assert(versions.versions.some(version => version.name === 'Browser checkpoint'), 'Named dashboard version was not saved.');
    checkpoint('desktop/mobile layouts, duplicate tiles, drafts and versions');

    let groupPages = await api(owner.context.request, 'POST', '/api/experience/dashboard/pages', {
      name: 'Shared platform room', scope: 'group', groupId: sharedGroup.id,
      layout: { tiles: [{ featureId: 'feature-chat-groups', x: 0, y: 0, width: 3, height: 2 }], preferences: desktopLayout.preferences }
    });
    const groupPage = groupPages.pages.find(page => page.name === 'Shared platform room');
    assert(groupPage, 'Group dashboard page was not created.');
    const search = await api(owner.context.request, 'GET', `/api/platform/users?q=${encodeURIComponent(visitor.username)}`);
    assert(search.users.some(user => user.id === visitor.id), 'Collaborator member search did not return the visitor.');
    await api(owner.context.request, 'PUT', `/api/dashboard/collaborators/${encodeURIComponent(groupPage.id)}`, {
      collaborators: [{ userId: visitor.id, permission: 'manage' }]
    });
    const visitorPages = await api(visitor.context.request, 'GET', '/api/experience/dashboard/pages');
    const sharedForVisitor = visitorPages.pages.find(page => page.id === groupPage.id);
    assert(sharedForVisitor?.canEdit && sharedForVisitor?.canManage && sharedForVisitor?.collaboratorPermission === 'manage', 'Manage collaborator permission was not exposed to the visitor dashboard.');
    const visitorGroupLayout = { tiles: [{ featureId: 'feature-module-announcements', x: 0, y: 0, width: 3, height: 2 }], preferences: desktopLayout.preferences };
    await api(visitor.context.request, 'PUT', `/api/dashboard/layouts/${encodeURIComponent(groupPage.id)}/desktop`, { layout: visitorGroupLayout });
    checkpoint('group dashboard collaboration and member search');

    const ownerRooms = await api(owner.context.request, 'GET', '/api/chat/rooms');
    const visitorRooms = await api(visitor.context.request, 'GET', '/api/chat/rooms');
    assert(ownerRooms.rooms.some(room => room.id === 'chat-global') && visitorRooms.rooms.some(room => room.id === 'chat-global'), 'Global chat is not available to every member.');
    const ownerGroupRoom = ownerRooms.rooms.find(room => room.type === 'group' && room.groupId === sharedGroup.id);
    const visitorGroupRoom = visitorRooms.rooms.find(room => room.type === 'group' && room.groupId === sharedGroup.id);
    assert(ownerGroupRoom && visitorGroupRoom && ownerGroupRoom.id === visitorGroupRoom.id, 'Shared group chat was not created for both members.');
    await api(owner.context.request, 'POST', '/api/chat/rooms/chat-global/messages', { type: 'text', body: 'Hello Global chat.' });
    await api(owner.context.request, 'POST', `/api/chat/rooms/${encodeURIComponent(ownerGroupRoom.id)}/messages`, { type: 'text', body: 'Hello group chat.' });
    const direct = await api(owner.context.request, 'POST', '/api/chat/direct', { userId: visitor.id });
    await api(owner.context.request, 'POST', `/api/chat/rooms/${encodeURIComponent(direct.roomId)}/messages`, { type: 'text', body: 'Direct platform message.' });
    await api(owner.context.request, 'POST', `/api/chat/rooms/${encodeURIComponent(direct.roomId)}/messages`, { type: 'gif', body: 'Verification GIF', mediaUrl: tinyGif });
    const visitorDirectRooms = await api(visitor.context.request, 'GET', '/api/chat/rooms');
    const visitorDirect = visitorDirectRooms.rooms.find(room => room.id === direct.roomId);
    assert(visitorDirect?.unread >= 2, 'Direct chat unread count did not include text and GIF messages.');
    const globalMessages = await api(visitor.context.request, 'GET', '/api/chat/rooms/chat-global/messages?after=0');
    assert(globalMessages.messages.some(message => message.body === 'Hello Global chat.'), 'Global message was not visible to the second member.');
    const directMessages = await api(visitor.context.request, 'GET', `/api/chat/rooms/${encodeURIComponent(direct.roomId)}/messages?after=0`);
    assert(directMessages.room.participant?.id === owner.id, 'Direct chat did not return the other user profile card.');
    assert(directMessages.messages.some(message => message.type === 'gif' && message.mediaUrl === tinyGif), 'GIF chat message was not preserved.');
    assert(directMessages.messages.every(message => message.sender.displayName && message.sender.role && message.sender.level >= 1), 'Chat sender identity is missing name, role or level.');
    checkpoint('global, group, direct, unread and GIF chat APIs');

    const ownerProgression = await api(owner.context.request, 'GET', `/api/progression/${encodeURIComponent(owner.id)}`);
    assert(ownerProgression.profile.totalXp >= 50 && ownerProgression.profile.level >= 1, 'Profile XP was not calculated from site activity.');
    assert(ownerProgression.achievements.length >= 8 && ownerProgression.achievements.every(item => item.image_url), 'Achievement catalogue or artwork is missing.');
    assert(ownerProgression.earned.length >= 1, 'No automatic achievements were unlocked.');
    checkpoint(`progression active at level ${ownerProgression.profile.level} with ${ownerProgression.profile.totalXp} XP`);

    const hubPage = await owner.context.newPage();
    hubPage.on('pageerror', error => browserErrors.push(`hub: ${error.message}`));
    await hubPage.goto(`${base}/hub`, { waitUntil: 'networkidle' });
    await hubPage.locator('[data-hub-tab="tasks"]').waitFor({ state: 'visible' });
    assert(await hubPage.locator('.hub-item-card').count() >= 1, 'Content Hub did not render existing functional items.');
    await hubPage.locator('#hub-create').click();
    await hubPage.locator('#hub-editor').waitFor({ state: 'visible' });
    await hubPage.locator('#hub-item-title').fill('Task created through browser UI');
    await hubPage.locator('#hub-item-body').fill('This confirms the Content Hub editor works in Chromium.');
    await hubPage.locator('#hub-editor-form').evaluate(form => form.requestSubmit());
    await hubPage.locator('#hub-editor').waitFor({ state: 'hidden' });
    await hubPage.getByText('Task created through browser UI', { exact: true }).waitFor({ state: 'visible' });
    assert(await hubPage.locator('#global-content-hub-link').count() === 1, 'Site-wide Content Hub header link is missing.');
    assert(await hubPage.locator('#global-notification-button').count() === 1, 'Site-wide notification launcher is missing.');
    assert(await hubPage.locator('#grev-chat-launcher').count() === 1, 'Header chat launcher is missing from the Content Hub.');
    checkpoint('Content Hub and site-wide header launchers UI');

    const dashboardPage = await owner.context.newPage();
    dashboardPage.on('pageerror', error => browserErrors.push(`dashboard: ${error.message}`));
    await dashboardPage.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
    await dashboardPage.locator('#dashboard-page-bar').waitFor({ state: 'visible' });
    await dashboardPage.locator('#customize-dashboard').click();
    await dashboardPage.locator('#dashboard-advanced-tools').waitFor({ state: 'visible' });
    for (const selector of ['#dashboard-multi-select','#dashboard-duplicate-tiles','#dashboard-copy-tiles','#dashboard-paste-tiles','#dashboard-align-left','#dashboard-layout-versions','[data-dashboard-mode="desktop"]','[data-dashboard-mode="mobile"]']) {
      assert(await dashboardPage.locator(selector).count() === 1, `${selector} is missing from the advanced dashboard editor.`);
    }
    const tileCountBefore = await dashboardPage.locator('#dashboard-grid .dashboard-tile').count();
    await dashboardPage.locator('#dashboard-grid .dashboard-tile').first().click();
    await dashboardPage.locator('#dashboard-duplicate-tiles').click();
    const tileCountAfter = await dashboardPage.locator('#dashboard-grid .dashboard-tile').count();
    assert(tileCountAfter === tileCountBefore + 1, 'Tile duplication did not add a second instance.');
    await dashboardPage.locator('#dashboard-cancel-layout').click();

    const groupTab = dashboardPage.locator(`.dashboard-page-tab[data-page-id="${groupPage.id}"]`);
    await groupTab.click();
    await dashboardPage.locator('#customize-dashboard').click();
    await dashboardPage.locator('#dashboard-collaborators').waitFor({ state: 'visible' });
    await dashboardPage.locator('#dashboard-collaborators').click();
    await dashboardPage.locator('#dashboard-collaboration-dialog').waitFor({ state: 'visible' });
    assert(await dashboardPage.locator(`#dashboard-collaborator-list [data-user-id="${visitor.id}"]`).count() === 1, 'Assigned collaborator is missing from the collaboration dialog.');
    await dashboardPage.locator('[data-collaboration-close]').first().click();
    await dashboardPage.locator('#dashboard-cancel-layout').click();

    await dashboardPage.locator('#grev-chat-launcher').click();
    await dashboardPage.locator('#grev-chat-panel').waitFor({ state: 'visible' });
    await dashboardPage.locator('.grev-chat-room[data-room-id="chat-global"]').click();
    await dashboardPage.getByText('Hello Global chat.', { exact: true }).waitFor({ state: 'visible' });
    await dashboardPage.locator('[data-chat-minimise]').click();
    await dashboardPage.locator('#grev-chat-dock').waitFor({ state: 'visible' });
    await dashboardPage.locator('#grev-chat-dock').click();
    await dashboardPage.locator('#grev-chat-panel').waitFor({ state: 'visible' });
    checkpoint('advanced dashboard, collaboration and minimisable chat UI');

    const profilePage = await owner.context.newPage();
    profilePage.on('pageerror', error => browserErrors.push(`profile: ${error.message}`));
    await profilePage.goto(`${base}/profile/${encodeURIComponent(owner.id)}`, { waitUntil: 'networkidle' });
    await profilePage.locator('.profile-card-xp .chat-xp').waitFor({ state: 'visible' });
    await profilePage.locator('#profile-achievements').waitFor({ state: 'visible' });
    assert(await profilePage.locator('#profile-achievements .profile-achievement img').count() >= 8, 'Achievement artwork did not render on the profile.');
    assert(await profilePage.locator('#profile-functional-modules .profile-functional-module').count() >= 2, 'Functional profile modules did not render from Content Hub data.');

    const visitorProfilePage = await owner.context.newPage();
    visitorProfilePage.on('pageerror', error => browserErrors.push(`visitor-profile: ${error.message}`));
    await visitorProfilePage.goto(`${base}/profile/${encodeURIComponent(visitor.id)}`, { waitUntil: 'networkidle' });
    await visitorProfilePage.locator('#profile-card').click();
    await visitorProfilePage.locator('#global-profile-card-popover').waitFor({ state: 'visible' });
    await visitorProfilePage.locator('.global-profile-card-xp .chat-xp').waitFor({ state: 'visible' });
    await visitorProfilePage.locator('.global-profile-card-message-button').click();
    await visitorProfilePage.locator('#grev-chat-panel').waitFor({ state: 'visible' });
    await visitorProfilePage.locator('.grev-chat-person-card').waitFor({ state: 'visible' });
    assert((await visitorProfilePage.locator('.grev-chat-person-card').textContent()).includes('Platform visitor'), 'Open direct chat did not show the visitor profile card at the top.');
    checkpoint('profile modules, achievement artwork, XP bars and direct-profile chat UI');

    assert(browserErrors.length === 0, `Browser page errors: ${browserErrors.join(' | ')}`);
    console.log('Full platform two-user browser verification passed.');
  } finally {
    await owner?.context.close();
    await visitor?.context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(`VERIFICATION FAILURE: ${error.stack || error.message || error}`);
  process.exit(1);
});
