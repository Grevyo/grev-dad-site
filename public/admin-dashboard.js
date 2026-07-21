const adminDashboardState = { payload: null, selectedId: null };
const adminDashboardElement = selector => document.querySelector(selector);

function adminDashboardMessage(text, type = '') {
  const target = adminDashboardElement('#dashboard-admin-message');
  if (!target) return;
  target.textContent = text;
  target.className = `dashboard-status${type ? ` ${type}` : ''}`;
}

async function adminDashboardFetch(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Dashboard administration request failed.');
  return payload;
}

function setGroupFieldVisibility(audience) {
  const groups = adminDashboardElement('#dashboard-feature-group-checks');
  const fieldset = groups?.closest('fieldset');
  if (fieldset) fieldset.hidden = audience !== 'groups';
}

function renderFeatureList() {
  const list = adminDashboardElement('#dashboard-admin-list');
  if (!list || !adminDashboardState.payload) return;
  list.replaceChildren();
  adminDashboardState.payload.features.forEach(feature => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `dashboard-admin-item${feature.id === adminDashboardState.selectedId ? ' selected' : ''}`;
    const icon = document.createElement('span');
    icon.className = 'dashboard-admin-item-icon';
    icon.textContent = feature.iconText;
    const identity = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = feature.name;
    const details = document.createElement('small');
    details.textContent = `${feature.category} · ${feature.presentation === 'content' ? 'information' : 'button'} · ${feature.defaultDimension} · ${feature.audience} · ${feature.isActive ? 'enabled' : 'disabled'}`;
    identity.append(name, document.createElement('br'), details);
    const order = document.createElement('small');
    order.textContent = String(feature.sortOrder);
    item.append(icon, identity, order);
    item.addEventListener('click', () => {
      adminDashboardState.selectedId = feature.id;
      fillFeatureForm(feature);
      renderFeatureList();
    });
    list.append(item);
  });
}

function renderGroupChecks(selectedIds = []) {
  const container = adminDashboardElement('#dashboard-feature-group-checks');
  if (!container || !adminDashboardState.payload) return;
  const selected = new Set(selectedIds);
  container.replaceChildren();
  adminDashboardState.payload.groups.forEach(group => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = group.id;
    input.checked = selected.has(group.id);
    const text = document.createElement('span');
    text.textContent = group.name;
    label.title = group.description;
    label.append(input, text);
    container.append(label);
  });
}

function setAllowedDimensions(values) {
  const selected = new Set(values);
  document.querySelectorAll('#dashboard-feature-dimension-checks input[type="checkbox"]').forEach(input => {
    input.checked = selected.has(input.value);
  });
}

function clearFeatureForm() {
  adminDashboardState.selectedId = null;
  adminDashboardElement('#dashboard-feature-id').value = '';
  adminDashboardElement('#dashboard-feature-name').value = '';
  adminDashboardElement('#dashboard-feature-slug').value = '';
  adminDashboardElement('#dashboard-feature-description').value = '';
  adminDashboardElement('#dashboard-feature-category').value = 'General';
  adminDashboardElement('#dashboard-feature-icon').value = 'GD';
  adminDashboardElement('#dashboard-feature-type').value = 'workspace';
  adminDashboardElement('#dashboard-feature-presentation').value = 'action';
  adminDashboardElement('#dashboard-feature-audience').value = 'groups';
  adminDashboardElement('#dashboard-feature-route').value = '';
  adminDashboardElement('#dashboard-feature-default-dimension').value = '2x1';
  adminDashboardElement('#dashboard-feature-sort').value = '0';
  adminDashboardElement('#dashboard-feature-active').checked = true;
  adminDashboardElement('#dashboard-feature-default').checked = false;
  setAllowedDimensions(['1x1', '1x2', '2x1', '2x2', '3x1', '3x2', '4x1', '4x2']);
  renderGroupChecks([]);
  setGroupFieldVisibility('groups');
  renderFeatureList();
}

