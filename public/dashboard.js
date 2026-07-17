const dashboardState = {
  payload: null,
  workingTiles: [],
  search: '',
  category: 'all',
  draggingId: null
};

const dashboardElement = selector => document.querySelector(selector);

function dashboardMessage(text, type = '') {
  const target = dashboardElement('#dashboard-status');
  if (!target) return;
  target.textContent = text;
  target.className = `dashboard-status${type ? ` ${type}` : ''}`;
}

async function dashboardFetch(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Dashboard request failed.');
  return payload;
}

function featureById(id) {
  return dashboardState.payload?.features.find(feature => feature.id === id) ?? null;
}

function tileRoute(feature) {
  return feature.route || (feature.featureType === 'workspace' ? `/feature/${feature.slug}` : '');
}

function renderDashboard() {
  const grid = dashboardElement('#dashboard-grid');
  const empty = dashboardElement('#dashboard-empty');
  if (!grid || !dashboardState.payload) return;
  const { pinnedTiles, preferences } = dashboardState.payload;
  grid.className = `dashboard-tile-grid dashboard-grid ${preferences.density}`;
  grid.replaceChildren();

  pinnedTiles.forEach(feature => {
    const article = document.createElement('article');
    article.className = `dashboard-tile size-${feature.size}`;

    const head = document.createElement('div');
    head.className = 'dashboard-tile-head';
    const meta = document.createElement('div');
    const category = document.createElement('span');
    category.className = 'dashboard-tile-meta';
    category.textContent = feature.category;
    const title = document.createElement('h2');
    title.textContent = feature.name;
    meta.append(category, title);
    const icon = document.createElement('span');
    icon.className = 'dashboard-tile-icon';
    icon.textContent = feature.iconText;
    head.append(meta, icon);
    article.append(head);

    if (preferences.showDescriptions) {
      const description = document.createElement('p');
      description.textContent = feature.description;
      article.append(description);
    }

    const footer = document.createElement('div');
    footer.className = 'dashboard-tile-footer';
    const access = document.createElement('span');
    access.className = 'dashboard-access-label';
    access.textContent = feature.accessGroups.length ? feature.accessGroups.join(' · ') : feature.audience === 'all' ? 'All members' : feature.audience;
    footer.append(access);

    const route = tileRoute(feature);
    if (route) {
      const link = document.createElement('a');
      link.className = 'dashboard-feature-action';
      link.href = route;
      link.textContent = 'Open';
      footer.append(link);
    }
    article.append(footer);
    grid.append(article);
  });

  empty.hidden = pinnedTiles.length > 0;
  dashboardMessage(`${pinnedTiles.length} pinned feature${pinnedTiles.length === 1 ? '' : 's'} · ${dashboardState.payload.features.length} available`, 'success');
}

function workingTile(featureId) {
  return dashboardState.workingTiles.find(tile => tile.featureId === featureId) ?? null;
}

function addWorkingTile(feature) {
  if (workingTile(feature.id)) return;
  dashboardState.workingTiles.push({ featureId: feature.id, size: feature.defaultSize });
  renderCustomizer();
}

function removeWorkingTile(featureId) {
  dashboardState.workingTiles = dashboardState.workingTiles.filter(tile => tile.featureId !== featureId);
  renderCustomizer();
}

function moveWorkingTile(featureId, direction) {
  const index = dashboardState.workingTiles.findIndex(tile => tile.featureId === featureId);
  if (index < 0) return;
  const target = index + direction;
  if (target < 0 || target >= dashboardState.workingTiles.length) return;
  const [tile] = dashboardState.workingTiles.splice(index, 1);
  dashboardState.workingTiles.splice(target, 0, tile);
  renderCustomizer();
}

