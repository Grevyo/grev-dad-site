(() => {
  if (window.GrevEditorGuidance?.version >= 1) return;

  const HIDDEN_CLASS = 'guided-editor-panel-hidden';
  const installedDialogs = new WeakSet();

  function button(label, description, onClick, extraClass = '') {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = `guided-task-button${extraClass ? ` ${extraClass}` : ''}`;
    const title = document.createElement('strong');
    title.textContent = label;
    const detail = document.createElement('span');
    detail.textContent = description;
    control.append(title, detail);
    control.addEventListener('click', onClick);
    return control;
  }

  function setActiveTask(nav, active) {
    nav.querySelectorAll('[data-guided-task]').forEach(control => {
      const selected = control.dataset.guidedTask === active;
      control.classList.toggle('active', selected);
      control.setAttribute('aria-pressed', String(selected));
    });
  }

  function installMoreActions(actions, keepIds, hiddenIds = []) {
    if (!actions || actions.querySelector('.guided-more-actions')) return;
    const movable = [...actions.children].filter(node => node instanceof HTMLButtonElement && !keepIds.includes(node.id) && !hiddenIds.includes(node.id));
    if (!movable.length) return;
    const details = document.createElement('details');
    details.className = 'guided-more-actions';
    const summary = document.createElement('summary');
    summary.textContent = 'More actions';
    const body = document.createElement('div');
    body.className = 'guided-more-actions-body';
    body.append(...movable);
    details.append(summary, body);
    const firstKeep = [...actions.children].find(node => node instanceof HTMLElement && keepIds.includes(node.id));
    actions.insertBefore(details, firstKeep || null);
  }

  function installDashboardTasks() {
    const toolbar = document.querySelector('#dashboard-editor-toolbar');
    if (!toolbar || toolbar.dataset.guidedEditor === 'true') return;
    toolbar.dataset.guidedEditor = 'true';
    const topline = toolbar.querySelector('.dashboard-editor-topline');
    const settings = toolbar.querySelector('.dashboard-editor-settings');
    const intro = topline?.querySelector(':scope > div > p:last-child');
    const heading = topline?.querySelector('h2');
    if (heading) heading.textContent = 'What do you want to change?';
    if (intro) intro.textContent = 'Choose one task. Your live dashboard stays visible underneath, and nothing is saved until you press Save dashboard.';

    const nav = document.createElement('nav');
    nav.className = 'guided-task-nav dashboard-guided-task-nav';
    nav.setAttribute('aria-label', 'Dashboard editing tasks');

    const activate = mode => {
      toolbar.dataset.guidedMode = mode;
      settings?.classList.toggle(HIDDEN_CLASS, mode !== 'spacing');
      setActiveTask(nav, mode);
      if (mode === 'spacing') settings?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const arrange = button('Arrange tiles', 'Move, resize or open one tile’s settings.', () => activate('arrange'));
    arrange.dataset.guidedTask = 'arrange';
    const add = button('Add a tile', 'Browse the tile catalogue in a focused window.', () => {
      activate('arrange');
      document.querySelector('#dashboard-open-tile-picker')?.click();
    });
    add.dataset.guidedTask = 'add';
    const spacing = button('Dashboard spacing', 'Change density, gaps, margins and descriptions.', () => activate('spacing'));
    spacing.dataset.guidedTask = 'spacing';
    nav.append(arrange, add, spacing);
    topline?.insertAdjacentElement('afterend', nav);

    const actions = toolbar.querySelector('.dashboard-editor-actions');
    installMoreActions(actions, ['dashboard-cancel-layout', 'dashboard-save-layout'], ['dashboard-open-tile-picker']);
    document.querySelector('#dashboard-open-tile-picker')?.classList.add('guided-native-action-hidden');

    const reset = () => {
      if (!toolbar.hidden) activate('arrange');
    };
    new MutationObserver(reset).observe(toolbar, { attributes: true, attributeFilter: ['hidden'] });
    reset();
  }

  function installProfileTasks() {
    const toolbar = document.querySelector('#profile-editor-toolbar');
    if (!toolbar || toolbar.dataset.guidedEditor === 'true') return;
    toolbar.dataset.guidedEditor = 'true';
    const topline = toolbar.querySelector('.profile-editor-topline');
    const preferences = toolbar.querySelector('.profile-editor-preferences');
    const workspace = document.querySelector('#profile-workspace');
    const catalogue = document.querySelector('#profile-catalogue');
    const heading = topline?.querySelector('h2');
    const intro = topline?.querySelector(':scope > div > p:last-child');
    if (heading) heading.textContent = 'What do you want to edit?';
    if (intro) intro.textContent = 'Choose one part of the profile. The live card and profile space remain visible while you work.';

    const nav = document.createElement('nav');
    nav.className = 'guided-task-nav profile-guided-task-nav';
    nav.setAttribute('aria-label', 'Profile editing tasks');

    const cardTileEditor = () => document.querySelector('#profile-card-tile-editor');
    const activate = mode => {
      toolbar.dataset.guidedMode = mode;
      preferences?.classList.toggle(HIDDEN_CLASS, mode !== 'spacing');
      cardTileEditor()?.classList.toggle(HIDDEN_CLASS, mode !== 'card-buttons');
      catalogue?.classList.toggle(HIDDEN_CLASS, mode !== 'profile-space');
      workspace?.classList.toggle('guided-profile-space-active', mode === 'profile-space');
      setActiveTask(nav, mode);
      if (mode === 'card-buttons') cardTileEditor()?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (mode === 'spacing') preferences?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const card = button('Profile card', 'Edit your name, pictures, colours and visible details.', () => document.querySelector('#profile-card-settings')?.click());
    card.dataset.guidedTask = 'card';
    const cardButtons = button('Card buttons', 'Add or arrange the small buttons inside your card.', () => activate('card-buttons'));
    cardButtons.dataset.guidedTask = 'card-buttons';
    const profileSpace = button('Profile space', 'Add, move and resize the larger tiles below your card.', () => activate('profile-space'));
    profileSpace.dataset.guidedTask = 'profile-space';
    const spacing = button('Page spacing', 'Change tile density, gaps and outer margins.', () => activate('spacing'));
    spacing.dataset.guidedTask = 'spacing';
    nav.append(card, cardButtons, profileSpace, spacing);
    topline?.insertAdjacentElement('afterend', nav);

    document.querySelector('#profile-card-settings')?.classList.add('guided-native-action-hidden');
    const actions = toolbar.querySelector('.profile-editor-actions');
    installMoreActions(actions, ['profile-cancel', 'profile-save'], ['profile-card-settings']);

    const reset = () => {
      if (!toolbar.hidden) requestAnimationFrame(() => activate('profile-space'));
    };
    new MutationObserver(reset).observe(toolbar, { attributes: true, attributeFilter: ['hidden'] });
    reset();
  }

  function makeDangerPanel(control, className) {
    if (!control || control.closest(`.${className}`)) return control?.closest(`.${className}`) || null;
    const panel = document.createElement('section');
    panel.className = className;
    const heading = document.createElement('h3');
    heading.textContent = 'Remove';
    const explanation = document.createElement('p');
    explanation.textContent = 'This removes the selected item from the current layout. The change is not permanent until you save.';
    control.before(panel);
    panel.append(heading, explanation, control);
    return panel;
  }

  function installTabbedDialog(dialog, definitions) {
    if (!dialog || installedDialogs.has(dialog)) return;
    const groups = definitions.map(definition => ({ ...definition, nodes: definition.nodes().filter(Boolean) })).filter(group => group.nodes.length);
    if (groups.length < 2) return;
    installedDialogs.add(dialog);
    dialog.dataset.guidedDialog = 'true';
    const heading = dialog.querySelector(':scope > .profile-dialog-heading,:scope > .dashboard-tile-settings-heading');
    const nav = document.createElement('nav');
    nav.className = 'guided-dialog-tabs';
    nav.setAttribute('aria-label', 'Settings sections');

    const allNodes = [...new Set(groups.flatMap(group => group.nodes))];
    const activate = index => {
      const activeIndex = Math.max(0, Math.min(groups.length - 1, index));
      groups.forEach((group, groupIndex) => {
        group.nodes.forEach(node => node.classList.toggle(HIDDEN_CLASS, groupIndex !== activeIndex));
      });
      nav.querySelectorAll('button').forEach((control, buttonIndex) => {
        const selected = buttonIndex === activeIndex;
        control.classList.toggle('active', selected);
        control.setAttribute('aria-selected', String(selected));
        control.tabIndex = selected ? 0 : -1;
      });
      dialog.dataset.guidedTab = groups[activeIndex].key;
      allNodes.find(node => !node.classList.contains(HIDDEN_CLASS))?.scrollIntoView({ block: 'nearest' });
    };

    groups.forEach((group, index) => {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = group.label;
      control.setAttribute('role', 'tab');
      control.addEventListener('click', () => activate(index));
      control.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? groups.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + groups.length) % groups.length;
        activate(next);
        nav.querySelectorAll('button')[next]?.focus();
      });
      nav.append(control);
    });
    heading?.insertAdjacentElement('afterend', nav);
    activate(0);
    new MutationObserver(() => { if (dialog.open) activate(0); }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  }

  function installDashboardDialog() {
    const dialog = document.querySelector('#dashboard-tile-settings-dialog');
    if (!dialog) return;
    const sections = [...dialog.querySelectorAll('#dashboard-selected-controls > .dashboard-tile-settings-section')];
    const danger = makeDangerPanel(dialog.querySelector('#dashboard-remove-selected'), 'guided-danger-panel');
    installTabbedDialog(dialog, [
      { key: 'layout', label: 'Size & position', nodes: () => [sections[0]] },
      { key: 'content', label: 'Content & icon', nodes: () => [sections[1]] },
      { key: 'appearance', label: 'Appearance', nodes: () => [sections[2]] },
      { key: 'remove', label: 'Remove', nodes: () => [danger] }
    ]);
  }

  function installProfileDialogs() {
    const cardDialog = document.querySelector('#profile-card-dialog');
    if (cardDialog) {
      const sections = [...cardDialog.querySelectorAll('.profile-dialog-body > .profile-settings-section')];
      installTabbedDialog(cardDialog, [
        { key: 'identity', label: 'Identity', nodes: () => [sections[0]] },
        { key: 'pictures', label: 'Pictures', nodes: () => [sections[1]] },
        { key: 'appearance', label: 'Appearance', nodes: () => [sections[2]] },
        { key: 'visibility', label: 'Visibility', nodes: () => [sections[3]] }
      ]);
    }

    const tileDialog = document.querySelector('#profile-tile-dialog');
    if (tileDialog) {
      const sections = [...tileDialog.querySelectorAll('.profile-dialog-body > .profile-settings-section')];
      const danger = makeDangerPanel(tileDialog.querySelector('#profile-remove-tile'), 'guided-danger-panel');
      installTabbedDialog(tileDialog, [
        { key: 'layout', label: 'Size & position', nodes: () => [sections[0]] },
        { key: 'content', label: 'Content', nodes: () => [sections[1]] },
        { key: 'appearance', label: 'Appearance', nodes: () => [sections[2]] },
        { key: 'remove', label: 'Remove', nodes: () => [danger] }
      ]);
    }

    const cardTileDialog = document.querySelector('#profile-card-tile-dialog');
    if (cardTileDialog) {
      const sections = [...cardTileDialog.querySelectorAll('.profile-dialog-body > .card-tile-dialog-section')];
      const danger = makeDangerPanel(cardTileDialog.querySelector('#card-tile-remove'), 'guided-danger-panel');
      installTabbedDialog(cardTileDialog, [
        { key: 'layout', label: 'Size & position', nodes: () => [sections[0]] },
        { key: 'content', label: 'Content & icon', nodes: () => [sections[1], sections[2]] },
        { key: 'appearance', label: 'Appearance', nodes: () => [sections[3]] },
        { key: 'remove', label: 'Remove', nodes: () => [danger] }
      ]);
    }
  }

  function initialize() {
    installDashboardTasks();
    installProfileTasks();
    installDashboardDialog();
    installProfileDialogs();

    if (!document.querySelector('#profile-card-tile-dialog') && document.querySelector('#profile-editor-toolbar')) {
      const observer = new MutationObserver(() => {
        if (!document.querySelector('#profile-card-tile-dialog')) return;
        installProfileTasks();
        installProfileDialogs();
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.GrevEditorGuidance = { version: 1, initialize };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();