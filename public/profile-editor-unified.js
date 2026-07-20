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
    bodyObserver: null,
    backdropPointerDown: false
  };

  const $ = selector => document.querySelector(selector);

  function requestCancel() {
    const cancel = $('#profile-cancel');
    if (cancel) cancel.click();
    else closePanel();
  }

  function pointerIsOutsideDialog(dialog, event) {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  function createPanel() {
    if ($('#profile-unified-editor')) return $('#profile-unified-editor');

    const panel = document.createElement('dialog');
    panel.id = 'profile-unified-editor';
    panel.className = 'profile-unified-editor profile-settings-dialog';
    panel.setAttribute('aria-labelledby', 'profile-unified-title');
    panel.innerHTML = `
      <header class="profile-unified-header profile-dialog-heading">
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
          <div data-unified-slot="cardTiles"></div>
        </section>
        <section class="profile-unified-section" data-unified-section="page" hidden>
          <div class="profile-unified-section-intro"><strong>Whole profile design</strong><span>Change the page canvas, card layout and lower-grid presentation.</span></div>
          <div data-unified-slot="page"></div>
        </section>
        <section class="profile-unified-section" data-unified-section="profileTiles" hidden>
          <div class="profile-unified-section-intro"><strong>Profile tile grid</strong><span>Add content, control spacing, or select a tile to edit it.</span></div>
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
    state.footer = panel.querySelector('.profile-unified-footer');
    state.title = panel.querySelector('[data-unified-title]');
    state.description = panel.querySelector('[data-unified-description]');

    panel.querySelectorAll('.profile-unified-tabs [data-unified-tab]').forEach(button => {
      button.addEventListener('click', () => selectTab(button.dataset.unifiedTab));
    });
    panel.querySelector('[data-unified-close]').addEventListener('click', requestCancel);

    panel.addEventListener('cancel', event => {
      event.preventDefault();
      requestCancel();
    });
    panel.addEventListener('pointerdown', event => {
      state.backdropPointerDown = event.target === panel && pointerIsOutsideDialog(panel, event);
    });
    panel.addEventListener('pointerup', event => {
      const shouldCancel = state.backdropPointerDown && event.target === panel && pointerIsOutsideDialog(panel, event);
      state.backdropPointerDown = false;
      if (shouldCancel) requestCancel();
    });

    return panel;
  }

  function slot(name) {
    return state.panel?.querySelector(`[data-unified-slot="${name}"]`) ?? null;
  }

  function mountOriginalActions() {
    if (!state.panel) return;
    const packSlot = state.panel.querySelector('[data-unified-pack-slot]');
    const saveActions = state.panel.querySelector('[data-unified-save-actions]');
    const pack = $('#profile-pack');
    const cancel = $('#profile-cancel');
    const save = $('#profile-save');

    if (pack && packSlot && pack.parentElement !== packSlot) {
      pack.dataset.unifiedPack = '';
      packSlot.append(pack);
    }
    if (cancel && saveActions && cancel.parentElement !== saveActions) {
      cancel.dataset.unifiedCancel = '';
      saveActions.append(cancel);
    }
    if (save && saveActions && save.parentElement !== saveActions) {
      save.dataset.unifiedSave = '';
      saveActions.append(save);
    }
  }

  function dispatchClose(dialog) {
    dialog.dispatchEvent(new Event('close'));
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
      const wasOpen = dialog.hasAttribute('open');
      dialog.removeAttribute('open');
      if (returnValue !== undefined) dialog.returnValue = String(returnValue);
      if (wasOpen) dispatchClose(dialog);
    };

    const target = slot(tab);
    if (target) target.append(dialog);
  }

  function moveSource(element, tab) {
    const target = slot(tab);
    if (!element || !target || element.dataset.unifiedEditorMoved === 'true') return;
    element.dataset.unifiedEditorMoved = 'true';
    target.append(element);
  }

  function placeEditorMessage() {
    const message = $('#profile-editor-message');
    const messageSlot = state.panel?.querySelector('[data-unified-message-slot]');
    if (message && messageSlot && message.parentElement !== messageSlot) messageSlot.append(message);
  }

  function stopSourceObserver() {
    state.bodyObserver?.disconnect();
    state.bodyObserver = null;
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
    placeEditorMessage();

    state.sourcesMounted = Boolean(
      $('#profile-card-dialog') &&
      $('#profile-design-dialog') &&
      $('#profile-card-tile-dialog') &&
      $('#profile-tile-dialog') &&
      $('#profile-pack') &&
      $('#profile-cancel') &&
      $('#profile-save')
    );
    if (state.sourcesMounted) stopSourceObserver();
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

    state.panel?.querySelectorAll('.profile-unified-tabs [data-unified-tab]').forEach(button => {
      const active = button.dataset.unifiedTab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    state.panel?.querySelectorAll('[data-unified-section]').forEach(section => {
      section.hidden = section.dataset.unifiedSection !== tab;
    });

    ensureTabSource(tab);
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
    if (state.sourcesMounted || state.bodyObserver) return;
    const observer = new MutationObserver(() => mountSources());
    state.bodyObserver = observer;
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      if (state.bodyObserver !== observer) return;
      stopSourceObserver();
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