function renderLayoutList() {
  const list = dashboardElement('#dashboard-layout-list');
  if (!list) return;
  list.replaceChildren();

  if (!dashboardState.workingTiles.length) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-customizer-intro';
    empty.textContent = 'No features are pinned. Add features from the catalogue.';
    list.append(empty);
    return;
  }

  dashboardState.workingTiles.forEach((tile, index) => {
    const feature = featureById(tile.featureId);
    if (!feature) return;
    const row = document.createElement('article');
    row.className = 'dashboard-layout-row';
    row.draggable = true;
    row.dataset.featureId = feature.id;

    const handle = document.createElement('span');
    handle.className = 'dashboard-drag-handle';
    handle.textContent = '↕';
    handle.title = 'Drag to reorder';

    const identity = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = feature.name;
    const category = document.createElement('small');
    category.textContent = `${index + 1}. ${feature.category}`;
    identity.append(name, category);

    const size = document.createElement('select');
    size.setAttribute('aria-label', `${feature.name} tile size`);
    feature.allowedSizes.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value[0].toUpperCase() + value.slice(1);
      option.selected = tile.size === value;
      size.append(option);
    });
    size.addEventListener('change', () => { tile.size = size.value; });

    const actions = document.createElement('div');
    actions.className = 'dashboard-row-actions';
    const up = document.createElement('button');
    up.type = 'button';
    up.textContent = '↑';
    up.title = 'Move up';
    up.disabled = index === 0;
    up.addEventListener('click', () => moveWorkingTile(feature.id, -1));
    const down = document.createElement('button');
    down.type = 'button';
    down.textContent = '↓';
    down.title = 'Move down';
    down.disabled = index === dashboardState.workingTiles.length - 1;
    down.addEventListener('click', () => moveWorkingTile(feature.id, 1));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeWorkingTile(feature.id));
    actions.append(up, down, remove);

    row.addEventListener('dragstart', event => {
      dashboardState.draggingId = feature.id;
      row.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', feature.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      dashboardState.draggingId = null;
      row.classList.remove('dragging');
    });
    row.addEventListener('dragover', event => event.preventDefault());
    row.addEventListener('drop', event => {
      event.preventDefault();
      const sourceId = dashboardState.draggingId ?? event.dataTransfer?.getData('text/plain');
      if (!sourceId || sourceId === feature.id) return;
      const sourceIndex = dashboardState.workingTiles.findIndex(item => item.featureId === sourceId);
      const targetIndex = dashboardState.workingTiles.findIndex(item => item.featureId === feature.id);
      if (sourceIndex < 0 || targetIndex < 0) return;
      const [moved] = dashboardState.workingTiles.splice(sourceIndex, 1);
      dashboardState.workingTiles.splice(targetIndex, 0, moved);
      renderCustomizer();
    });

    row.append(handle, identity, size, actions);
    list.append(row);
  });
}

function renderCatalogueTools() {
  const categorySelect = dashboardElement('#dashboard-category-filter');
  if (!categorySelect || !dashboardState.payload) return;
  const current = dashboardState.category;
  const categories = [...new Set(dashboardState.payload.features.map(feature => feature.category))].sort();
  categorySelect.replaceChildren();
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = 'All categories';
  categorySelect.append(all);
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categorySelect.append(option);
  });
  categorySelect.value = categories.includes(current) ? current : 'all';
}

function renderCatalogue() {
  const catalogue = dashboardElement('#dashboard-catalogue');
  if (!catalogue || !dashboardState.payload) return;
  catalogue.replaceChildren();
  const search = dashboardState.search.toLowerCase();
  const features = dashboardState.payload.features.filter(feature => {
    const categoryMatch = dashboardState.category === 'all' || feature.category === dashboardState.category;
    const searchMatch = !search || `${feature.name} ${feature.description} ${feature.category}`.toLowerCase().includes(search);
    return categoryMatch && searchMatch;
  });

  features.forEach(feature => {
    const pinned = Boolean(workingTile(feature.id));
    const card = document.createElement('article');
    card.className = `dashboard-catalogue-card${pinned ? ' pinned' : ''}`;
    const marker = document.createElement('span');
    marker.className = 'dashboard-tile-meta';
    marker.textContent = `${feature.category} · ${feature.audience === 'groups' && feature.accessGroups.length ? feature.accessGroups.join(', ') : feature.audience}`;
    const title = document.createElement('h4');
    title.textContent = feature.name;
    const description = document.createElement('p');
    description.textContent = feature.description;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = pinned ? 'Remove pin' : 'Pin feature';
    button.addEventListener('click', () => pinned ? removeWorkingTile(feature.id) : addWorkingTile(feature));
    card.append(marker, title, description, button);
    catalogue.append(card);
  });

  if (!features.length) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-customizer-intro';
    empty.textContent = 'No available features match this filter.';
    catalogue.append(empty);
  }
}

