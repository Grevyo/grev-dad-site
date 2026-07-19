(() => {
  const $ = selector => document.querySelector(selector);

  function tabName(button) {
    return button?.dataset.unifiedTab || 'card';
  }

  function syncTabState(editor) {
    const buttons = [...editor.querySelectorAll('.profile-unified-tabs [data-unified-tab]')];
    for (const button of buttons) {
      const active = button.classList.contains('is-active');
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
  }

  function configureTabs(editor) {
    const nav = editor.querySelector('.profile-unified-tabs');
    if (!nav) return;
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-orientation', 'horizontal');

    const buttons = [...nav.querySelectorAll('[data-unified-tab]')];
    for (const button of buttons) {
      const name = tabName(button);
      const section = editor.querySelector(`[data-unified-section="${name}"]`);
      const tabId = `profile-unified-tab-${name}`;
      const panelId = `profile-unified-panel-${name}`;
      button.id = tabId;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', panelId);
      if (section) {
        section.id = panelId;
        section.setAttribute('role', 'tabpanel');
        section.setAttribute('aria-labelledby', tabId);
        section.tabIndex = 0;
      }
    }

    if (nav.dataset.keyboardReady !== 'true') {
      nav.dataset.keyboardReady = 'true';
      nav.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const current = buttons.indexOf(document.activeElement);
        if (current < 0) return;
        event.preventDefault();
        let next = current;
        if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
        if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        buttons[next].click();
        buttons[next].focus();
      });
      nav.addEventListener('click', () => queueMicrotask(() => syncTabState(editor)));
    }
    syncTabState(editor);
  }

  function cleanDialogMarkers(editor) {
    editor.querySelectorAll('dialog[data-unified-tab]').forEach(dialog => {
      dialog.removeAttribute('data-unified-tab');
      dialog.removeAttribute('aria-selected');
      dialog.classList.remove('is-active');
    });
  }

  function configurePreviewToggle(editor) {
    const button = editor.querySelector('[data-unified-preview]');
    if (!button) return;
    const mobile = matchMedia('(max-width:820px)');
    const apply = () => {
      button.hidden = !mobile.matches;
      if (!mobile.matches && editor.classList.contains('is-collapsed')) {
        editor.classList.remove('is-collapsed');
        button.textContent = 'Preview';
        button.setAttribute('aria-expanded', 'true');
      }
    };
    apply();
    if (button.dataset.mobileReady !== 'true') {
      button.dataset.mobileReady = 'true';
      mobile.addEventListener('change', apply);
    }
  }

  function configure() {
    const editor = $('#profile-unified-editor');
    if (!editor) return false;
    cleanDialogMarkers(editor);
    configureTabs(editor);
    configurePreviewToggle(editor);
    return true;
  }

  function initialise() {
    if (configure()) return;
    const observer = new MutationObserver(() => {
      if (configure()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
