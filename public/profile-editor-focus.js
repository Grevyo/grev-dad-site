(() => {
  if (window.GrevProfileFocusEditor?.version >= 1) return;

  const STEPS = [
    { key: 'basics', label: 'About you', short: 'Name, headline and bio', title: 'About you', description: 'Set the core information people see on your profile card.' },
    { key: 'pictures', label: 'Pictures', short: 'Avatar and cover', title: 'Profile pictures', description: 'Choose your profile picture and cover image without mixing them with other settings.' },
    { key: 'card-look', label: 'Card look', short: 'Colours, shape and spacing', title: 'Profile card look', description: 'Control the card colours, proportions and the small-button layout.' },
    { key: 'visibility', label: 'Visibility', short: 'Choose what appears', title: 'Visible profile details', description: 'Turn individual details and sections on or off in one place.' },
    { key: 'card-tiles', label: 'Card buttons', short: 'Shortcuts inside the card', title: 'Profile card buttons', description: 'Add and edit the small buttons that travel with your profile card.' },
    { key: 'page-look', label: 'Page design', short: 'Background and page width', title: 'Profile page design', description: 'Change the background, font, width and spacing of the full profile page.' },
    { key: 'profile-tiles', label: 'Profile tiles', short: 'Content below the card', title: 'Profile tiles', description: 'Add and edit the larger tiles shown underneath your profile card.' }
  ];

  const state = { panel: null, body: null, shell: null, nav: null, current: 0, applying: false, observer: null };
  const $ = selector => document.querySelector(selector);

  function cardSections() {
    return [...document.querySelectorAll('#profile-card-dialog .profile-dialog-body > .profile-settings-section')];
  }

  function designSections() {
    return [...document.querySelectorAll('#profile-design-dialog .profile-dialog-body > .profile-settings-section')];
  }

  function sourceReady() {
    return Boolean($('#profile-card-dialog') && $('#profile-design-dialog') && $('[data-unified-section="cardTiles"]') && $('[data-unified-section="profileTiles"]'));
  }

  function clickSource(selector) {
    const button = $(selector);
    if (!button) return;
    state.applying = true;
    button.click();
    queueMicrotask(() => { state.applying = false; });
  }

  function ensureSources(step) {
    const needsCard = ['basics', 'pictures', 'card-look', 'visibility'].includes(step.key);
    const needsDesign = ['card-look', 'visibility', 'page-look'].includes(step.key);
    const cardDialog = $('#profile-card-dialog');
    const designDialog = $('#profile-design-dialog');
    if (needsCard && cardDialog && !cardDialog.hasAttribute('open')) clickSource('#profile-card-settings');
    if (needsDesign && designDialog && !designDialog.hasAttribute('open')) clickSource('#profile-design-settings');
    if (needsCard) cardDialog?.setAttribute('open', '');
    if (needsDesign) designDialog?.setAttribute('open', '');
  }

  function hideAllSources() {
    state.panel?.querySelectorAll('[data-unified-section]').forEach(section => { section.hidden = true; });
    state.panel?.querySelectorAll('#profile-card-dialog .profile-settings-section,#profile-design-dialog .profile-settings-section').forEach(section => { section.hidden = true; });
    const reset = $('#design-reset');
    if (reset) reset.hidden = true;
  }

  function showParent(name) {
    const section = state.panel?.querySelector(`[data-unified-section="${name}"]`);
    if (section) section.hidden = false;
  }

  function showNode(node) {
    if (node) node.hidden = false;
  }

  function revealStep(step) {
    hideAllSources();
    const card = cardSections();
    const design = designSections();

    if (step.key === 'basics') {
      showParent('card');
      showNode(card[0]);
    } else if (step.key === 'pictures') {
      showParent('card');
      showNode(card[1]);
    } else if (step.key === 'card-look') {
      showParent('card');
      showParent('page');
      showNode(card[2]);
      showNode(design[1]);
      showNode(design[2]);
    } else if (step.key === 'visibility') {
      showParent('card');
      showParent('page');
      showNode(card[3]);
      showNode(design[3]);
    } else if (step.key === 'card-tiles') {
      showParent('cardTiles');
    } else if (step.key === 'page-look') {
      showParent('page');
      showNode(design[0]);
      const reset = $('#design-reset');
      if (reset) reset.hidden = false;
    } else if (step.key === 'profile-tiles') {
      showParent('profileTiles');
    }
  }

  function updateNavigation() {
    const step = STEPS[state.current];
    state.nav?.querySelectorAll('[data-focus-step]').forEach((button, index) => {
      const active = index === state.current;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'step' : 'false');
    });
    const progress = state.panel?.querySelector('[data-focus-progress]');
    const title = state.panel?.querySelector('[data-focus-title]');
    const description = state.panel?.querySelector('[data-focus-description]');
    if (progress) progress.textContent = `Step ${state.current + 1} of ${STEPS.length}`;
    if (title) title.textContent = step.title;
    if (description) description.textContent = step.description;
    const previous = state.panel?.querySelector('[data-focus-previous]');
    const next = state.panel?.querySelector('[data-focus-next]');
    if (previous) previous.disabled = state.current === 0;
    if (next) {
      next.hidden = state.current === STEPS.length - 1;
      next.textContent = state.current < STEPS.length - 1 ? `Next: ${STEPS[state.current + 1].label}` : 'Next';
    }
  }

  function selectStep(value, options = {}) {
    const index = typeof value === 'number' ? value : STEPS.findIndex(step => step.key === value);
    if (index < 0 || index >= STEPS.length || !state.panel) return;
    state.current = index;
    const step = STEPS[index];
    ensureSources(step);
    requestAnimationFrame(() => {
      revealStep(step);
      updateNavigation();
      if (!options.keepScroll && state.body) state.body.scrollTop = 0;
      state.panel.dataset.focusStep = step.key;
    });
  }

  function buildNavigation() {
    const nav = document.createElement('nav');
    nav.className = 'profile-focus-nav';
    nav.setAttribute('aria-label', 'Profile editing steps');
    STEPS.forEach((step, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.focusStep = step.key;
      button.innerHTML = `<b>${index + 1}</b><span><strong></strong><small></small></span>`;
      button.querySelector('strong').textContent = step.label;
      button.querySelector('small').textContent = step.short;
      button.addEventListener('click', () => selectStep(index));
      nav.append(button);
    });
    return nav;
  }

  function buildCurrentHeading() {
    const heading = document.createElement('header');
    heading.className = 'profile-focus-current';
    heading.innerHTML = '<span data-focus-progress></span><h3 data-focus-title></h3><p data-focus-description></p>';
    state.body.prepend(heading);
  }

  function buildFooter() {
    const footer = state.panel.querySelector('.profile-unified-footer');
    const saveActions = footer?.querySelector('[data-unified-save-actions]');
    if (!footer || !saveActions || footer.querySelector('.profile-focus-footer-row')) return;
    const row = document.createElement('div');
    row.className = 'profile-focus-footer-row';
    const navigation = document.createElement('div');
    navigation.className = 'profile-focus-footer-navigation';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.dataset.focusPrevious = '';
    previous.textContent = 'Back';
    previous.addEventListener('click', () => selectStep(state.current - 1));
    const next = document.createElement('button');
    next.type = 'button';
    next.dataset.focusNext = '';
    next.textContent = 'Next';
    next.addEventListener('click', () => selectStep(state.current + 1));
    navigation.append(previous, next);
    row.append(navigation, saveActions);
    footer.append(row);
  }

  function simplifyFrame() {
    const headerTitle = state.panel.querySelector('[data-unified-title]');
    const headerDescription = state.panel.querySelector('[data-unified-description]');
    const close = state.panel.querySelector('[data-unified-close]');
    if (headerTitle) headerTitle.textContent = 'Edit profile';
    if (headerDescription) headerDescription.textContent = 'Work through one clear section at a time. Changes stay in preview until you save.';
    if (close) {
      close.textContent = '×';
      close.setAttribute('aria-label', 'Close profile editor');
      close.title = 'Close profile editor';
    }
    state.panel.querySelector('.profile-unified-tabs')?.setAttribute('hidden', '');
    state.panel.querySelectorAll('.profile-unified-section-intro,.guided-dialog-tabs,.profile-editor-inline-dialog > .profile-dialog-heading').forEach(node => node.setAttribute('hidden', ''));
  }

  function install() {
    const panel = $('#profile-unified-editor');
    const body = panel?.querySelector('.profile-unified-body');
    if (!panel || !body || panel.dataset.focusEditor === 'true' || !sourceReady()) return false;
    panel.dataset.focusEditor = 'true';
    state.panel = panel;
    state.body = body;
    simplifyFrame();

    const shell = document.createElement('div');
    shell.className = 'profile-focus-shell';
    const nav = buildNavigation();
    body.before(shell);
    shell.append(nav, body);
    state.shell = shell;
    state.nav = nav;
    buildCurrentHeading();
    buildFooter();

    state.observer = new MutationObserver(() => {
      if (panel.open) selectStep(state.current, { keepScroll: true });
    });
    state.observer.observe(panel, { attributes: true, attributeFilter: ['open'] });

    document.addEventListener('click', event => {
      if (state.applying) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target.closest('[data-quick-card-details],#profile-card-settings')) queueMicrotask(() => selectStep('basics'));
      if (target.closest('[data-quick-profile-design],#profile-design-settings')) queueMicrotask(() => selectStep('page-look'));
      if (target.closest('[data-add-card-tile],.profile-card-empty-slot,.profile-card-mini-settings')) queueMicrotask(() => selectStep('card-tiles'));
      if (target.closest('[data-add-profile-tile],.profile-tile-settings-button')) queueMicrotask(() => selectStep('profile-tiles'));
    }, true);

    selectStep('basics');
    return true;
  }

  function initialise() {
    let attempts = 0;
    const tryInstall = () => {
      if (install() || attempts >= 120) return;
      attempts += 1;
      requestAnimationFrame(tryInstall);
    };
    tryInstall();
  }

  window.GrevProfileFocusEditor = { version: 1, selectStep };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();