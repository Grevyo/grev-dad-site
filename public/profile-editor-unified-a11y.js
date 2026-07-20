(() => {
  const $ = selector => document.querySelector(selector);
  const mobile = matchMedia('(max-width:820px)');

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

  function updateViewportMetrics() {
    const visibleHeight = Math.max(240, Math.round(window.visualViewport?.height || window.innerHeight));
    document.documentElement.style.setProperty('--profile-visible-height', `${visibleHeight}px`);
    document.documentElement.style.setProperty('--profile-editor-bottom-offset', '0px');
  }

  function releaseLegacyPageLock() {
    document.body.classList.remove('profile-mobile-editor-scroll-locked', 'profile-unified-previewing');
  }

  function hideLegacyPreview(editor) {
    const button = editor.querySelector('[data-unified-preview]');
    if (button) {
      button.hidden = true;
      button.setAttribute('aria-expanded', 'true');
    }
    editor.classList.remove('is-collapsed');
  }

  function configureFocus(editor) {
    if (editor.dataset.inlineFocusReady === 'true') return;
    editor.dataset.inlineFocusReady = 'true';
    editor.addEventListener('focusin', event => {
      if (!mobile.matches || !(event.target instanceof HTMLElement)) return;
      requestAnimationFrame(() => event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    });
  }

  function configure() {
    const editor = $('#profile-unified-editor');
    if (!editor) return false;
    configureTabs(editor);
    hideLegacyPreview(editor);
    configureFocus(editor);
    updateViewportMetrics();
    releaseLegacyPageLock();
    return true;
  }

  function initialise() {
    if (configure()) return;
    requestAnimationFrame(() => configure());
  }

  window.visualViewport?.addEventListener('resize', updateViewportMetrics);
  window.addEventListener('resize', () => {
    updateViewportMetrics();
    const editor = $('#profile-unified-editor');
    if (editor) hideLegacyPreview(editor);
    releaseLegacyPageLock();
  });
  window.addEventListener('orientationchange', updateViewportMetrics);
  window.addEventListener('pagehide', releaseLegacyPageLock);
  mobile.addEventListener('change', () => {
    const editor = $('#profile-unified-editor');
    if (editor) hideLegacyPreview(editor);
    releaseLegacyPageLock();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
