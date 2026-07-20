(() => {
  const $ = selector => document.querySelector(selector);
  const mobile = matchMedia('(max-width:820px)');
  const scrollState = {
    locked: false,
    scrollY: 0,
    bodyStyles: null,
    htmlOverflow: '',
    focusedControl: null
  };

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

  function updateViewportMetrics() {
    const viewport = window.visualViewport;
    const visibleHeight = Math.max(240, Math.round(viewport?.height || window.innerHeight));
    document.documentElement.style.setProperty('--profile-visible-height', `${visibleHeight}px`);
    document.documentElement.style.setProperty('--profile-editor-bottom-offset', '0px');
  }

  function releasePageScroll() {
    const body = document.body;
    if (scrollState.locked) {
      const saved = scrollState.bodyStyles || {};
      const restoreY = scrollState.scrollY;
      body.style.position = saved.position || '';
      body.style.top = saved.top || '';
      body.style.left = saved.left || '';
      body.style.right = saved.right || '';
      body.style.width = saved.width || '';
      body.style.overflow = saved.overflow || '';
      document.documentElement.style.overflow = scrollState.htmlOverflow || '';
      scrollState.locked = false;
      window.scrollTo(0, restoreY);
    }
    body.classList.remove('profile-mobile-editor-scroll-locked', 'profile-unified-previewing');
  }

  function ensureFocusedControlVisible(editor, control = scrollState.focusedControl || document.activeElement) {
    if (!mobile.matches || !(control instanceof HTMLElement) || !editor.contains(control)) return;
    requestAnimationFrame(() => control.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  }

  function configurePreviewToggle(editor) {
    const button = editor.querySelector('[data-unified-preview]');
    if (!button) return;
    button.hidden = true;
    editor.classList.remove('is-collapsed');
    button.setAttribute('aria-expanded', 'true');
  }

  function configureInlineMobile(editor) {
    if (editor.dataset.inlineMobileReady === 'true') {
      releasePageScroll();
      return;
    }
    editor.dataset.inlineMobileReady = 'true';

    const observer = new MutationObserver(() => {
      releasePageScroll();
      configurePreviewToggle(editor);
    });
    observer.observe(editor, { attributes: true, attributeFilter: ['class', 'hidden'] });

    editor.addEventListener('focusin', event => {
      if (!(event.target instanceof HTMLElement)) return;
      scrollState.focusedControl = event.target;
      ensureFocusedControlVisible(editor, event.target);
    });

    const handleViewportChange = () => {
      updateViewportMetrics();
      ensureFocusedControlVisible(editor);
    };
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    window.addEventListener('pagehide', releasePageScroll);
    mobile.addEventListener('change', () => {
      configurePreviewToggle(editor);
      releasePageScroll();
    });

    releasePageScroll();
  }

  function configure() {
    const editor = $('#profile-unified-editor');
    if (!editor) return false;
    cleanDialogMarkers(editor);
    configureTabs(editor);
    configurePreviewToggle(editor);
    configureInlineMobile(editor);
    return true;
  }

  function initialise() {
    updateViewportMetrics();
    if (configure()) return;
    const observer = new MutationObserver(() => {
      if (configure()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
