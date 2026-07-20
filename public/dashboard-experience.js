(() => {
  if (typeof dashboardState === 'undefined' || typeof dashboardElement !== 'function') return;

  const experience = {
    pagesPayload: null,
    activePageId: 'home',
    homeSnapshot: null,
    live: null,
    liveTimer: null,
    clockTimer: null,
    history: [],
    historyIndex: -1,
    historySuspended: false,
    historyQueued: false,
    copiedStyle: null,
    initialized: false
  };

  const clone = value => structuredClone(value);

  async function experienceFetch(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? 'Dashboard experience request failed.');
    return payload;
  }

  function serializableTile(tile) {
    return {
      featureId: tile.featureId,
      x: Number(tile.x),
      y: Number(tile.y),
      width: Number(tile.width),
      height: Number(tile.height),
      colour: tile.colour ?? tile.tileColour ?? 'default',
      ...normalizedTileAppearance(tile)
    };
  }

  function currentLayout() {
    const tiles = dashboardState.editing
      ? dashboardState.workingTiles.map(serializableTile)
      : (dashboardState.payload?.pinnedTiles ?? []).map(serializableTile);
    const preferences = dashboardState.editing ? editorPreferences() : currentPreferences();
    return { tiles, preferences };
  }

  function hydrateLayout(layout) {
    const tiles = Array.isArray(layout?.tiles) ? layout.tiles : [];
    return tiles.map(tile => {
      const feature = featureById(tile.featureId);
      return feature ? { ...feature, ...clone(tile), id: feature.id, dimension: dimensionKey(tile.width, tile.height) } : null;
    }).filter(Boolean);
  }

  function pageById(pageId) {
    return experience.pagesPayload?.pages?.find(page => page.id === pageId) ?? null;
  }

  function activePage() {
    return pageById(experience.activePageId);
  }

  function saveHomeSnapshot() {
    if (experience.activePageId !== 'home' || !dashboardState.payload) return;
    experience.homeSnapshot = {
      pinnedTiles: clone(dashboardState.payload.pinnedTiles ?? []),
      preferences: clone(dashboardState.payload.preferences ?? {})
    };
  }

  function applyPageToDashboard(page) {
    if (!dashboardState.payload || !page) return;
    if (page.id === 'home') {
      const snapshot = experience.homeSnapshot ?? {
        pinnedTiles: clone(dashboardState.payload.pinnedTiles ?? []),
        preferences: clone(dashboardState.payload.preferences ?? {})
      };
      dashboardState.payload.pinnedTiles = clone(snapshot.pinnedTiles);
      dashboardState.payload.preferences = clone(snapshot.preferences);
    } else {
      dashboardState.payload.pinnedTiles = hydrateLayout(page.layout);
      dashboardState.payload.preferences = {
        ...dashboardState.payload.preferences,
        ...(page.layout?.preferences ?? {})
      };
    }
    const customize = dashboardElement('#customize-dashboard');
    if (customize) {
      customize.disabled = page.id !== 'home' && page.canEdit === false;
      customize.title = customize.disabled ? 'This group page can only be edited by an administrator.' : '';
    }
    renderDashboardGrid();
    renderPageTabs();
  }

  async function switchPage(pageId, { persist = true } = {}) {
    const page = pageById(pageId);
    if (!page || page.id === experience.activePageId) return;
    if (dashboardState.editing) closeEditor(false);
    saveHomeSnapshot();
    experience.activePageId = page.id;
    applyPageToDashboard(page);
    if (persist) {
      try {
        await experienceFetch('/api/experience/dashboard/pages/active', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: page.id })
        });
      } catch (error) {
        dashboardMessage(error.message, 'error');
      }
    }
  }

  function pageTab(page) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `dashboard-page-tab${page.id === experience.activePageId ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(page.id === experience.activePageId));
    button.dataset.pageId = page.id;
    const name = document.createElement('strong');
    name.textContent = page.name;
    const scope = document.createElement('span');
    scope.textContent = page.scope === 'group' ? page.groupName ?? 'Group' : page.scope === 'home' ? 'Personal' : 'Page';
    button.append(name, scope);
    button.addEventListener('click', () => switchPage(page.id));
    return button;
  }

  function renderPageTabs() {
    const tabs = dashboardElement('#dashboard-page-tabs');
    if (!tabs || !experience.pagesPayload) return;
    const manage = dashboardElement('#dashboard-manage-pages');
    tabs.replaceChildren(...experience.pagesPayload.pages.map(pageTab));
    if (manage) manage.hidden = false;
    const page = activePage();
    const title = dashboardElement('#dashboard-active-page-name');
    if (title) title.textContent = page?.name ?? 'Home';
  }

  function ensurePageBar() {
    if (dashboardElement('#dashboard-page-bar')) return;
    const hero = dashboardElement('.dashboard-hero');
    if (!hero) return;
    const bar = document.createElement('section');
    bar.id = 'dashboard-page-bar';
    bar.className = 'dashboard-page-bar';
    bar.innerHTML = `
      <div class="dashboard-page-heading">
        <div><span>Dashboard page</span><strong id="dashboard-active-page-name">Home</strong></div>
        <button id="dashboard-manage-pages" type="button" hidden>Manage pages</button>
      </div>
      <div id="dashboard-page-tabs" class="dashboard-page-tabs" role="navigation" aria-label="Dashboard pages"></div>`;
    hero.insertAdjacentElement('afterend', bar);
    dashboardElement('#dashboard-manage-pages')?.addEventListener('click', openPageManager);
  }

  function ensurePageManager() {
    let dialog = dashboardElement('#dashboard-page-manager');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'dashboard-page-manager';
    dialog.className = 'dashboard-page-manager';
    dialog.setAttribute('aria-labelledby', 'dashboard-page-manager-title');
    dialog.innerHTML = `
      <header><div><p class="eyebrow">Dashboard pages</p><h2 id="dashboard-page-manager-title">Personal and group dashboards</h2><p>Create focused pages without replacing your Home dashboard.</p></div><button type="button" data-close-pages>Close</button></header>
      <div class="dashboard-page-manager-body">
        <section class="dashboard-page-create">
          <h3>Create page</h3>
          <label>Page name<input id="dashboard-new-page-name" maxlength="60" placeholder="Gaming, Family, Servers…"></label>
          <label>Page type<select id="dashboard-new-page-scope"><option value="personal">Personal page</option><option value="group">Group page</option></select></label>
          <label id="dashboard-new-page-group-control" hidden>Group<select id="dashboard-new-page-group"></select></label>
          <label class="dashboard-page-check"><input id="dashboard-clone-current-page" type="checkbox" checked> Start with the current page layout</label>
          <button id="dashboard-create-page" class="primary" type="button">Create page</button>
          <p id="dashboard-page-manager-message" role="status"></p>
        </section>
        <section><h3>Your available pages</h3><div id="dashboard-page-manager-list" class="dashboard-page-manager-list"></div></section>
      </div>`;
    document.body.append(dialog);
    dialog.querySelector('[data-close-pages]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dashboardElement('#dashboard-new-page-scope')?.addEventListener('change', updateGroupPageControls);
    dashboardElement('#dashboard-create-page')?.addEventListener('click', createPage);
    return dialog;
  }

  function pageManagerMessage(text, type = '') {
    const target = dashboardElement('#dashboard-page-manager-message');
    if (!target) return;
    target.textContent = text;
    target.className = type;
  }

  function updateGroupPageControls() {
    const payload = experience.pagesPayload;
    const scope = dashboardElement('#dashboard-new-page-scope');
    const groupControl = dashboardElement('#dashboard-new-page-group-control');
    const groupSelect = dashboardElement('#dashboard-new-page-group');
    const wantsGroup = scope?.value === 'group';
    if (groupControl) groupControl.hidden = !wantsGroup;
    if (groupSelect && payload) {
      groupSelect.replaceChildren(...payload.groups.map(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        return option;
      }));
    }
    if (scope) {
      const groupOption = scope.querySelector('option[value="group"]');
      if (groupOption) groupOption.disabled = !payload?.canCreateGroupPages || !payload.groups.length;
      if (wantsGroup && groupOption?.disabled) scope.value = 'personal';
    }
  }

  function managerPageCard(page) {
    const article = document.createElement('article');
    article.className = 'dashboard-page-manager-card';
    const identity = document.createElement('div');
    identity.innerHTML = `<strong></strong><span></span>`;
    identity.querySelector('strong').textContent = page.name;
    identity.querySelector('span').textContent = page.scope === 'group' ? `Group · ${page.groupName ?? 'Unknown'}` : page.scope === 'home' ? 'Main personal dashboard' : 'Personal page';
    const actions = document.createElement('div');
    const open = document.createElement('button');
    open.type = 'button';
    open.textContent = page.id === experience.activePageId ? 'Current' : 'Open';
    open.disabled = page.id === experience.activePageId;
    open.addEventListener('click', async () => {
      await switchPage(page.id);
      dashboardElement('#dashboard-page-manager')?.close();
    });
    actions.append(open);
    if (page.id !== 'home' && page.canEdit) {
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.textContent = 'Rename';
      rename.addEventListener('click', () => renamePage(page));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger-action';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => deletePage(page));
      actions.append(rename, remove);
    }
    article.append(identity, actions);
    return article;
  }

  function renderPageManager() {
    const list = dashboardElement('#dashboard-page-manager-list');
    if (!list || !experience.pagesPayload) return;
    list.replaceChildren(...experience.pagesPayload.pages.map(managerPageCard));
    updateGroupPageControls();
  }

  function openPageManager() {
    const dialog = ensurePageManager();
    renderPageManager();
    if (!dialog.open) dialog.showModal();
  }

  async function createPage() {
    const name = dashboardElement('#dashboard-new-page-name')?.value.trim();
    const scope = dashboardElement('#dashboard-new-page-scope')?.value ?? 'personal';
    const groupId = scope === 'group' ? dashboardElement('#dashboard-new-page-group')?.value : null;
    const cloneCurrent = dashboardElement('#dashboard-clone-current-page')?.checked !== false;
    if (!name) return pageManagerMessage('Enter a page name.', 'error');
    pageManagerMessage('Creating page…');
    try {
      experience.pagesPayload = await experienceFetch('/api/experience/dashboard/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scope, groupId, layout: cloneCurrent ? currentLayout() : { tiles: [], preferences: currentPreferences() } })
      });
      experience.activePageId = experience.pagesPayload.activePageId;
      applyPageToDashboard(activePage());
      renderPageManager();
      const input = dashboardElement('#dashboard-new-page-name');
      if (input) input.value = '';
      pageManagerMessage(`${name} created.`, 'success');
    } catch (error) {
      pageManagerMessage(error.message, 'error');
    }
  }

  async function renamePage(page) {
    const name = prompt('New page name', page.name)?.trim();
    if (!name || name === page.name) return;
    pageManagerMessage('Renaming page…');
    try {
      experience.pagesPayload = await experienceFetch(`/api/experience/dashboard/pages/${encodeURIComponent(page.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, layout: page.layout })
      });
      renderPageTabs();
      renderPageManager();
      pageManagerMessage('Page renamed.', 'success');
    } catch (error) {
      pageManagerMessage(error.message, 'error');
    }
  }

  async function deletePage(page) {
    if (!confirm(`Delete ${page.name}? This cannot be undone.`)) return;
    pageManagerMessage('Deleting page…');
    try {
      experience.pagesPayload = await experienceFetch(`/api/experience/dashboard/pages/${encodeURIComponent(page.id)}`, { method: 'DELETE' });
      if (experience.activePageId === page.id) {
        experience.activePageId = 'home';
        applyPageToDashboard(pageById('home'));
      }
      renderPageTabs();
      renderPageManager();
      pageManagerMessage('Page deleted.', 'success');
    } catch (error) {
      pageManagerMessage(error.message, 'error');
    }
  }

  async function saveCustomPage() {
    const page = activePage();
    if (!page || page.id === 'home') return;
    if (!page.canEdit) return editorMessage('This group dashboard page is read-only for your account.', 'error');
    editorMessage('Saving dashboard page…');
    try {
      const layout = { tiles: dashboardState.workingTiles.map(serializableTile), preferences: editorPreferences() };
      experience.pagesPayload = await experienceFetch(`/api/experience/dashboard/pages/${encodeURIComponent(page.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: page.name, layout })
      });
      const updated = pageById(page.id);
      dashboardState.payload.pinnedTiles = hydrateLayout(updated.layout);
      dashboardState.payload.preferences = { ...dashboardState.payload.preferences, ...updated.layout.preferences };
      closeEditor(true);
      renderPageTabs();
    } catch (error) {
      editorMessage(error.message, 'error');
    }
  }

  function activityLabel(eventType) {
    return String(eventType ?? 'activity').replaceAll('.', ' ').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function createClockTile(feature, editing) {
    const content = tileSurface(feature, editing, 'dashboard-content-tile dashboard-live-clock');
    const label = document.createElement('span');
    label.className = 'dashboard-content-label';
    label.textContent = editing ? 'LIVE CLOCK PREVIEW' : 'LOCAL TIME';
    const time = document.createElement('strong');
    time.className = 'dashboard-live-clock-time';
    const date = document.createElement('span');
    date.className = 'dashboard-live-clock-date';
    content.append(label, time, date);
    updateClockTiles();
    return content;
  }

  function createActivityTile(feature, editing) {
    const content = tileSurface(feature, editing, 'dashboard-content-tile dashboard-live-activity');
    const heading = document.createElement('div');
    heading.className = 'dashboard-content-heading';
    const label = document.createElement('span');
    label.className = 'dashboard-content-label';
    label.textContent = editing ? 'LIVE ACTIVITY PREVIEW' : 'RECENT ACTIVITY';
    heading.append(label, createStandardTileIcon(feature, 'dashboard-content-icon'));
    const list = document.createElement('div');
    list.className = 'dashboard-live-activity-list';
    const items = experience.live?.activity ?? [];
    if (!items.length) {
      const empty = document.createElement('p');
      empty.textContent = experience.live ? 'No recent account activity.' : 'Loading recent activity…';
      list.append(empty);
    } else {
      items.slice(0, 4).forEach(item => {
        const row = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = activityLabel(item.eventType);
        const date = document.createElement('span');
        date.textContent = new Date(item.createdAt * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
        row.append(name, date);
        list.append(row);
      });
    }
    const summary = document.createElement('span');
    summary.className = 'dashboard-live-summary';
    summary.textContent = `${experience.live?.summary?.groupCount ?? 0} groups · ${experience.live?.summary?.guestbookCount ?? 0} guestbook messages`;
    content.append(heading, list, summary);
    return content;
  }

  const baseCreateTileContent = createTileContent;
  createTileContent = function experienceCreateTileContent(feature, preferences, editing = false) {
    if (feature.id === 'feature-live-clock') return createClockTile(feature, editing);
    if (feature.id === 'feature-live-activity') return createActivityTile(feature, editing);
    return baseCreateTileContent(feature, preferences, editing);
  };

  function updateClockTiles() {
    const now = new Date();
    document.querySelectorAll('.dashboard-live-clock-time').forEach(node => {
      node.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });
    document.querySelectorAll('.dashboard-live-clock-date').forEach(node => {
      node.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    });
  }

  async function refreshLiveData() {
    try {
      experience.live = await experienceFetch('/api/experience/dashboard/live');
      if (dashboardState.payload && !dashboardState.editing) renderDashboardGrid();
    } catch {
      // Live tiles keep their existing content if a refresh fails.
    }
  }

  function historySnapshot() {
    return JSON.stringify({ tiles: dashboardState.workingTiles, preferences: editorPreferences() });
  }

  function captureHistory(force = false) {
    if (!dashboardState.editing || experience.historySuspended) return;
    const serialized = historySnapshot();
    if (!force && experience.history[experience.historyIndex] === serialized) return;
    experience.history = experience.history.slice(0, experience.historyIndex + 1);
    experience.history.push(serialized);
    if (experience.history.length > 50) experience.history.shift();
    experience.historyIndex = experience.history.length - 1;
    updateHistoryButtons();
  }

  function queueHistoryCapture() {
    if (experience.historyQueued || experience.historySuspended) return;
    experience.historyQueued = true;
    queueMicrotask(() => {
      experience.historyQueued = false;
      captureHistory();
    });
  }

  function restoreHistory(index) {
    const serialized = experience.history[index];
    if (!serialized) return;
    const snapshot = JSON.parse(serialized);
    experience.historySuspended = true;
    dashboardState.workingTiles = clone(snapshot.tiles);
    const preferences = snapshot.preferences ?? {};
    const density = dashboardElement('#dashboard-density');
    const gap = dashboardElement('#dashboard-tile-gap');
    const margin = dashboardElement('#dashboard-outer-margin');
    const descriptions = dashboardElement('#dashboard-show-descriptions');
    if (density) density.value = preferences.density ?? 'comfortable';
    if (gap) gap.value = String(preferences.tileGap ?? 12);
    if (margin) margin.value = String(preferences.outerMargin ?? 0);
    if (descriptions) descriptions.checked = preferences.showDescriptions !== false;
    dashboardState.selectedId = dashboardState.workingTiles.some(tile => tile.featureId === dashboardState.selectedId)
      ? dashboardState.selectedId
      : dashboardState.workingTiles[0]?.featureId ?? null;
    renderEditor();
    experience.historySuspended = false;
    experience.historyIndex = index;
    updateHistoryButtons();
  }

  function undoDashboard() {
    if (experience.historyIndex > 0) restoreHistory(experience.historyIndex - 1);
  }

  function redoDashboard() {
    if (experience.historyIndex < experience.history.length - 1) restoreHistory(experience.historyIndex + 1);
  }

  function copySelectedStyle() {
    const tile = workingTile(dashboardState.selectedId);
    if (!tile) return editorMessage('Select a tile before copying its style.', 'error');
    experience.copiedStyle = clone(normalizedTileAppearance(tile));
    editorMessage('Tile style copied. Select another tile and choose Paste style.', 'success');
    updateHistoryButtons();
  }

  function pasteSelectedStyle() {
    const tile = workingTile(dashboardState.selectedId);
    if (!tile || !experience.copiedStyle) return editorMessage('Copy a tile style first, then select the destination tile.', 'error');
    Object.assign(tile, clone(experience.copiedStyle));
    editorMessage('Copied style applied to the selected tile.', 'success');
    renderEditor();
  }

  function updateHistoryButtons() {
    const undo = dashboardElement('#dashboard-undo-layout');
    const redo = dashboardElement('#dashboard-redo-layout');
    const paste = dashboardElement('#dashboard-paste-style');
    if (undo) undo.disabled = experience.historyIndex <= 0;
    if (redo) redo.disabled = experience.historyIndex >= experience.history.length - 1;
    if (paste) paste.disabled = !experience.copiedStyle || !dashboardState.selectedId;
  }

  function ensureEditingTools() {
    if (dashboardElement('#dashboard-undo-layout')) return;
    const actions = dashboardElement('.dashboard-editor-actions');
    const cancel = dashboardElement('#dashboard-cancel-layout');
    if (!actions || !cancel) return;
    const definitions = [
      ['dashboard-undo-layout', 'Undo', undoDashboard],
      ['dashboard-redo-layout', 'Redo', redoDashboard],
      ['dashboard-copy-style', 'Copy style', copySelectedStyle],
      ['dashboard-paste-style', 'Paste style', pasteSelectedStyle]
    ];
    definitions.forEach(([id, label, handler]) => {
      const button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', handler);
      actions.insertBefore(button, cancel);
    });
    updateHistoryButtons();
  }

  const baseOpenEditor = openEditor;
  openEditor = function experienceOpenEditor() {
    const page = activePage();
    if (page && page.id !== 'home' && page.canEdit === false) {
      dashboardMessage('This group dashboard page is read-only for your account.', 'error');
      return;
    }
    experience.history = [];
    experience.historyIndex = -1;
    baseOpenEditor();
    captureHistory(true);
  };

  const baseRenderEditor = renderEditor;
  renderEditor = function experienceRenderEditor() {
    baseRenderEditor();
    queueHistoryCapture();
    updateHistoryButtons();
  };

  const baseRenderDashboardGrid = renderDashboardGrid;
  renderDashboardGrid = function experienceRenderGrid() {
    baseRenderDashboardGrid();
    updateClockTiles();
    if (dashboardState.editing) queueHistoryCapture();
    document.querySelectorAll('.dashboard-profile-card').forEach(card => {
      const profileId = dashboardState.payload?.viewer?.id;
      if (profileId) card.dataset.profileUserId = profileId;
    });
  };

  function installEventRouting() {
    dashboardElement('#dashboard-save-layout')?.addEventListener('click', event => {
      if (experience.activePageId === 'home') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      saveCustomPage();
    }, true);

    document.addEventListener('click', event => {
      const quickPage = event.target.closest('[data-feature-id="feature-quick-page"] a,[data-feature-id="feature-quick-page"] .dashboard-tile-content');
      if (!quickPage) return;
      event.preventDefault();
      openPageManager();
      const name = dashboardElement('#dashboard-new-page-name');
      if (name) name.focus();
    }, true);

    document.addEventListener('keydown', event => {
      if (!dashboardState.editing || !(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redoDashboard() : undoDashboard();
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redoDashboard();
      }
    });
  }

  async function initializeExperience() {
    if (experience.initialized || !dashboardElement('#dashboard-grid')) return;
    experience.initialized = true;
    ensurePageBar();
    ensurePageManager();
    ensureEditingTools();
    installEventRouting();
    experience.clockTimer = window.setInterval(updateClockTiles, 1000);
    experience.liveTimer = window.setInterval(refreshLiveData, 60000);

    for (let attempt = 0; attempt < 80 && !dashboardState.payload; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!dashboardState.payload) return;
    experience.homeSnapshot = {
      pinnedTiles: clone(dashboardState.payload.pinnedTiles ?? []),
      preferences: clone(dashboardState.payload.preferences ?? {})
    };
    try {
      experience.pagesPayload = await experienceFetch('/api/experience/dashboard/pages');
      experience.activePageId = experience.pagesPayload.activePageId ?? 'home';
      renderPageTabs();
      if (experience.activePageId !== 'home') applyPageToDashboard(activePage());
    } catch (error) {
      dashboardMessage(error.message, 'error');
    }
    refreshLiveData();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeExperience, { once: true });
  else initializeExperience();
})();
