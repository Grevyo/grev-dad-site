(() => {
  const TAB_META = {
    card: {
      title: 'Profile card',
      description: 'Name, bio, pictures, colours and visible details.'
    },
    cardTiles: {
      title: 'Card tiles',
      description: 'Add and edit the four mini tiles inside your profile card.'
    },
    page: {
      title: 'Profile page',
      description: 'Background, width, spacing and the overall profile layout.'
    },
    profileTiles: {
      title: 'Profile tiles',
      description: 'Add, arrange and style the larger tiles below your card.'
    }
  };

  const state = {
    panel: null,
    body: null,
    footer: null,
    title: null,
    description: null,
    activeTab: 'card',
    sourcesMounted: false,
    toolbarObserver: null,
    bodyObserver: null
  };

  const $ = selector => document.querySelector(selector);

  function createPanel() {
    if ($('#profile-unified-editor')) return $('#profile-unified-editor');

    const panel = document.createElement('aside');
    panel.id = 'profile-unified-editor';
    panel.className = 'profile-unified-editor';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Profile editor');
    panel.innerHTML = `
      <header class="profile-unified-header">
        <div>
          <p class="eyebrow">Profile editor</p>
          <h2 data-unified-title>Profile card</h2>
          <p data-unified-description>Name, bio, pictures, colours and visible details.</p>
        </div>
        <button type="button" class="profile-unified-preview" data-unified-preview aria-expanded="true">Preview</button>
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
          <div data-unified-slot="cardTiles"></div>
        </section>
        <section class="profile-unified-section" data-unified-section="page" hidden>
          <div class="profile-unified-section-intro"><strong>Whole profile design</strong><span>Change the page canvas, card layout and lower-grid presentation.</span></div>
          <div data-unified-slot="page"></div>
        </section>
        <section class="profile-unified-section" data-unified-section="profileTiles" hidden>
          <div class="profile-unified-section-intro"><strong>Profile tile grid</strong><span>Add content, control spacing, or select a tile on the preview to edit it.</span></div>
          <div class="profile-unified-grid-actions"><button type="button" data-unified-pack>Pack profile tiles</button></div>
          <div data-unified-slot="profileTiles"></div>
        </section>
      </div>
      <footer class="profile-unified-footer">
        <div data-unified-message-slot></div>
        <div class="profile-unified-save-actions">
          <button type="button" data-unified-cancel>Cancel</button>
          <button type="button" class="primary" data-unified-save>Save profile</button>
        </div>
      </footer>`;

    const toolbar = $('#profile-editor-toolbar');
    if (toolbar) toolbar.insertAdjacentElement('afterend', panel);
    else document.body.append(panel);

    state.panel = panel;
    state.body = panel.querySelector('.profile-unified-body');
    state.footer = panel.querySelector('.profile-unified-footer');
    state.title = panel.querySelector('[data-unified-title]');
    state.description = panel.querySelector('[data-unified-description]');

    panel.querySelectorAll('[data-unified-tab]').forEach(button => {
      button.addEventListener('click', () => selectTab(button.dataset.unifiedTab));
    });
    panel.querySelector('[data-unified-cancel]').addEventListener('click', () => $('#profile-cancel')?.click());
    panel.querySelector('[data-unified-save]').addEventListener('click', () => $('#profile-save')?.click());
    panel.querySelector('[data-unified-pack]').addEventListener('click', () => $('#profile-pack')?.click());
    panel.querySelector('[data-unified-preview]').addEventListener('click', event => {
      const collapsed = panel.classList.toggle('is-collapsed');
      event.currentTarget.textContent = collapsed ? 'Edit' : 'Preview';
      event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
    });

    return panel;
  }

  function slot(name) {
    return state.panel?.querySelector(`[data-unified-slot="${name}"]`) ?? null;
  }

  function dispatchClose(dialog) {
    dialog.dispatchEvent(new Event('close'));
  }

  function prepareDialog(dialog, tab) {
    if (!dialog || dialog.dataset.unifiedEditorReady === 'true') return;
    dialog.dataset.unifiedEditorReady = 'true';
    dialog.dataset.unifiedTab = tab;
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
      const wasOpen = dialog.hasAttribute('open');
      dialog.removeAttribute('open');
      if (returnValue !== undefined) dialog.returnValue = String(returnValue);
      if (wasOpen) dispatchClose(dialog);
    };

    const target = slot(tab);
    if (target) target.append(dialog);
  }

  function moveSource(element, tab, before = null) {
    const target = slot(tab);
    if (!element || !target || element.dataset.unifiedEditorMoved === 'true') return;
    element.dataset.unifiedEditorMoved = 'true';
    if (before) target.insertBefore(element, before);
    else target.append(element);
  }

  function mountSources() {
    if (!state.panel) return;

    prepareDialog($('#profile-card-dialog'), 'card');
    prepareDialog($('#profile-design-dialog'), 'page');
    prepareDialog($('#profile-card-tile-dialog'), 'cardTiles');
    prepareDialog($('#profile-tile-dialog'), 'profileTiles');

    moveSource($('#profile-card-tile-editor'), 'cardTiles');
    moveSource($('.profile-editor-preferences'), 'profileTiles');
    moveSource($('#profile-catalogue'), 'profileTiles');

    const message = $('#profile-editor-message');
    const messageSlot = state.panel.querySelector('[data-unified-message-slot]');
    if (message && messageSlot && message.dataset.unifiedEditorMoved !== 'true') {
      message.dataset.unifiedEditorMoved = 'true';
      messageSlot.append(message);
    }

    state.sourcesMounted = Boolean(
      $('#profile-card-dialog') &&
      $('#profile-design-dialog') &&
      $('#profile-card-tile-dialog') &&
      $('#profile-tile-dialog')
    );
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
    const meta = TAB_META[tab];
    if (state.title) state.title.textContent = meta.title;
    if (state.description) state.description.textContent = meta.description;

    state.panel?.querySelectorAll('[data-unified-tab]').forEach(button => {
      const active = button.dataset.unifiedTab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    state.panel?.querySelectorAll('[data-unified-section]').forEach(section => {
      section.hidden = section.dataset.unifiedSection !== tab;
    });

    ensureTabSource(tab);
    state.body?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function openPanel(tab = state.activeTab) {
    if (!state.panel) return;
    const wasHidden = state.panel.hidden;
    state.panel.hidden = false;
    state.panel.classList.remove('is-collapsed');
    const previewButton = state.panel.querySelector('[data-unified-preview]');
    if (previewButton) {
      previewButton.textContent = 'Preview';
      previewButton.setAttribute('aria-expanded', 'true');
    }
    document.body.classList.add('profile-unified-editing');
    selectTab(tab);
    if (wasHidden && matchMedia('(max-width:820px)').matches) {
      requestAnimationFrame(() => $('#profile-editor-toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }

  function closePanel() {
    if (!state.panel) return;
    state.panel.hidden = true;
    state.panel.classList.remove('is-collapsed');
    document.body.classList.remove('profile-unified-editing', 'profile-unified-previewing');
    state.panel.querySelectorAll('dialog[open]').forEach(dialog => dialog.removeAttribute('open'));
  }

  function editingIsActive() {
    const toolbar = $('#profile-editor-toolbar');
    return Boolean(toolbar && !toolbar.hidden);
  }

  function syncEditorState() {
    mountSources();
    if (editingIsActive()) {
      openPanel(state.activeTab || 'card');
      if (!$('#profile-card-dialog')?.hasAttribute('open') && state.activeTab === 'card') {
        queueMicrotask(() => ensureTabSource('card'));
      }
    } else {
      closePanel();
    }
  }

  function installDialogObserver() {
    state.bodyObserver = new MutationObserver(() => mountSources());
    state.bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  function installToolbarObserver() {
    const toolbar = $('#profile-editor-toolbar');
    if (!toolbar) return;
    state.toolbarObserver = new MutationObserver(syncEditorState);
    state.toolbarObserver.observe(toolbar, { attributes: true, attributeFilter: ['hidden'] });
  }

  function installActionRouting() {
    document.addEventListener('click', event => {
      if (event.target.closest('[data-quick-card-details],#profile-card-settings')) {
        queueMicrotask(() => openPanel('card'));
      }
      if (event.target.closest('[data-quick-profile-design],#profile-design-settings')) {
        queueMicrotask(() => openPanel('page'));
      }
      if (event.target.closest('[data-add-card-tile],.profile-card-empty-slot,.profile-card-mini-settings')) {
        queueMicrotask(() => openPanel('cardTiles'));
      }
      if (event.target.closest('[data-add-profile-tile],.profile-tile-settings-button')) {
        queueMicrotask(() => openPanel('profileTiles'));
      }
    }, true);
  }

  function initialise() {
    createPanel();
    mountSources();
    installDialogObserver();
    installToolbarObserver();
    installActionRouting();
    syncEditorState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
