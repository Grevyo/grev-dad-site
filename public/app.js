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
  location.replace(payload.next ?? '/dashboard');
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
  await loadOnboardingModal();
}

let onboardingState = null;

async function fetchOnboardingState() {
  const response = await fetch('/api/onboarding', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Unable to load account setup.');
  onboardingState = payload;
  return payload;
}

function makeOnboardingChoice(option, type, name) {
  const label = document.createElement('label');
  label.className = `onboarding-choice${option.selected ? ' selected' : ''}`;
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.value = option.id;
  input.checked = Boolean(option.selected);
  const marker = document.createElement('span');
  marker.className = 'onboarding-choice-marker';
  marker.textContent = option.selected ? 'Selected' : 'Select';
  const title = document.createElement('strong');
  title.textContent = option.name;
  const description = document.createElement('p');
  description.textContent = option.description;
  label.append(input, marker, title, description);
  input.addEventListener('change', () => {
    if (type === 'radio') {
      label.parentElement?.querySelectorAll('.onboarding-choice').forEach(card => card.classList.remove('selected'));
      label.parentElement?.querySelectorAll('.onboarding-choice-marker').forEach(item => { item.textContent = 'Select'; });
    }
    label.classList.toggle('selected', input.checked);
    marker.textContent = input.checked ? 'Selected' : 'Select';
  });
  return label;
}

function renderOnboardingChoices(target, options, type, name) {
  if (!target) return;
  target.replaceChildren(...options.map(option => makeOnboardingChoice(option, type, name)));
}

function showOnboardingStage(stage) {
  const relationshipForm = $('#onboarding-relationship-form');
  const intentionsForm = $('#onboarding-intentions-form');
  const step = $('#onboarding-step');
  const title = $('#onboarding-title');
  const description = $('#onboarding-description');
  if (!relationshipForm || !intentionsForm) return;
  const relationshipStage = stage === 'relationship';
  relationshipForm.hidden = !relationshipStage;
  intentionsForm.hidden = relationshipStage;
  if (step) step.textContent = relationshipStage ? 'Step 1 of 2' : 'Step 2 of 2';
  if (title) title.textContent = relationshipStage ? 'How do you know Grev?' : 'What are your intentions with Grev.dad?';
  if (description) description.textContent = relationshipStage
    ? 'Choose the option that best describes your relationship with Grev. This adds the matching account group.'
    : 'Choose everything that interests you. These selections add the matching account groups and shape what Grev.dad can show you.';
}

async function loadOnboardingModal() {
  const overlay = $('#onboarding-overlay');
  if (!overlay) return;
  const state = await fetchOnboardingState();
  if (state.progress.relationshipComplete && state.progress.intentionsComplete) {
    overlay.hidden = true;
    document.body.classList.remove('modal-open');
    return;
  }
  renderOnboardingChoices($('#onboarding-relationship-list'), state.relationships, 'radio', 'onboardingRelationship');
  renderOnboardingChoices($('#onboarding-intention-list'), state.intentions, 'checkbox', 'onboardingIntention');
  showOnboardingStage(state.progress.relationshipComplete ? 'intentions' : 'relationship');
  overlay.hidden = false;
  document.body.classList.add('modal-open');
}

$('#onboarding-relationship-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const selected = document.querySelector('input[name="onboardingRelationship"]:checked');
  if (!selected) return showTargetMessage('#onboarding-message', 'Choose how you know Grev.');
  showTargetMessage('#onboarding-message', 'Saving relationship…', true);
  const response = await fetch('/api/onboarding/relationship', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relationshipId: selected.value }) });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#onboarding-message', payload.message ?? 'Unable to save relationship.');
  const state = await fetchOnboardingState();
  renderOnboardingChoices($('#onboarding-intention-list'), state.intentions, 'checkbox', 'onboardingIntention');
  showTargetMessage('#onboarding-message', '', true);
  showOnboardingStage('intentions');
});

$('#onboarding-intentions-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const intentionIds = [...document.querySelectorAll('input[name="onboardingIntention"]:checked')].map(input => input.value);
  if (!intentionIds.length) return showTargetMessage('#onboarding-message', 'Choose at least one intention.');
  showTargetMessage('#onboarding-message', 'Saving intentions…', true);
  const response = await fetch('/api/onboarding/intentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentionIds }) });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#onboarding-message', payload.message ?? 'Unable to save intentions.');
  $('#onboarding-overlay').hidden = true;
  document.body.classList.remove('modal-open');
  showTargetMessage('#onboarding-message', '', true);
});

async function loadSettings() {
  if (!$('#settings-relationship-list')) return;
  const state = await fetchOnboardingState();
  renderOnboardingChoices($('#settings-relationship-list'), state.relationships, 'radio', 'settingsRelationship');
  renderOnboardingChoices($('#settings-intention-list'), state.intentions, 'checkbox', 'settingsIntention');
}

$('#settings-relationship-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const selected = document.querySelector('input[name="settingsRelationship"]:checked');
  if (!selected) return showTargetMessage('#settings-relationship-message', 'Choose how you know Grev.');
  const response = await fetch('/api/onboarding/relationship', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relationshipId: selected.value }) });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#settings-relationship-message', payload.message ?? 'Unable to save relationship.');
  showTargetMessage('#settings-relationship-message', payload.message, true);
  await loadSettings();
});

$('#settings-intentions-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const intentionIds = [...document.querySelectorAll('input[name="settingsIntention"]:checked')].map(input => input.value);
  if (!intentionIds.length) return showTargetMessage('#settings-intentions-message', 'Choose at least one intention.');
  const response = await fetch('/api/onboarding/intentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentionIds }) });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#settings-intentions-message', payload.message ?? 'Unable to save intentions.');
  showTargetMessage('#settings-intentions-message', payload.message, true);
  await loadSettings();
});

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
  const settingsLink = $('#profile-settings-link');
  if (settingsLink) settingsLink.hidden = !profile.isSelf;
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
loadSettings().catch(error => { if ($('#settings-error')) $('#settings-error').textContent = error.message; });
