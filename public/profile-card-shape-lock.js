(() => {
  const LOCKED_GEOMETRY = Object.freeze({
    cardWidth: 'locked',
    cardAlignment: 'centre',
    coverHeight: 180,
    avatarSize: 132,
    cardPadding: 28,
    cardBorderWidth: 1,
    cardTileGap: 10,
    cardTileRowHeight: 92
  });
  const LOCKED_CONTROL_VALUES = Object.freeze({
    'design-card-width': 'locked',
    'design-card-alignment': 'centre',
    'design-cover-height': '180',
    'design-avatar-size': '132',
    'design-card-padding': '28',
    'design-card-border': '1',
    'design-card-tile-gap': '10',
    'design-card-tile-row': '92'
  });
  const REMOVED_CONTROL_IDS = Object.keys(LOCKED_CONTROL_VALUES);
  const nativeFetch = window.fetch.bind(window);

  function lockDesign(value) {
    const design = value && typeof value === 'object' ? { ...value } : {};
    return { ...design, ...LOCKED_GEOMETRY };
  }

  function enforceHiddenControlValues(dialog) {
    REMOVED_CONTROL_IDS.forEach(id => {
      const control = dialog.querySelector(`#${CSS.escape(id)}`);
      if (!control) return;
      const value = LOCKED_CONTROL_VALUES[id];
      if (control instanceof HTMLSelectElement && ![...control.options].some(option => option.value === value)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = 'Locked';
        control.append(option);
      }
      control.value = value;
      const label = control.closest('label');
      if (label) label.dataset.cardShapeControlHidden = '';
    });
  }

  function stripGeometryControls() {
    const dialog = document.querySelector('#profile-design-dialog');
    if (!dialog) return;

    if (!document.querySelector('#profile-card-shape-lock-style')) {
      const style = document.createElement('style');
      style.id = 'profile-card-shape-lock-style';
      style.textContent = '[data-card-shape-control-hidden]{display:none!important}';
      document.head.append(style);
    }

    enforceHiddenControlValues(dialog);
    if (dialog.dataset.cardShapeLockBound !== 'true') {
      dialog.dataset.cardShapeLockBound = 'true';
      dialog.addEventListener('input', () => enforceHiddenControlValues(dialog), true);
      dialog.addEventListener('change', () => enforceHiddenControlValues(dialog), true);
    }

    dialog.querySelectorAll('.profile-settings-section').forEach(section => {
      const heading = section.querySelector('h3');
      if (!heading) return;
      const title = heading.textContent?.trim();
      if (title === 'Card tile layout') {
        section.dataset.cardShapeControlHidden = '';
        return;
      }
      section.querySelectorAll('.profile-two-column,.profile-three-column,.profile-four-column').forEach(group => {
        if ([...group.children].length && [...group.children].every(child => child.hasAttribute('data-card-shape-control-hidden'))) {
          group.dataset.cardShapeControlHidden = '';
        }
      });
      if (title === 'Profile card layout') {
        heading.textContent = 'Profile card style';
        if (!section.querySelector('[data-card-shape-lock-note]')) {
          const note = document.createElement('p');
          note.dataset.cardShapeLockNote = '';
          note.className = 'profile-card-shape-lock-note';
          note.textContent = 'Profile-card size and proportions are fixed so the same card is shown everywhere.';
          heading.after(note);
        }
      }
    });
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET')).toUpperCase();
    if (method !== 'PUT' || new URL(url, location.origin).pathname !== '/api/profile') {
      return nativeFetch(input, init);
    }

    let body;
    try {
      body = JSON.parse(String(init.body || '{}'));
    } catch {
      return nativeFetch(input, init);
    }
    body.design = lockDesign(body.design);
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    headers.set('Content-Type', 'application/json');
    return nativeFetch(input, { ...init, headers, body: JSON.stringify(body) });
  };

  function initialise() {
    stripGeometryControls();
    const observer = new MutationObserver(stripGeometryControls);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  window.GrevProfileCardShapeLock = {
    geometry: LOCKED_GEOMETRY,
    lockDesign,
    stripGeometryControls
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();