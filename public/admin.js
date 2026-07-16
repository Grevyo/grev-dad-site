const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const payload = await response.json().catch(() => ({ ok: false, message: 'Invalid server response.' }));
  if (!response.ok) throw new Error(payload.message ?? 'Request failed.');
  return payload;
}

function setMessage(text, ok = false) {
  const target = $('#admin-message');
  if (!target) return;
  target.textContent = text;
  target.className = ok ? 'success' : 'error';
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function makeBadge(text, kind = '') {
  const badge = document.createElement('span');
  badge.className = `admin-badge ${kind}`.trim();
  badge.textContent = text;
  return badge;
}

async function loadSummary() {
  const container = $('#admin-summary');
  if (!container) return;
  const payload = await api('/api/admin/summary');
  const entries = [
    ['Accounts', payload.summary.total],
    ['Active', payload.summary.active],
    ['Unverified', payload.summary.unverified],
    ['Suspended', payload.summary.suspended],
    ['Administrators', payload.summary.admins]
  ];
  container.replaceChildren(...entries.map(([label, value]) => {
    const article = document.createElement('article');
    const small = document.createElement('small');
    small.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    article.append(small, strong);
    return article;
  }));
  const owner = $('#owner-summary');
  if (owner) owner.textContent = payload.owner ? `Owner: ${payload.owner.displayName} (@${payload.owner.username})` : 'No Owner configured.';
}

function renderUser(user) {
  const link = document.createElement('a');
  link.className = 'admin-user-row';
  link.href = `/admin/users/${encodeURIComponent(user.id)}`;

  const identity = document.createElement('div');
  identity.className = 'admin-user-identity';
  const title = document.createElement('strong');
  title.textContent = user.displayName;
  const meta = document.createElement('span');
  meta.textContent = `@${user.username}${user.email ? ` · ${user.email}` : ''}`;
  identity.append(title, meta);

  const badges = document.createElement('div');
  badges.className = 'admin-user-badges';
  if (user.isOwner) badges.append(makeBadge('Owner', 'owner'));
  else if (user.isAdmin) badges.append(makeBadge('Admin', 'admin'));
  badges.append(makeBadge(user.isVerified ? 'Verified' : 'Unverified', user.isVerified ? 'verified' : 'unverified'));
  badges.append(makeBadge(user.status, user.status));
  for (const group of user.privateGroups ?? []) badges.append(makeBadge(group, 'private'));

  const joined = document.createElement('span');
  joined.className = 'admin-user-joined';
  joined.textContent = `Joined ${formatDate(user.createdAt)}`;

  link.append(identity, badges, joined);
  return link;
}

async function loadUsers() {
  const list = $('#admin-user-list');
  if (!list) return;
  const form = $('#admin-search-form');
  const data = form ? new FormData(form) : new FormData();
  const params = new URLSearchParams();
  const query = String(data.get('q') ?? '').trim();
  const status = String(data.get('status') ?? 'all');
  if (query) params.set('q', query);
  params.set('status', status);
  list.textContent = 'Loading accounts…';
  try {
    const payload = await api(`/api/admin/users?${params}`);
    list.replaceChildren();
    if (!payload.users?.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No accounts match this search.';
      list.append(empty);
      return;
    }
    list.append(...payload.users.map(renderUser));
  } catch (error) {
    list.textContent = error.message;
  }
}

$('#admin-search-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  loadUsers();
});

function userIdFromPath() {
  const prefix = '/admin/users/';
  return decodeURIComponent(location.pathname.startsWith(prefix) ? location.pathname.slice(prefix.length) : '');
}

function renderPrivateGroups(groups, disabled) {
  const target = $('#private-group-options');
  if (!target) return;
  target.replaceChildren(...groups.map(group => {
    const label = document.createElement('label');
    label.className = 'admin-check-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'privateGroup';
    input.value = group.id;
    input.checked = Boolean(group.assigned);
    input.disabled = disabled;
    const text = document.createElement('span');
    text.textContent = group.name;
    label.append(input, text);
    return label;
  }));
}

function renderTags(targetSelector, values, emptyText) {
  const target = $(targetSelector);
  if (!target) return;
  target.replaceChildren();
  if (!values?.length) {
    target.textContent = emptyText;
    return;
  }
  for (const value of values) target.append(makeBadge(value.name ?? value, 'neutral'));
}

