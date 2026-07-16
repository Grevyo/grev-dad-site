const $ = (selector) => document.querySelector(selector);

function showTargetMessage(selector, text, ok = false) {
  const target = $(selector);
  if (!target) return;
  target.textContent = text;
  target.className = ok ? 'success' : 'error';
}

$('#login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password'), rememberMe: form.get('rememberMe') === 'on' })
  });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#message', payload.message ?? 'Login failed.');
  location.replace(payload.next ?? '/dashboard');
});

$('#signup-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(form))
  });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#message', payload.message ?? 'Sign-up failed.');
  location.replace(payload.next ?? '/access');
});

async function loadDashboard() {
  if (!$('#name')) return;
  const response = await fetch('/api/auth/session', { cache: 'no-store' });
  const payload = await response.json();
  if (!payload.authenticated || !payload.user) return location.replace('/login');
  $('#name').textContent = payload.user.displayName;
  $('#username').textContent = `@${payload.user.username}`;
  const profileUrl = `/profile/${encodeURIComponent(payload.user.id)}`;
  const profileLink = $('#profile-link');
  if (profileLink) profileLink.href = profileUrl;
  const usernameInput = $('#username-input');
  if (usernameInput) usernameInput.value = payload.user.username;
  $('#badge').textContent = payload.user.isVerified ? 'Verified' : 'Unverified';
  $('#verification').textContent = payload.user.isVerified ? 'An administrator has verified this account.' : 'This account is active but not yet verified.';
  const adminLink = $('#admin-access-link');
  if (adminLink) adminLink.hidden = !payload.user.isAdmin;
}

async function loadProfile() {
  if (!$('#profile-name')) return;
  const profileId = decodeURIComponent(location.pathname.slice('/profile/'.length));
  const response = await fetch(`/api/profiles/${encodeURIComponent(profileId)}`, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || !payload.profile) {
    $('#profile-name').textContent = 'Profile not found';
    $('#profile-status').textContent = payload.message ?? 'This profile is unavailable.';
    return;
  }
  const profile = payload.profile;
  document.title = `${profile.displayName} · Grev.dad`;
  $('#profile-name').textContent = profile.displayName;
  $('#profile-username').textContent = `@${profile.username}`;
  $('#profile-status').textContent = profile.isVerified ? 'Verified member' : 'Unverified member';
  $('#profile-badge').textContent = profile.isOwner ? 'Owner' : (profile.isVerified ? 'Verified' : 'Unverified');
  $('#profile-member-since').textContent = new Date(profile.createdAt * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  const ownProfile = $('#own-profile-note');
  if (ownProfile) ownProfile.hidden = !profile.isSelf;
}

function accessStatusLabel(status) {
  if (status === 'granted' || status === 'approved') return 'Granted';
  if (status === 'pending') return 'Pending approval';
  if (status === 'denied') return 'Previously denied';
  return 'Available';
}

async function requestAccess(accessId) {
  showTargetMessage('#access-message', 'Submitting request…', true);
  const response = await fetch('/api/access/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessId })
  });
  const payload = await response.json();
  showTargetMessage('#access-message', payload.message ?? (response.ok ? 'Access updated.' : 'Request failed.'), response.ok);
  if (response.ok) await loadAccess();
}

async function loadAccess() {
  const list = $('#access-list');
  if (!list) return;
  const response = await fetch('/api/access/catalog', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) {
    list.textContent = payload.message ?? 'Unable to load access options.';
    return;
  }
  list.replaceChildren();
  for (const area of payload.areas ?? []) {
    const card = document.createElement('article');
    card.className = 'access-card';

    const top = document.createElement('div');
    top.className = 'access-card-top';
    const type = document.createElement('span');
    type.className = `access-type ${area.type}`;
    type.textContent = area.type === 'public' ? 'Public access' : 'Private access';
    const status = document.createElement('span');
    status.className = `request-status ${area.status}`;
    status.textContent = accessStatusLabel(area.status);
    top.append(type, status);

    const title = document.createElement('h2');
    title.textContent = area.name;
    const description = document.createElement('p');
    description.textContent = area.description;
    const button = document.createElement('button');
    const canRequest = area.status === 'available' || area.status === 'denied';
    button.disabled = !canRequest;
    button.textContent = area.status === 'pending' ? 'Awaiting approval' : (area.status === 'granted' || area.status === 'approved' ? 'Access granted' : (area.type === 'public' ? 'Get access' : 'Request access'));
    if (canRequest) button.addEventListener('click', () => requestAccess(area.id));

    card.append(top, title, description, button);
    list.append(card);
  }
}

async function decideAccess(requestId, decision) {
  showTargetMessage('#admin-message', `${decision === 'approved' ? 'Approving' : 'Denying'} request…`, true);
  const response = await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision })
  });
  const payload = await response.json();
  showTargetMessage('#admin-message', payload.message ?? (response.ok ? 'Request updated.' : 'Unable to update request.'), response.ok);
  if (response.ok) await loadAdminRequests();
}

async function loadAdminRequests() {
  const list = $('#admin-request-list');
  if (!list) return;
  const response = await fetch('/api/admin/access-requests', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) {
    list.textContent = payload.message ?? 'Unable to load requests.';
    return;
  }
  list.replaceChildren();
  if (!payload.requests?.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'There are no pending private access requests.';
    list.append(empty);
    return;
  }
  for (const item of payload.requests) {
    const card = document.createElement('article');
    card.className = 'request-card';
    const details = document.createElement('div');
    const label = document.createElement('small');
    label.textContent = item.access.name;
    const title = document.createElement('h2');
    title.textContent = item.user.displayName;
    const username = document.createElement('p');
    username.textContent = `@${item.user.username} · Requested ${new Date(item.requestedAt * 1000).toLocaleString()}`;
    const description = document.createElement('p');
    description.textContent = item.access.description;
    details.append(label, title, username, description);

    const actions = document.createElement('div');
    actions.className = 'decision-actions';
    const approve = document.createElement('button');
    approve.textContent = 'Approve';
    approve.addEventListener('click', () => decideAccess(item.id, 'approved'));
    const deny = document.createElement('button');
    deny.className = 'danger-button';
    deny.textContent = 'Deny';
    deny.addEventListener('click', () => decideAccess(item.id, 'denied'));
    actions.append(approve, deny);
    card.append(details, actions);
    list.append(card);
  }
}

$('#username-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const response = await fetch('/api/account/username', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username') }) });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#username-message', payload.message ?? 'Username update failed.');
  $('#username').textContent = `@${payload.username}`;
  showTargetMessage('#username-message', payload.message ?? 'Username updated.', true);
});

$('#logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  location.replace('/');
});

loadDashboard().catch(() => location.replace('/login'));
loadProfile().catch(() => { if ($('#profile-status')) $('#profile-status').textContent = 'Unable to load this profile.'; });
loadAccess().catch(() => { if ($('#access-list')) $('#access-list').textContent = 'Unable to load access options.'; });
loadAdminRequests().catch(() => { if ($('#admin-request-list')) $('#admin-request-list').textContent = 'Unable to load requests.'; });