function fillFeatureForm(feature) {
  adminDashboardElement('#dashboard-feature-id').value = feature.id;
  adminDashboardElement('#dashboard-feature-name').value = feature.name;
  adminDashboardElement('#dashboard-feature-slug').value = feature.slug;
  adminDashboardElement('#dashboard-feature-description').value = feature.description;
  adminDashboardElement('#dashboard-feature-category').value = feature.category;
  adminDashboardElement('#dashboard-feature-icon').value = feature.iconText;
  adminDashboardElement('#dashboard-feature-type').value = feature.featureType;
  adminDashboardElement('#dashboard-feature-presentation').value = feature.presentation ?? 'action';
  adminDashboardElement('#dashboard-feature-audience').value = feature.audience;
  adminDashboardElement('#dashboard-feature-route').value = feature.route;
  adminDashboardElement('#dashboard-feature-default-dimension').value = feature.defaultDimension;
  adminDashboardElement('#dashboard-feature-sort').value = String(feature.sortOrder);
  adminDashboardElement('#dashboard-feature-active').checked = feature.isActive;
  adminDashboardElement('#dashboard-feature-default').checked = feature.isDefault;
  setAllowedDimensions(feature.allowedDimensions);
  renderGroupChecks(feature.groupIds);
  setGroupFieldVisibility(feature.audience);
}

function formPayload() {
  const allowedDimensions = [...document.querySelectorAll('#dashboard-feature-dimension-checks input:checked')].map(input => input.value);
  const groupIds = [...document.querySelectorAll('#dashboard-feature-group-checks input:checked')].map(input => input.value);
  return {
    name: adminDashboardElement('#dashboard-feature-name').value,
    slug: adminDashboardElement('#dashboard-feature-slug').value,
    description: adminDashboardElement('#dashboard-feature-description').value,
    category: adminDashboardElement('#dashboard-feature-category').value,
    iconText: adminDashboardElement('#dashboard-feature-icon').value,
    featureType: adminDashboardElement('#dashboard-feature-type').value,
    presentation: adminDashboardElement('#dashboard-feature-presentation').value,
    audience: adminDashboardElement('#dashboard-feature-audience').value,
    route: adminDashboardElement('#dashboard-feature-route').value,
    defaultDimension: adminDashboardElement('#dashboard-feature-default-dimension').value,
    allowedDimensions,
    groupIds,
    sortOrder: Number(adminDashboardElement('#dashboard-feature-sort').value),
    isActive: adminDashboardElement('#dashboard-feature-active').checked,
    isDefault: adminDashboardElement('#dashboard-feature-default').checked
  };
}

async function loadAdminDashboard() {
  try {
    adminDashboardState.payload = await adminDashboardFetch('/api/admin/dashboard/features');
    renderGroupChecks([]);
    setGroupFieldVisibility('groups');
    renderFeatureList();
    adminDashboardMessage(`${adminDashboardState.payload.features.length} dashboard features · ${adminDashboardState.payload.groups.length} available groups · ${adminDashboardState.payload.grid.columns}-column grid`, 'success');
  } catch (error) {
    adminDashboardMessage(error.message, 'error');
  }
}

adminDashboardElement('#dashboard-admin-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const featureId = adminDashboardState.selectedId;
  const submitted = formPayload();
  const url = featureId ? `/api/admin/dashboard/features/${encodeURIComponent(featureId)}` : '/api/admin/dashboard/features';
  adminDashboardMessage(featureId ? 'Updating dashboard feature…' : 'Creating dashboard feature…');
  try {
    adminDashboardState.payload = await adminDashboardFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitted)
    });
    const saved = featureId
      ? adminDashboardState.payload.features.find(feature => feature.id === featureId)
      : adminDashboardState.payload.features.find(feature => feature.slug === submitted.slug.trim().toLowerCase());
    adminDashboardState.selectedId = saved?.id ?? null;
    if (saved) fillFeatureForm(saved);
    renderFeatureList();
    adminDashboardMessage('Dashboard feature saved.', 'success');
  } catch (error) {
    adminDashboardMessage(error.message, 'error');
  }
});

adminDashboardElement('#new-dashboard-feature')?.addEventListener('click', clearFeatureForm);
adminDashboardElement('#dashboard-feature-cancel')?.addEventListener('click', clearFeatureForm);
adminDashboardElement('#dashboard-feature-default-dimension')?.addEventListener('change', event => {
  const matching = document.querySelector(`#dashboard-feature-dimension-checks input[value="${CSS.escape(event.currentTarget.value)}"]`);
  if (matching) matching.checked = true;
});
adminDashboardElement('#dashboard-feature-audience')?.addEventListener('change', event => {
  setGroupFieldVisibility(event.currentTarget.value);
});
adminDashboardElement('#logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  location.replace('/');
});

loadAdminDashboard();