function renderAudit(events) {
  const target = $('#audit-list');
  if (!target) return;
  target.replaceChildren();
  if (!events?.length) {
    target.textContent = 'No audit history yet.';
    return;
  }
  for (const event of events) {
    const article = document.createElement('article');
    const header = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = event.type.replaceAll('.', ' ');
    const time = document.createElement('time');
    time.textContent = formatDate(event.createdAt);
    header.append(title, time);
    const actor = document.createElement('p');
    actor.textContent = event.actorUsername ? `By @${event.actorUsername}` : 'System event';
    const metadata = document.createElement('pre');
    metadata.textContent = Object.keys(event.metadata ?? {}).length ? JSON.stringify(event.metadata, null, 2) : '';
    if (!metadata.textContent) metadata.hidden = true;
    article.append(header, actor, metadata);
    target.append(article);
  }
}

async function loadUserDetail() {
  if (!$('#admin-user-name')) return;
  const userId = userIdFromPath();
  try {
    const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}`);
    const user = payload.user;
    document.title = `${user.displayName} · Admin · Grev.dad`;
    $('#admin-user-name').textContent = user.displayName;
    $('#admin-user-meta').textContent = `@${user.username}${user.email ? ` · ${user.email}` : ''}`;
    $('#admin-account-id').textContent = user.id;
    $('#admin-created-at').textContent = formatDate(user.createdAt);
    $('#admin-active-sessions').textContent = String(user.activeSessions);
    $('#admin-profile-link').href = `/profile/${encodeURIComponent(user.id)}`;

    const headlineBadges = $('#admin-user-headline-badges');
    headlineBadges.replaceChildren();
    if (user.isOwner) headlineBadges.append(makeBadge('Owner', 'owner'));
    else if (user.isAdmin) headlineBadges.append(makeBadge('Administrator', 'admin'));
    headlineBadges.append(makeBadge(user.isVerified ? 'Verified' : 'Unverified', user.isVerified ? 'verified' : 'unverified'));
    headlineBadges.append(makeBadge(user.status, user.status));

    $('#verification-select').value = user.isVerified ? 'verified' : 'unverified';
    $('#status-select').value = user.status;
    $('#admin-role-select').value = user.isAdmin ? 'admin' : 'member';

    const canManage = Boolean(payload.capabilities.canManage);
    $('#verification-select').disabled = !canManage;
    $('#verification-save').disabled = !canManage;
    $('#status-select').disabled = !payload.capabilities.canManageStatus;
    $('#status-save').disabled = !payload.capabilities.canManageStatus;
    $('#private-groups-save').disabled = !canManage;
    renderPrivateGroups(payload.privateGroups, !canManage);

    const adminPanel = $('#admin-role-panel');
    adminPanel.hidden = !payload.viewer.isOwner;
    $('#admin-role-select').disabled = !payload.capabilities.canManageAdmin;
    $('#admin-role-save').disabled = !payload.capabilities.canManageAdmin;

    renderTags('#intentions-list', payload.intentions, 'No intentions selected.');
    renderTags('#roles-list', payload.roles, 'No roles assigned.');
    renderAudit(payload.audit);
  } catch (error) {
    $('#admin-user-name').textContent = 'Unable to load account';
    setMessage(error.message);
  }
}

async function postUserAction(suffix, body) {
  const userId = userIdFromPath();
  setMessage('Saving…', true);
  try {
    const payload = await api(`/api/admin/users/${encodeURIComponent(userId)}/${suffix}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setMessage(payload.message ?? 'Saved.', true);
    await loadUserDetail();
  } catch (error) {
    setMessage(error.message);
  }
}

$('#verification-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  postUserAction('verification', { verified: $('#verification-select').value === 'verified' });
});

$('#status-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  postUserAction('status', { status: $('#status-select').value });
});

$('#private-groups-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const groupIds = [...document.querySelectorAll('input[name="privateGroup"]:checked')].map(input => input.value);
  postUserAction('private-groups', { groupIds });
});

$('#admin-role-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  postUserAction('administrator', { isAdmin: $('#admin-role-select').value === 'admin' });
});

$('#logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  location.replace('/');
});

loadSummary().catch(error => setMessage(error.message));
loadUsers();
loadUserDetail();