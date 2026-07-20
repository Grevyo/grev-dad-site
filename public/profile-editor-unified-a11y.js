(() => {
  const $ = selector => document.querySelector(selector);
  const mobile = matchMedia('(max-width:820px)');
  const scrollState = {
    locked: false,
    scrollY: 0,
    bodyStyles: null,
    htmlOverflow: '',
    editorObserver: null,
    bodyObserver: null,
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
    const bottomOffset = viewport
      ? Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
      : 0;
    document.documentElement.style.setProperty('--profile-visible-height', `${visibleHeight}px`);
    document.documentElement.style.setProperty('--profile-editor-bottom-offset', `${bottomOffset}px`);
  }

  function lockPageScroll() {
    if (scrollState.locked) return;
    const body = document.body;
    scrollState.scrollY = window.scrollY;
    scrollState.bodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow
    };
    scrollState.htmlOverflow = document.documentElement.style.overflow;
    body.style.position = 'fixed';
    body.style.top = `-${scrollState.scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    body.classList.add('profile-mobile-editor-scroll-locked');
    scrollState.locked = true;
  }

  function releasePageScroll() {
    if (!scrollState.locked) return;
    const body = document.body;
    const saved = scrollState.bodyStyles || {};
    body.style.position = saved.position || '';
    body.style.top = saved.top || '';
    body.style.left = saved.left || '';
    body.style.right = saved.right || '';
    body.style.width = saved.width || '';
    body.style.overflow = saved.overflow || '';
    document.documentElement.style.overflow = scrollState.htmlOverflow || '';
    body.classList.remove('profile-mobile-editor-scroll-locked');
    scrollState.locked = false;
    requestAnimationFrame(() => window.scrollTo(0, scrollState.scrollY));
  }

  function editorIsOpen(editor) {
    return Boolean(editor && !editor.hidden && document.body.classList.contains('profile-unified-editing'));
  }

  function syncMobileScrollState(editor) {
    updateViewportMetrics();
    const open = editorIsOpen(editor);
    const previewing = open && mobile.matches && editor.classList.contains('is-collapsed');
    document.body.classList.toggle('profile-unified-previewing', previewing);
    if (open && mobile.matches && !previewing) lockPageScroll();
    else releasePageScroll();
  }

  function ensureFocusedControlVisible(editor, control = scrollState.focusedControl || document.activeElement) {
    if (!mobile.matches || !(control instanceof HTMLElement) || !editor.contains(control)) return;
    const scroller = editor.querySelector('.profile-unified-body');
    if (!scroller || !scroller.contains(control)) return;

    const adjust = () => {
      const scrollerRect = scroller.getBoundingClientRect();
      const controlRect = control.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (viewport?.height || window.innerHeight);
      const visibleTop = Math.max(scrollerRect.top, viewportTop) + 16;
      const visibleBottom = Math.min(scrollerRect.bottom, viewportBottom) - 20;
      if (visibleBottom <= visibleTop) return;
      if (controlRect.bottom > visibleBottom) {
        scroller.scrollTop += controlRect.bottom - visibleBottom;
      } else if (controlRect.top < visibleTop) {
        scroller.scrollTop += controlRect.top - visibleTop;
      }
    };

    adjust();
    requestAnimationFrame(adjust);
  }

  function configurePreviewToggle(editor) {
    const button = editor.querySelector('[data-unified-preview]');
    if (!button) return;
    const apply = () => {
      button.hidden = !mobile.matches;
      if (!mobile.matches && editor.classList.contains('is-collapsed')) {
        editor.classList.remove('is-collapsed');
        button.textContent = 'Preview';
        button.setAttribute('aria-expanded', 'true');
      }
      syncMobileScrollState(editor);
    };
    apply();
    if (button.dataset.mobileReady !== 'true') {
      button.dataset.mobileReady = 'true';
      mobile.addEventListener('change', apply);
      button.addEventListener('click', () => queueMicrotask(() => syncMobileScrollState(editor)), true);
    }
  }

  function configureMobileScrolling(editor) {
    if (editor.dataset.mobileScrollReady === 'true') {
      syncMobileScrollState(editor);
      return;
    }
    editor.dataset.mobileScrollReady = 'true';

    scrollState.editorObserver = new MutationObserver(() => syncMobileScrollState(editor));
    scrollState.editorObserver.observe(editor, { attributes: true, attributeFilter: ['class', 'hidden'] });

    scrollState.bodyObserver = new MutationObserver(() => syncMobileScrollState(editor));
    scrollState.bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    editor.addEventListener('focusin', event => {
      if (!(event.target instanceof HTMLElement)) return;
      scrollState.focusedControl = event.target;
      requestAnimationFrame(() => requestAnimationFrame(() => ensureFocusedControlVisible(editor, event.target)));
    });

    const viewport = window.visualViewport;
    const handleViewportChange = () => {
      updateViewportMetrics();
      requestAnimationFrame(() => requestAnimationFrame(() => ensureFocusedControlVisible(editor)));
      setTimeout(() => ensureFocusedControlVisible(editor), 120);
    };
    viewport?.addEventListener('resize', handleViewportChange);
    viewport?.addEventListener('scroll', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    window.addEventListener('pagehide', releasePageScroll);

    syncMobileScrollState(editor);
  }

  function configure() {
    const editor = $('#profile-unified-editor');
    if (!editor) return false;
    cleanDialogMarkers(editor);
    configureTabs(editor);
    configurePreviewToggle(editor);
    configureMobileScrolling(editor);
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
