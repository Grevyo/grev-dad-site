const $ = (selector) => document.querySelector(selector);
const message = $('#message');

function showMessage(text, ok = false) {
  if (!message) return;
  message.textContent = text;
  message.className = ok ? 'success' : 'error';
}

function showUsernameMessage(text, ok = false) {
  const target = $('#username-message');
  if (!target) return;
  target.textContent = text;
  target.className = ok ? 'success' : 'error';
}

for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click', () => {
    const signup = button.dataset.tab === 'signup';
    $('#login-form').hidden = signup;
    $('#signup-form').hidden = !signup;
    for (const tab of document.querySelectorAll('[data-tab]')) tab.classList.toggle('active', tab === button);
    if (message) message.textContent = '';
  });
}

$('#login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: form.get('identifier'), password: form.get('password'), rememberMe: form.get('rememberMe') === 'on' }) });
  const payload = await response.json();
  if (!response.ok) return showMessage(payload.message ?? 'Login failed.');
  location.replace('/dashboard');
});

$('#signup-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const response = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
  const payload = await response.json();
  if (!response.ok) return showMessage(payload.message ?? 'Sign-up failed.');
  document.querySelector('[data-tab="login"]')?.click();
  const identifier = document.querySelector('#login-form [name="identifier"]');
  if (identifier) identifier.value = String(form.get('username') ?? '');
  showMessage(payload.message ?? 'Account created.', true);
});

async function loadDashboard() {
  if (!$('#name')) return;
  const response = await fetch('/api/auth/session', { cache: 'no-store' });
  const payload = await response.json();
  if (!payload.authenticated || !payload.user) return location.replace('/');
  $('#name').textContent = payload.user.displayName;
  $('#username').textContent = `@${payload.user.username}`;
  const usernameInput = $('#username-input');
  if (usernameInput) usernameInput.value = payload.user.username;
  $('#badge').textContent = payload.user.isVerified ? 'Verified' : 'Unverified';
  $('#verification').textContent = payload.user.isVerified ? 'An administrator has verified this account.' : 'This account is active but not yet verified.';
}

$('#username-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const response = await fetch('/api/account/username', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username') }) });
  const payload = await response.json();
  if (!response.ok) return showUsernameMessage(payload.message ?? 'Username update failed.');
  $('#username').textContent = `@${payload.username}`;
  showUsernameMessage(payload.message ?? 'Username updated.', true);
});

$('#logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  location.replace('/');
});

loadDashboard().catch(() => location.replace('/'));
