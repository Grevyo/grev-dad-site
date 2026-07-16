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
  location.replace(payload.next ?? '/intentions');
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
  $('#badge').textContent = payload.user.isOwner ? 'Owner' : (payload.user.isAdmin ? 'Administrator' : (payload.user.isVerified ? 'Verified' : 'Unverified'));
  $('#verification').textContent = payload.user.isVerified ? 'An administrator has verified this account.' : 'This account is active but not yet verified.';
  const adminLink = $('#admin-link');
  if (adminLink) adminLink.hidden = !payload.user.isAdmin;

  const ownerSetupLink = $('#owner-setup-link');
  const ownerSetupCard = $('#owner-setup-card');
  if (!payload.user.isOwner && (ownerSetupLink || ownerSetupCard)) {
    const statusResponse = await fetch('/api/bootstrap/owner-status', { cache: 'no-store' });
    const status = await statusResponse.json();
    const showSetup = statusResponse.ok && !status.ownerConfigured && status.eligible;
    if (ownerSetupLink) ownerSetupLink.hidden = !showSetup;
    if (ownerSetupCard) ownerSetupCard.hidden = !showSetup;
  }
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

function makeIntentionCard(intention) {
  const label = document.createElement('label');
  label.className = `intention-card${intention.selected ? ' already-selected' : ''}`;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.value = intention.id;
  checkbox.checked = Boolean(intention.selected);
  checkbox.disabled = Boolean(intention.selected);
  checkbox.setAttribute('aria-label', intention.name);

  const top = document.createElement('div');
  top.className = 'intention-card-top';
  const marker = document.createElement('span');
  marker.className = 'intention-marker';
  marker.textContent = intention.selected ? 'Already added' : 'Select';
  const check = document.createElement('span');
  check.className = 'intention-check';
  check.textContent = intention.selected ? '✓' : '';
  top.append(marker, check);

  const title = document.createElement('h2');
  title.textContent = intention.name;
  const description = document.createElement('p');
  description.textContent = intention.description;
  label.append(checkbox, top, title, description);

  if (!intention.selected) {
    checkbox.addEventListener('change', () => {
      label.classList.toggle('selected', checkbox.checked);
      check.textContent = checkbox.checked ? '✓' : '';
      marker.textContent = checkbox.checked ? 'Selected' : 'Select';
    });
  }
  return label;
}

async function loadIntentions() {
  const list = $('#intention-list');
  if (!list) return;
  const response = await fetch('/api/intentions', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) {
    list.textContent = payload.message ?? 'Unable to load the intention options.';
    return;
  }
  list.replaceChildren(...(payload.intentions ?? []).map(makeIntentionCard));
}

$('#intentions-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const intentIds = [...document.querySelectorAll('#intention-list input[type="checkbox"]:checked:not(:disabled)')].map(input => input.value);
  showTargetMessage('#intentions-message', 'Saving your choices…', true);
  const response = await fetch('/api/intentions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentionIds: intentIds })
  });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#intentions-message', payload.message ?? 'Unable to save your choices.');
  showTargetMessage('#intentions-message', payload.message ?? 'Your choices have been saved.', true);
  location.replace(payload.next ?? '/dashboard');
});

async function loadOwnerSetup() {
  if (!$('#owner-setup-title')) return;
  const response = await fetch('/api/bootstrap/owner-status', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) {
    $('#owner-setup-title').textContent = 'Owner setup unavailable';
    $('#owner-setup-description').textContent = payload.message ?? 'Unable to check Owner setup.';
    return;
  }
  if (payload.ownerConfigured) {
    $('#owner-setup-title').textContent = 'Owner already configured';
    $('#owner-setup-description').textContent = 'The one-time Owner setup has already been completed.';
    return;
  }
  if (!payload.eligible) {
    $('#owner-setup-title').textContent = 'Manual Owner setup required';
    $('#owner-setup-description').textContent = `Automatic setup is disabled because ${payload.userCount} accounts exist. No account will be selected automatically.`;
    return;
  }
  $('#owner-setup-title').textContent = 'This account is eligible';
  $('#owner-setup-description').textContent = 'Confirm your current password to make this sole account the Grev.dad Owner.';
  $('#owner-setup-form').hidden = false;
}

$('#owner-setup-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  showTargetMessage('#owner-setup-message', 'Configuring Owner account…', true);
  const response = await fetch('/api/bootstrap/owner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: form.get('password') })
  });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#owner-setup-message', payload.message ?? 'Owner setup failed.');
  showTargetMessage('#owner-setup-message', payload.message ?? 'Owner configured.', true);
  location.replace(payload.next ?? '/admin');
});

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
loadIntentions().catch(() => { if ($('#intention-list')) $('#intention-list').textContent = 'Unable to load the intention options.'; });
loadOwnerSetup().catch(() => { if ($('#owner-setup-description')) $('#owner-setup-description').textContent = 'Unable to check Owner setup.'; });