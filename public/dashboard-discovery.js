(() => {
  if (typeof dashboardState === 'undefined' || typeof createTileContent !== 'function') return;

  const moduleState = { payload: null, monthOffset: 0, loading: false, timer: null };
  const CATEGORY_ORDER = ['Live', 'Personal modules', 'Quick actions', 'Profile modules', 'Community'];
  const CATEGORY_LABELS = {
    'Live': 'Live information',
    'Personal modules': 'Planning & personal',
    'Quick actions': 'Quick actions',
    'Profile modules': 'Profile & collections',
    'Community': 'Community & social'
  };
  const CATEGORY_DESCRIPTIONS = {
    'Live': 'Current information that updates automatically.',
    'Personal modules': 'Tasks, events, reminders and everyday organisation.',
    'Quick actions': 'Shortcuts for creating content or opening common tools.',
    'Profile modules': 'Personal collections and information shown across your account.',
    'Community': 'Posts, announcements and shared activity.'
  };

  const api = async path => {
    const response = await fetch(path, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'Dashboard module request failed.');
    return payload;
  };
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const eventDate = item => item?.startsAt ? new Date(item.startsAt * 1000) : null;
  const events = () => moduleState.payload?.byType?.event || [];
  const eventsOn = date => events()
    .filter(item => {
      const value = eventDate(item);
      return value && dateKey(value) === dateKey(date);
    })
    .sort((a, b) => (a.startsAt || 0) - (b.startsAt || 0));
  const monthDate = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + moduleState.monthOffset, 1);
  };
  const timeLabel = item => item.startsAt
    ? new Date(item.startsAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'All day';

  function calendarTile(feature, editing) {
    const element = document.createElement('div');
    element.className = 'dashboard-tile-content dashboard-content-tile dashboard-month-calendar';
    const month = monthDate();
    const today = new Date();
    const monthName = month.toLocaleDateString([], { month: 'long', year: 'numeric' });
    const heading = document.createElement('div');
    heading.className = 'dashboard-calendar-heading';
    const identity = document.createElement('div');
    const label = document.createElement('span');
    label.className = 'dashboard-content-label';
    label.textContent = editing ? 'CALENDAR PREVIEW' : 'CALENDAR';
    const title = document.createElement('strong');
    title.textContent = monthName;
    identity.append(label, title);
    heading.append(identity);
    if (!editing) {
      const controls = document.createElement('div');
      controls.className = 'dashboard-calendar-controls';
      [[-1, 'Previous month'], [0, 'Current month'], [1, 'Next month']].forEach(([delta, text]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = delta === -1 ? '‹' : delta === 1 ? '›' : 'Today';
        button.title = text;
        button.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          moduleState.monthOffset = delta === 0 ? 0 : moduleState.monthOffset + delta;
          renderDashboardGrid();
        });
        controls.append(button);
      });
      heading.append(controls);
    }
    element.append(heading);

    const weekdays = document.createElement('div');
    weekdays.className = 'dashboard-calendar-weekdays';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(day => {
      const node = document.createElement('span');
      node.textContent = day;
      weekdays.append(node);
    });
    element.append(weekdays);

    const grid = document.createElement('div');
    grid.className = 'dashboard-calendar-grid';
    const mondayOffset = (month.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let index = 0; index < 42; index += 1) {
      const day = index - mondayOffset + 1;
      const cell = document.createElement('span');
      cell.className = 'dashboard-calendar-day';
      if (day < 1 || day > days) {
        cell.classList.add('outside');
        cell.textContent = '';
      } else {
        const date = new Date(month.getFullYear(), month.getMonth(), day);
        const dayEvents = eventsOn(date);
        cell.textContent = String(day);
        if (dateKey(date) === dateKey(today)) cell.classList.add('today');
        if (dayEvents.length) {
          cell.classList.add('has-events');
          cell.title = dayEvents.map(item => `${timeLabel(item)} ${item.title}`).join('\n');
          const count = document.createElement('b');
          count.textContent = dayEvents.length > 1 ? String(dayEvents.length) : '';
          cell.append(count);
        }
      }
      grid.append(cell);
    }
    element.append(grid);

    const todayPanel = document.createElement('section');
    todayPanel.className = 'dashboard-calendar-today';
    const todayTitle = document.createElement('strong');
    todayTitle.textContent = 'Today';
    todayPanel.append(todayTitle);
    const todayEvents = eventsOn(today);
    if (!todayEvents.length) {
      const empty = document.createElement('span');
      empty.textContent = moduleState.payload ? 'Nothing scheduled today.' : 'Loading today’s events…';
      todayPanel.append(empty);
    } else {
      todayEvents.slice(0, 3).forEach(item => {
        const row = document.createElement('div');
        const time = document.createElement('b');
        time.textContent = timeLabel(item);
        const name = document.createElement('span');
        name.textContent = item.title;
        row.append(time, name);
        todayPanel.append(row);
      });
    }
    element.append(todayPanel);
    if (!editing) {
      const link = document.createElement('a');
      link.className = 'platform-module-open';
      link.href = feature.route || '/hub#calendar';
      link.textContent = 'Open full calendar →';
      element.append(link);
    }
    return element;
  }

  const baseCreateTileContent = createTileContent;
  createTileContent = function discoveryTileContent(feature, preferences, editing = false) {
    if (feature.id === 'feature-module-calendar') return calendarTile(feature, editing);
    return baseCreateTileContent(feature, preferences, editing);
  };

  function categoryRank(category) {
    const index = CATEGORY_ORDER.indexOf(category);
    return index < 0 ? CATEGORY_ORDER.length : index;
  }

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category || 'Other tiles';
  }

  function searchMatchingFeatures({ respectCategory = true } = {}) {
    if (!dashboardState.payload) return [];
    const search = String(dashboardState.search || '').trim().toLowerCase();
    return dashboardState.payload.features.filter(feature => {
      const categoryMatch = !respectCategory || dashboardState.category === 'all' || feature.category === dashboardState.category;
      const searchMatch = !search || `${feature.name} ${feature.description} ${feature.category}`.toLowerCase().includes(search);
      return categoryMatch && searchMatch;
    });
  }

  function ensureCategoryNavigation() {
    const panel = document.querySelector('#dashboard-editor-catalogue-panel');
    const tools = panel?.querySelector('.dashboard-catalogue-tools');
    if (!panel || !tools || !dashboardState.payload) return;
    let navigation = panel.querySelector('#dashboard-category-navigation');
    if (!navigation) {
      navigation = document.createElement('nav');
      navigation.id = 'dashboard-category-navigation';
      navigation.className = 'dashboard-category-navigation';
      navigation.setAttribute('aria-label', 'Tile categories');
      tools.insertAdjacentElement('afterend', navigation);
    }

    const counts = new Map();
    searchMatchingFeatures({ respectCategory: false }).forEach(feature => {
      counts.set(feature.category, (counts.get(feature.category) || 0) + 1);
    });
    const categories = [...counts.keys()].sort((a, b) => categoryRank(a) - categoryRank(b) || categoryLabel(a).localeCompare(categoryLabel(b)));
    const definitions = [['all', 'All tiles', [...counts.values()].reduce((total, value) => total + value, 0)], ...categories.map(category => [category, categoryLabel(category), counts.get(category)])];
    navigation.replaceChildren(...definitions.map(([category, label, count]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tileCategory = category;
      button.className = dashboardState.category === category ? 'active' : '';
      button.setAttribute('aria-pressed', String(dashboardState.category === category));
      const name = document.createElement('span');
      name.textContent = label;
      const badge = document.createElement('b');
      badge.textContent = String(count);
      button.append(name, badge);
      button.addEventListener('click', () => {
        dashboardState.category = category;
        const select = document.querySelector('#dashboard-category-filter');
        if (select) select.value = category;
        renderCatalogue();
      });
      return button;
    }));
  }

  function groupCatalogueCards() {
    const catalogue = document.querySelector('#dashboard-catalogue');
    if (!catalogue || !dashboardState.payload) return;
    const cards = [...catalogue.querySelectorAll(':scope > .dashboard-catalogue-card')];
    if (!cards.length) return;
    const features = searchMatchingFeatures();
    const grouped = new Map();
    cards.forEach((card, index) => {
      const feature = features[index];
      if (!feature) return;
      card.dataset.tileCategory = feature.category;
      if (!grouped.has(feature.category)) grouped.set(feature.category, []);
      grouped.get(feature.category).push(card);
    });
    const categories = [...grouped.keys()].sort((a, b) => categoryRank(a) - categoryRank(b) || categoryLabel(a).localeCompare(categoryLabel(b)));
    catalogue.replaceChildren(...categories.map(category => {
      const section = document.createElement('section');
      section.className = 'dashboard-catalogue-category';
      section.dataset.tileCategory = category;
      const heading = document.createElement('header');
      const identity = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = categoryLabel(category);
      const description = document.createElement('p');
      description.textContent = CATEGORY_DESCRIPTIONS[category] || 'Additional dashboard tiles available to your account.';
      identity.append(title, description);
      const count = document.createElement('span');
      count.textContent = `${grouped.get(category).length} tile${grouped.get(category).length === 1 ? '' : 's'}`;
      heading.append(identity, count);
      const grid = document.createElement('div');
      grid.className = 'dashboard-catalogue-category-grid';
      grid.append(...grouped.get(category));
      section.append(heading, grid);
      return section;
    }));
  }

  const baseRenderCatalogue = renderCatalogue;
  renderCatalogue = function categorizedRenderCatalogue() {
    baseRenderCatalogue();
    ensureCategoryNavigation();
    groupCatalogueCards();
  };

  async function refreshModules(render = false) {
    if (moduleState.loading) return;
    moduleState.loading = true;
    try {
      moduleState.payload = await api('/api/platform/modules');
      if (render && dashboardState.payload && !dashboardState.editing) renderDashboardGrid();
    } catch {
      // Existing tile data remains visible when a refresh fails.
    } finally {
      moduleState.loading = false;
    }
  }

  function ensurePicker() {
    let dialog = document.querySelector('#dashboard-tile-picker-dialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'dashboard-tile-picker-dialog';
      dialog.className = 'dashboard-tile-picker-dialog';
      dialog.setAttribute('aria-labelledby', 'dashboard-tile-picker-title');
      const shell = document.createElement('div');
      shell.className = 'dashboard-tile-picker-shell';
      const heading = document.createElement('header');
      heading.innerHTML = '<div><p class="eyebrow">Dashboard tiles</p><h2 id="dashboard-tile-picker-title">Choose a tile to add</h2><p>Browse by category, search by name, then place a tile directly onto the dashboard.</p></div><button type="button" data-close-tile-picker>Close</button>';
      const body = document.createElement('div');
      body.className = 'dashboard-tile-picker-body';
      shell.append(heading, body);
      dialog.append(shell);
      document.body.append(dialog);
      dialog.querySelector('[data-close-tile-picker]')?.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest('#dashboard-catalogue button');
        if (button && button.textContent === 'Place tile') setTimeout(() => dialog.close(), 0);
      });
    }
    const body = dialog.querySelector('.dashboard-tile-picker-body');
    const catalogue = document.querySelector('#dashboard-editor-catalogue-panel');
    if (body && catalogue && !body.contains(catalogue)) {
      catalogue.hidden = false;
      body.append(catalogue);
    }
    return dialog;
  }

  function ensureAddButton() {
    let button = document.querySelector('#dashboard-open-tile-picker');
    if (button) return button;
    const actions = document.querySelector('.dashboard-editor-actions');
    const pack = document.querySelector('#dashboard-pack-layout');
    if (!actions) return null;
    button = document.createElement('button');
    button.id = 'dashboard-open-tile-picker';
    button.type = 'button';
    button.className = 'dashboard-add-tile-button';
    button.textContent = 'Add tile';
    button.hidden = true;
    button.addEventListener('click', () => {
      if (!dashboardState.editing) return;
      const dialog = ensurePicker();
      renderCatalogueTools();
      renderCatalogue();
      if (!dialog.open) dialog.showModal();
      setTimeout(() => document.querySelector('#dashboard-feature-search')?.focus(), 0);
    });
    actions.insertBefore(button, pack || actions.firstChild);
    return button;
  }

  function syncPickerState() {
    const button = ensureAddButton();
    if (dashboardState.editing) {
      ensurePicker();
      if (button) button.hidden = false;
      return;
    }
    const dialog = document.querySelector('#dashboard-tile-picker-dialog');
    if (dialog?.open) dialog.close();
    if (button) button.hidden = true;
  }

  function installPickerRouting() {
    const scheduleSync = () => queueMicrotask(syncPickerState);
    document.querySelector('#customize-dashboard')?.addEventListener('click', scheduleSync);
    document.querySelector('#dashboard-save-layout')?.addEventListener('click', scheduleSync);
    document.querySelector('#dashboard-cancel-layout')?.addEventListener('click', scheduleSync);
    document.addEventListener('dashboard:editor-opened', syncPickerState);
    const toolbar = document.querySelector('#dashboard-editor-toolbar');
    if (toolbar) new MutationObserver(syncPickerState).observe(toolbar, { attributes: true, attributeFilter: ['hidden'] });
  }

  function installAutomaticDeviceLayout() {
    const media = window.matchMedia?.('(max-width:900px)');
    if (!media) return;
    const storageKey = 'grev-dashboard-layout-mode';
    const actualMode = () => media.matches ? 'mobile' : 'desktop';
    const storedMode = localStorage.getItem(storageKey);
    localStorage.removeItem(storageKey);

    if (storedMode && storedMode !== actualMode() && !sessionStorage.getItem('grev-dashboard-auto-device-corrected')) {
      sessionStorage.setItem('grev-dashboard-auto-device-corrected', '1');
      location.reload();
      return;
    }
    sessionStorage.removeItem('grev-dashboard-auto-device-corrected');

    const concealManualControls = () => {
      const switcher = document.querySelector('.dashboard-device-switch');
      if (switcher) {
        switcher.hidden = true;
        switcher.setAttribute('aria-hidden', 'true');
      }
      const label = document.querySelector('#dashboard-layout-mode-label');
      if (label) label.textContent = `Automatic · ${actualMode() === 'mobile' ? 'Mobile layout' : 'Desktop layout'}`;
      localStorage.removeItem(storageKey);
    };

    const applyActualMode = () => {
      const mode = actualMode();
      const button = document.querySelector(`[data-dashboard-mode="${mode}"]`);
      if (button && !button.classList.contains('active')) button.click();
      else if (!button && !dashboardState.editing) location.reload();
      queueMicrotask(concealManualControls);
      setTimeout(() => localStorage.removeItem(storageKey), 0);
    };

    document.addEventListener('dashboard:editor-opened', () => queueMicrotask(concealManualControls));
    const toolbar = document.querySelector('#dashboard-editor-toolbar');
    if (toolbar) new MutationObserver(concealManualControls).observe(toolbar, { childList: true, subtree: true });
    if (typeof media.addEventListener === 'function') media.addEventListener('change', applyActualMode);
    else media.addListener?.(applyActualMode);
    concealManualControls();
  }

  async function init() {
    installAutomaticDeviceLayout();
    ensureAddButton();
    installPickerRouting();
    syncPickerState();
    for (let attempt = 0; attempt < 80 && !dashboardState.payload; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await refreshModules(true);
    moduleState.timer = setInterval(() => {
      if (!document.hidden) refreshModules(true);
    }, 30000);
    document.addEventListener('grev:platform-changed', () => refreshModules(true));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();