function renderCustomizer() {
  renderLayoutList();
  renderCatalogueTools();
  renderCatalogue();
}

function openCustomizer() {
  if (!dashboardState.payload) return;
  dashboardState.workingTiles = dashboardState.payload.pinnedTiles.map(feature => ({ featureId: feature.id, size: feature.size }));
  dashboardState.search = '';
  dashboardState.category = 'all';
  const search = dashboardElement('#dashboard-feature-search');
  if (search) search.value = '';
  const density = dashboardElement('#dashboard-density');
  if (density) density.value = dashboardState.payload.preferences.density;
  const descriptions = dashboardElement('#dashboard-show-descriptions');
  if (descriptions) descriptions.checked = dashboardState.payload.preferences.showDescriptions;
  const panel = dashboardElement('#dashboard-customizer');
  panel.hidden = false;
  document.body.classList.add('modal-open');
  renderCustomizer();
}

function closeCustomizer() {
  dashboardElement('#dashboard-customizer').hidden = true;
  document.body.classList.remove('modal-open');
}

async function saveDashboardLayout() {
  const density = dashboardElement('#dashboard-density')?.value ?? 'comfortable';
  const showDescriptions = dashboardElement('#dashboard-show-descriptions')?.checked !== false;
  const message = dashboardElement('#dashboard-customizer-message');
  if (message) message.textContent = 'Saving dashboard…';
  try {
    dashboardState.payload = await dashboardFetch('/api/dashboard/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiles: dashboardState.workingTiles, preferences: { density, showDescriptions } })
    });
    closeCustomizer();
    renderDashboard();
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

async function resetDashboardLayout() {
  const message = dashboardElement('#dashboard-customizer-message');
  if (message) message.textContent = 'Restoring default dashboard…';
  try {
    dashboardState.payload = await dashboardFetch('/api/dashboard/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
    });
    dashboardState.workingTiles = dashboardState.payload.pinnedTiles.map(feature => ({ featureId: feature.id, size: feature.size }));
    renderCustomizer();
    renderDashboard();
    if (message) message.textContent = 'Default dashboard restored.';
  } catch (error) {
    if (message) message.textContent = error.message;
  }
}

async function loadDashboardSystem() {
  if (!dashboardElement('#dashboard-grid')) return;
  try {
    const onboardingResponse = await fetch('/api/onboarding', { cache: 'no-store' });
    const onboarding = await onboardingResponse.json();
    if (!onboardingResponse.ok) throw new Error(onboarding.message ?? 'Unable to check account setup.');
    if (!onboarding.progress?.relationshipComplete || !onboarding.progress?.intentionsComplete) {
      dashboardMessage('Complete the account setup questions to unlock your dashboard features.');
      return;
    }
    dashboardState.payload = await dashboardFetch('/api/dashboard');
    renderDashboard();
  } catch (error) {
    dashboardMessage(error.message, 'error');
  }
}

dashboardElement('#customize-dashboard')?.addEventListener('click', openCustomizer);
dashboardElement('#dashboard-customizer-close')?.addEventListener('click', closeCustomizer);
dashboardElement('#dashboard-save-layout')?.addEventListener('click', saveDashboardLayout);
dashboardElement('#dashboard-reset-layout')?.addEventListener('click', resetDashboardLayout);
dashboardElement('#dashboard-feature-search')?.addEventListener('input', event => {
  dashboardState.search = event.currentTarget.value;
  renderCatalogue();
});
dashboardElement('#dashboard-category-filter')?.addEventListener('change', event => {
  dashboardState.category = event.currentTarget.value;
  renderCatalogue();
});
dashboardElement('#dashboard-customizer')?.addEventListener('click', event => {
  if (event.target.id === 'dashboard-customizer') closeCustomizer();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !dashboardElement('#dashboard-customizer')?.hidden) closeCustomizer();
});

loadDashboardSystem();
