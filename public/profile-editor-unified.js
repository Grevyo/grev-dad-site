(() => {
  const TAB_META = {
    card: ['Profile card', 'Name, bio, pictures, colours and visible details.'],
    cardTiles: ['Card tiles', 'Add and edit the four mini tiles inside your profile card.'],
    page: ['Profile page', 'Background, width, spacing and the overall profile layout.'],
    profileTiles: ['Profile tiles', 'Add, arrange and style the larger tiles below your card.']
  };

  const state = {
    panel: null,
    body: null,
    activeTab: 'card',
    sourcesMounted: false,
    toolbarObserver: null,
    sourceObserver: null,
    tileObservers: [],
    backdropPointerDown: false
  };

  const $ = selector => document.querySelector(selector);

  function requestCancel() {
    const cancel = $('#profile-cancel');
    if (cancel) cancel.click();
    else closePanel();
  }

  function pointerOutside(dialog, event) {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  function existingTilesMarkup(kind, title, description) {
    return `
      <section class="profile-unified-existing-tiles" data-unified-existing="${kind}">
        <div class="profile-unified-existing-heading"><div><strong>${title}</strong><span>${description}</span></div><span data-unified-existing-count>0</span></div>
        <div class="profile-unified-existing-list" data-unified-existing-list="${kind}"></div>
      </section>`;
  }

  function createPanel() {
    const existing = $('#profile-unified-editor');
    if (existing) return existing;

    const panel = document.createElement('dialog');
    panel.id = 'profile-unified-editor';
    panel.className = 'profile-unified-editor profile-settings-dialog';
    panel.setAttribute('aria-labelledby', 'profile-unified-title');
    panel.innerHTML = `
      <header class="profile-unified-header">
        <div>
          <p class="eyebrow">Profile editor</p>
          <h2 id="profile-unified-title" data-unified-title>Profile card</h2>
          <p data-unified-description>Name, bio, pictures, colours and visible details.</p>
        </div>
        <button type="button" data-unified-close>Close</button>
      </header>
      <nav class="profile-unified-tabs" aria-label="Profile editor sections">
        <button type="button" data-unified-tab="card"><strong>Card</strong><span>Identity & pictures</span></button>
        <button type="button" data-unified-tab="cardTiles"><strong>Card tiles</strong><span>Up to four</span></button>
        <button type="button" data-unified-tab="page"><strong>Page</strong><span>Layout & design</span></button>
        <button type="button" data-unified-tab="profileTiles"><strong>Profile tiles</strong><span>Lower grid</span></button>
      </nav>
      <div class="profile-unified-body">
        <section class="profile-unified-section" data-unified-section="card">
          <div class="profile-unified-section-intro"><strong>Profile card details</strong><span>Edit what appears everywhere your mini profile is shown.</span></div>
          <div data-unified-slot="card"></div>
        </section>
        <section class="profile-unified-section" data-unified-section="cardTiles" hidden>
          <div class="profile-unified-section-intro"><strong>Mini tiles</strong><span>Add a site shortcut, external link or completely custom tile.</span></div>
          ${existingTilesMarkup('cardTiles', 'Your card tiles', 'Select an existing mini tile to edit or remove it.')}
          <div data-unified-slot="cardTiles"></div>
        </section>
        <section class="profile-unified-section" data-unified-section="page" hidden>
          <div class="profile-unified-section-intro"><strong>Whole profile design</strong><span>Change the page canvas, card layout and lower-grid presentation.</span></div>
          <div data-unified-slot="page"></div>
        </section>
        <section class="profile-unified-section" data-unified-section="profileTiles" hidden>
          <div class="profile-unified-section-intro"><strong>Profile tile grid</strong><span>Add content, control spacing, or select a tile to edit it.</span></div>
          ${existingTilesMarkup('profileTiles', 'Your profile tiles', 'Select an existing lower tile to edit, resize or remove it.')}
          <div class="profile-unified-grid-actions" data-unified-pack-slot></div>
          <div data-unified-slot="profileTiles"></div>
        </section>
      </div>
      <footer class="profile-unified-footer">
        <div data-unified-message-slot></div>
        <div class="profile-unified-save-actions" data-unified-save-actions></div>
      </footer>`;

    document.body.append(panel);
    state.panel = panel;
    state.body = panel.querySelector('.profile-unified-body');

    panel.querySelectorAll('.profile-unified-tabs [data-unified-tab]').forEach(button => {
      button.addEventListener('click', () => selectTab(button.dataset.unifiedTab));
    });
    panel.querySelector('[data-unified-close]').addEventListener('click', requestCancel);
    panel.addEventListener('cancel', event => {
      event.preventDefault();
      requestCancel();
    });
    panel.addEventListener('pointerdown', event => {
      state.backdropPointerDown = event.target === panel && pointerOutside(panel, event);
    });
    panel.addEventListener('pointerup', event => {
      const cancel = state.backdropPointerDown && event.target === panel && pointerOutside(panel, event);
      state.backdropPointerDown = false;
      if (cancel) requestCancel();
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !panel.open) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      requestCancel();
    }, true);

    return panel;
  }

  function slot(name) {
    return state.panel?.querySelector(`[data-unified-slot="${name}"]`) || null;
  }

  function mountOriginalActions() {
    if (!state.panel) return;
    const pack = $('#profile-pack');
    const cancel = $('#profile-cancel');
    const save = $('#profile-save');
    const packSlot = state.panel.querySelector('[data-unified-pack-slot]');
    const saveSlot = state.panel.querySelector('[data-unified-save-actions]');

    if (pack && packSlot && pack.parentElement !== packSlot) {
      pack.dataset.unifiedPack = '';
      packSlot.append(pack);
    }
    if (cancel && saveSlot && cancel.parentElement !== saveSlot) {
      cancel.dataset.unifiedCancel = '';
      saveSlot.append(cancel);
    }
    if (save && saveSlot && save.parentElement !== saveSlot) {
      save.dataset.unifiedSave = '';
      saveSlot.append(save);
    }
  }

  function prepareDialog(dialog, tab) {
    if (!dialog || dialog.dataset.unifiedEditorReady === 'true') return;
    dialog.dataset.unifiedEditorReady = 'true';
    dialog.dataset.unifiedEditorSection = tab;
    dialog.removeAttribute('data-unified-tab');
    dialog.removeAttribute('aria-selected');
    dialog.classList.remove('is-active');
    dialog.classList.add('profile-editor-inline-dialog');

    dialog.showModal = () => {
      dialog.setAttribute('open', '');
      openPanel(tab);
      queueMicrotask(() => {
        dialog.scrollTop = 0;
        dialog.querySelector('input:not([type="file"]),textarea,select')?.focus({ preventScroll: true });
      });
    };
    dialog.show = dialog.showModal;
    dialog.close = returnValue => {
      const open = dialog.hasAttribute('open');
      dialog.removeAttribute('open');
      if (returnValue !== undefined) dialog.returnValue = String(returnValue);
      if (open) dialog.dispatchEvent(new Event('close'));
    };

    slot(tab)?.append(dialog);
  }

  function moveSource(element, tab) {
    const target = slot(tab);
    if (!element || !target || element.dataset.unifiedEditorMoved === 'true') return;
    element.dataset.unifiedEditorMoved = 'true';
    target.append(element);
  }

  function tileText(element, selectors, fallback) {
    for (const selector of selectors) {
      const value = element.querySelector(selector)?.textContent?.trim();
      if (value) return value;
    }
    return fallback;
  }

  function originalSettingsButton(kind, tileId) {
    const escapedId = CSS.escape(tileId);
    if (kind === 'cardTiles') {
      return document.querySelector(`.profile-card-mini-tile[data-tile-id="${escapedId}"] .profile-card-mini-settings`);
    }
    return document.querySelector(`#profile-grid .profile-tile[data-tile-id="${escapedId}"] .profile-tile-settings-button`);
  }

  function existingTileButton(kind, element, index) {
    const tileId = element.dataset.tileId;
    const cardTile = kind === 'cardTiles';
    const title = tileText(element, cardTile ? ['.profile-card-mini-title', '.profile-card-mini-media-title'] : ['h2'], cardTile ? `Card tile ${index + 1}` : `Profile tile ${index + 1}`);
    const detail = tileText(element, cardTile ? ['.profile-card-mini-kind', '.profile-card-mini-description'] : ['.profile-tile-kind'], cardTile ? 'Card tile' : 'Profile tile');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-unified-existing-tile';
    button.dataset.tileId = tileId;
    button.innerHTML = `<span><strong></strong><small></small></span><b>Edit tile</b>`;
    button.querySelector('strong').textContent = title;
    button.querySelector('small').textContent = detail;
    button.addEventListener('click', () => {
      const settings = originalSettingsButton(kind, tileId);
      if (!settings) {
        refreshExistingTileLists();
        return;
      }
      settings.click();
      openPanel(kind);
    });
    return button;
  }

  function renderExistingTileList(kind, elements) {
    const section = state.panel?.querySelector(`[data-unified-existing="${kind}"]`);
    const list = section?.querySelector(`[data-unified-existing-list="${kind}"]`);
    const count = section?.querySelector('[data-unified-existing-count]');
    if (!section || !list || !count) return;
    count.textContent = String(elements.length);
    if (!elements.length) {
      const empty = document.createElement('p');
      empty.className = 'profile-unified-existing-empty';
      empty.textContent = kind === 'cardTiles' ? 'No card tiles yet. Add one below.' : 'No profile tiles yet. Add one below.';
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...elements.map((element, index) => existingTileButton(kind, element, index)));
  }

  function refreshExistingTileLists() {
    if (!state.panel) return;
    const cardTiles = [...document.querySelectorAll('#profile-card .profile-card-mini-tile[data-tile-id]')];
    const profileTiles = [...document.querySelectorAll('#profile-grid .profile-tile[data-tile-id]')];
    renderExistingTileList('cardTiles', cardTiles);
    renderExistingTileList('profileTiles', profileTiles);
  }

  function installTileObservers() {
    if (state.tileObservers.length) return;
    for (const root of [$('#profile-card'), $('#profile-grid')]) {
      if (!root) continue;
      const observer = new MutationObserver(() => queueMicrotask(refreshExistingTileLists));
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      state.tileObservers.push(observer);
    }
  }

  function mountSources() {
    if (!state.panel) return;
    mountOriginalActions();
    prepareDialog($('#profile-card-dialog'), 'card');
    prepareDialog($('#profile-design-dialog'), 'page');
    prepareDialog($('#profile-card-tile-dialog'), 'cardTiles');
    prepareDialog($('#profile-tile-dialog'), 'profileTiles');
    moveSource($('#profile-card-tile-editor'), 'cardTiles');
    moveSource($('.profile-editor-preferences'), 'profileTiles');
    moveSource($('#profile-catalogue'), 'profileTiles');

    const message = $('#profile-editor-message');
    const messageSlot = state.panel.querySelector('[data-unified-message-slot]');
    if (message && messageSlot && message.parentElement !== messageSlot) messageSlot.append(message);

    refreshExistingTileLists();
    installTileObservers();

    state.sourcesMounted = Boolean(
      $('#profile-card-dialog') &&
      $('#profile-design-dialog') &&
      $('#profile-card-tile-dialog') &&
      $('#profile-tile-dialog') &&
      $('#profile-pack') &&
      $('#profile-cancel') &&
      $('#profile-save')
    );
    if (state.sourcesMounted) {
      state.sourceObserver?.disconnect();
      state.sourceObserver = null;
    }
  }

  function ensureTabSource(tab) {
    mountSources();
    if (tab === 'card') {
      const dialog = $('#profile-card-dialog');
      if (dialog && !dialog.hasAttribute('open')) $('#profile-card-settings')?.click();
    }
    if (tab === 'page') {
      const dialog = $('#profile-design-dialog');
      if (dialog && !dialog.hasAttribute('open')) $('#profile-design-settings')?.click();
    }
  }

  function selectTab(tab) {
    if (!TAB_META[tab]) tab = 'card';
    state.activeTab = tab;
    const [title, description] = TAB_META[tab];
    const titleNode = state.panel?.querySelector('[data-unified-title]');
    const descriptionNode = state.panel?.querySelector('[data-unified-description]');
    if (titleNode) titleNode.textContent = title;
    if (descriptionNode) descriptionNode.textContent = description;

    state.panel?.querySelectorAll('.profile-unified-tabs [data-unified-tab]').forEach(button => {
      const active = button.dataset.unifiedTab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    state.panel?.querySelectorAll('[data-unified-section]').forEach(section => {
      section.hidden = section.dataset.unifiedSection !== tab;
    });

    ensureTabSource(tab);
    refreshExistingTileLists();
    if (state.body) state.body.scrollTop = 0;
  }

  function openPanel(tab = state.activeTab) {
    if (!state.panel) return;
    document.body.classList.add('profile-unified-editing');
    if (!state.panel.open) {
      try {
        state.panel.showModal();
      } catch {
        state.panel.setAttribute('open', '');
      }
    }
    selectTab(tab);
  }

  function closePanel() {
    if (!state.panel) return;
    document.body.classList.remove('profile-unified-editing', 'profile-unified-previewing', 'profile-mobile-editor-scroll-locked');
    state.panel.querySelectorAll('dialog[open]').forEach(dialog => dialog.removeAttribute('open'));
    if (state.panel.open) state.panel.close();
    else state.panel.removeAttribute('open');
  }

  function editingIsActive() {
    const toolbar = $('#profile-editor-toolbar');
    return Boolean(toolbar && !toolbar.hidden);
  }

  function syncEditorState() {
    mountSources();
    if (!editingIsActive()) return closePanel();
    openPanel(state.activeTab || 'card');
    if (state.activeTab === 'card' && !$('#profile-card-dialog')?.hasAttribute('open')) {
      queueMicrotask(() => ensureTabSource('card'));
    }
  }

  function installSourceObserver() {
    if (state.sourcesMounted || state.sourceObserver) return;
    state.sourceObserver = new MutationObserver(mountSources);
    state.sourceObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      if (!state.sourceObserver) return;
      state.sourceObserver.disconnect();
      state.sourceObserver = null;
      mountSources();
    }, 5000);
  }

  function installToolbarObserver() {
    const toolbar = $('#profile-editor-toolbar');
    if (!toolbar) return;
    state.toolbarObserver = new MutationObserver(syncEditorState);
    state.toolbarObserver.observe(toolbar, { attributes: true, attributeFilter: ['hidden'] });
  }

  function installActionRouting() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('[data-quick-card-details],#profile-card-settings')) queueMicrotask(() => openPanel('card'));
      if (target.closest('[data-quick-profile-design],#profile-design-settings')) queueMicrotask(() => openPanel('page'));
      if (target.closest('[data-add-card-tile],.profile-card-empty-slot,.profile-card-mini-settings')) queueMicrotask(() => openPanel('cardTiles'));
      if (target.closest('[data-add-profile-tile],.profile-tile-settings-button')) queueMicrotask(() => openPanel('profileTiles'));
    }, true);
  }

  function initialise() {
    createPanel();
    mountSources();
    installSourceObserver();
    installToolbarObserver();
    installActionRouting();
    syncEditorState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
