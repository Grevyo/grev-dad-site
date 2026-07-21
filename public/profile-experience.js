(() => {
  if (typeof profileState === 'undefined' || typeof profile$ !== 'function') return;

  const experience = {
    initialized: false,
    privacy: null,
    interactions: null,
    profileId: null
  };

  const FIELD_LABELS = {
    headline: 'Headline', bio: 'Biography', location: 'Location', website: 'Website', avatar: 'Profile picture',
    cover: 'Cover picture', username: 'Username', status: 'Account status', memberSince: 'Member-since date'
  };

  const VISIBILITY_OPTIONS = [
    ['all', 'Everyone with an account'],
    ['verified', 'Verified accounts only'],
    ['groups', 'Members of a selected group'],
    ['private', 'Only me']
  ];

  const THEMES = [
    {
      id: 'minimal', name: 'Minimal', description: 'Quiet canvas, compact card and generous breathing room.',
      values: { 'design-page-background-type': 'solid', 'design-page-primary': '#f2f3f5', 'design-page-text': '#17191d', 'design-page-font': 'system', 'design-content-width': 'standard', 'design-section-gap': '40', 'design-card-width': 'wide', 'design-card-alignment': 'centre', 'design-card-surface': 'solid', 'design-cover-height': '120', 'design-avatar-size': '96', 'design-card-padding': '32', 'design-card-shadow': 'small', 'design-card-border': '1', 'design-grid-surface': 'transparent' }
    },
    {
      id: 'homepage', name: 'Personal homepage', description: 'A broad profile card and spacious lower content area.',
      values: { 'design-page-background-type': 'gradient', 'design-page-primary': '#090c11', 'design-page-secondary': '#182131', 'design-page-text': '#f4f7fb', 'design-page-font': 'system', 'design-content-width': 'wide', 'design-section-gap': '32', 'design-card-width': 'full', 'design-card-alignment': 'centre', 'design-card-surface': 'gradient', 'design-cover-height': '180', 'design-avatar-size': '132', 'design-card-padding': '28', 'design-card-shadow': 'large', 'design-card-border': '1', 'design-grid-surface': 'panel' }
    },
    {
      id: 'gaming', name: 'Gaming', description: 'Bold display type, stronger colour and a large identity card.',
      values: { 'design-page-background-type': 'gradient', 'design-page-primary': '#05070b', 'design-page-secondary': '#25104a', 'design-page-text': '#f8f5ff', 'design-page-font': 'display', 'design-content-width': 'full', 'design-section-gap': '24', 'design-card-width': 'full', 'design-card-alignment': 'left', 'design-card-surface': 'cover', 'design-cover-height': '240', 'design-avatar-size': '144', 'design-card-padding': '32', 'design-card-shadow': 'large', 'design-card-border': '2', 'design-grid-surface': 'outlined' }
    },
    {
      id: 'retro', name: 'Retro web', description: 'Compact layout, serif type and a classic blue page.',
      values: { 'design-page-background-type': 'solid', 'design-page-primary': '#101a39', 'design-page-text': '#f7e9a7', 'design-page-font': 'serif', 'design-content-width': 'standard', 'design-section-gap': '16', 'design-card-width': 'compact', 'design-card-alignment': 'left', 'design-card-surface': 'solid', 'design-cover-height': '120', 'design-avatar-size': '96', 'design-card-padding': '16', 'design-card-shadow': 'none', 'design-card-border': '4', 'design-grid-surface': 'outlined' }
    },
    {
      id: 'photo', name: 'Photo focus', description: 'Large cover treatment and clean supporting content.',
      values: { 'design-page-background-type': 'solid', 'design-page-primary': '#080a0d', 'design-page-text': '#ffffff', 'design-page-font': 'system', 'design-content-width': 'wide', 'design-section-gap': '40', 'design-card-width': 'full', 'design-card-alignment': 'centre', 'design-card-surface': 'cover', 'design-cover-height': '320', 'design-avatar-size': '120', 'design-card-padding': '32', 'design-card-shadow': 'large', 'design-card-border': '0', 'design-grid-surface': 'transparent' }
    },
    {
      id: 'terminal', name: 'Dark terminal', description: 'Monospace type with deep black and green highlights.',
      values: { 'design-page-background-type': 'solid', 'design-page-primary': '#020604', 'design-page-text': '#8dffb1', 'design-page-font': 'mono', 'design-content-width': 'wide', 'design-section-gap': '24', 'design-card-width': 'wide', 'design-card-alignment': 'left', 'design-card-surface': 'solid', 'design-cover-height': '0', 'design-avatar-size': '96', 'design-card-padding': '24', 'design-card-shadow': 'small', 'design-card-border': '1', 'design-grid-surface': 'outlined' }
    }
  ];

  async function experienceFetch(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? 'Profile experience request failed.');
    return payload;
  }

  function setControlValue(id, value) {
    const control = document.getElementById(id);
    if (!control) return;
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = String(value);
    control.dispatchEvent(new Event(control.type === 'range' ? 'input' : 'change', { bubbles: true }));
    if (control.type !== 'range') control.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function applyTheme(theme) {
    if (!profileState.editing) return;
    Object.entries(theme.values).forEach(([id, value]) => setControlValue(id, value));
    profileEditorMessage(`${theme.name} theme applied to the live preview. Save profile to keep it.`, 'success');
    document.querySelectorAll('.profile-theme-card').forEach(card => card.classList.toggle('active', card.dataset.themeId === theme.id));
  }

  function ensureThemeStarters() {
    const pageSection = document.querySelector('[data-unified-section="page"]');
    if (!pageSection || document.querySelector('#profile-theme-starters')) return;
    const section = document.createElement('section');
    section.id = 'profile-theme-starters';
    section.className = 'profile-experience-panel profile-theme-starters';
    section.innerHTML = `<div class="profile-experience-heading"><div><strong>Theme starters</strong><span>Choose a starting point, then adjust every setting underneath.</span></div><b>6 presets</b></div><div class="profile-theme-grid"></div>`;
    const grid = section.querySelector('.profile-theme-grid');
    THEMES.forEach(theme => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'profile-theme-card';
      button.dataset.themeId = theme.id;
      button.innerHTML = `<span class="profile-theme-preview" data-theme-preview="${theme.id}"></span><strong></strong><small></small>`;
      button.querySelector('strong').textContent = theme.name;
      button.querySelector('small').textContent = theme.description;
      button.addEventListener('click', () => applyTheme(theme));
      grid.append(button);
    });
    pageSection.insertBefore(section, pageSection.querySelector('[data-unified-slot="page"]'));
  }

  function starterTile(type, overrides = {}) {
    const tile = profileTileDefaults(type);
    Object.assign(tile, overrides);
    return tile;
  }

  function addStarter(starter) {
    if (!profileState.editing || !profileState.working) return;
    const created = [];
    if (starter === 'about') {
      created.push(starterTile('text', { title: 'About me', body: 'Introduce yourself, what you enjoy and what people can find on your Grev.dad profile.', width: 4, height: 2 }));
    } else if (starter === 'projects') {
      created.push(starterTile('text', { title: 'Current projects', body: 'Share what you are building, learning or working towards right now.', width: 4, height: 2, backgroundType: 'gradient' }));
    } else if (starter === 'favourites') {
      created.push(starterTile('text', { title: 'My favourites', body: 'Games, films, music, food, places or anything else you want people to know.', width: 3, height: 2 }));
    } else if (starter === 'gallery') {
      created.push(starterTile('text', { title: 'Gallery', body: 'Add picture tiles beside this introduction to build a personal gallery.', width: 3, height: 2, backgroundType: 'gradient', backgroundSecondary: '#7b3fa1' }));
    } else if (starter === 'homepage') {
      created.push(
        starterTile('text', { title: 'Welcome', body: 'This is my personal corner of Grev.dad.', width: 4, height: 2, backgroundType: 'gradient' }),
        starterTile('text', { title: 'About me', body: 'Introduce yourself here.', width: 3, height: 2 }),
        starterTile('text', { title: 'Current projects', body: 'Share what you are working on.', width: 3, height: 2, backgroundType: 'gradient', backgroundSecondary: '#3157c9' }),
        starterTile('stat', { title: 'Current focus', statValue: 'In progress', width: 2, height: 1 })
      );
    }
    for (const tile of created) {
      const placement = firstFreeProfilePlacement(tile.width, tile.height);
      Object.assign(tile, placement);
      profileState.working.tiles.push(tile);
    }
    profileState.selectedId = created[0]?.tileId ?? null;
    renderProfileGrid();
    profileEditorMessage(`${created.length} homepage section${created.length === 1 ? '' : 's'} added. Save profile to keep them.`, 'success');
  }

  function ensureHomepageStarters() {
    const tileSection = document.querySelector('[data-unified-section="profileTiles"]');
    if (!tileSection || document.querySelector('#profile-homepage-starters')) return;
    const section = document.createElement('section');
    section.id = 'profile-homepage-starters';
    section.className = 'profile-experience-panel profile-homepage-starters';
    section.innerHTML = `
      <div class="profile-experience-heading"><div><strong>Homepage sections</strong><span>Add ready-made sections using the existing profile tile builder.</span></div><b>Starter content</b></div>
      <div class="profile-homepage-starter-grid">
        <button type="button" data-profile-starter="about"><strong>About me</strong><span>Personal introduction</span></button>
        <button type="button" data-profile-starter="projects"><strong>Projects</strong><span>What you are building</span></button>
        <button type="button" data-profile-starter="favourites"><strong>Favourites</strong><span>Games, media and interests</span></button>
        <button type="button" data-profile-starter="gallery"><strong>Gallery intro</strong><span>Start a media section</span></button>
        <button type="button" data-profile-starter="homepage"><strong>Full homepage</strong><span>Four useful starter sections</span></button>
      </div>`;
    section.querySelectorAll('[data-profile-starter]').forEach(button => button.addEventListener('click', () => addStarter(button.dataset.profileStarter)));
    tileSection.insertBefore(section, tileSection.querySelector('[data-unified-existing="profileTiles"]'));
  }

  function visibilitySelect(value = 'all') {
    const select = document.createElement('select');
    VISIBILITY_OPTIONS.forEach(([optionValue, label]) => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = label;
      option.selected = optionValue === value;
      select.append(option);
    });
    return select;
  }

  function groupSelect(groupId = null) {
    const select = document.createElement('select');
    select.className = 'profile-privacy-group';
    (experience.privacy?.groups ?? []).forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.name;
      option.selected = group.id === groupId;
      select.append(option);
    });
    return select;
  }

  function privacyRow(label, key, record, type) {
    const row = document.createElement('div');
    row.className = 'profile-privacy-row';
    row.dataset.privacyKey = key;
    row.dataset.privacyType = type;
    const identity = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = label;
    const detail = document.createElement('span');
    detail.textContent = type === 'field' ? 'Profile detail' : 'Profile tile';
    identity.append(title, detail);
    const controls = document.createElement('div');
    const visibility = visibilitySelect(record?.visibility ?? 'all');
    visibility.className = 'profile-privacy-visibility';
    const groups = groupSelect(record?.groupId ?? null);
    groups.hidden = visibility.value !== 'groups';
    visibility.addEventListener('change', () => { groups.hidden = visibility.value !== 'groups'; });
    controls.append(visibility, groups);
    row.append(identity, controls);
    return row;
  }

  function renderPrivacyPanel() {
    const panel = document.querySelector('#profile-privacy-panel');
    if (!panel || !experience.privacy) return;
    const fields = panel.querySelector('[data-privacy-fields]');
    fields.replaceChildren(...Object.entries(FIELD_LABELS).map(([key, label]) => privacyRow(label, key, experience.privacy.fields?.[key], 'field')));
    const tiles = panel.querySelector('[data-privacy-tiles]');
    const workingTiles = profileState.working?.tiles ?? profileState.profile?.tiles ?? [];
    if (workingTiles.length) {
      tiles.replaceChildren(...workingTiles.map(tile => privacyRow(tile.title || `${tile.tileType} tile`, tile.tileId, experience.privacy.tiles?.[tile.tileId], 'tile')));
    } else {
      const empty = document.createElement('p');
      empty.className = 'profile-privacy-empty';
      empty.textContent = 'Add profile tiles first, then choose who may see each one.';
      tiles.replaceChildren(empty);
    }
    panel.querySelector('#profile-guestbook-enabled').checked = experience.privacy.interactions?.guestbookEnabled !== false;
    panel.querySelector('#profile-reactions-enabled').checked = experience.privacy.interactions?.reactionsEnabled !== false;
  }

  async function loadPrivacy() {
    try {
      experience.privacy = await experienceFetch('/api/profile/privacy');
      renderPrivacyPanel();
    } catch (error) {
      const status = document.querySelector('#profile-privacy-message');
      if (status) { status.textContent = error.message; status.className = 'error'; }
    }
  }

  function collectPrivacyRows(type) {
    const result = {};
    document.querySelectorAll(`.profile-privacy-row[data-privacy-type="${type}"]`).forEach(row => {
      const visibility = row.querySelector('.profile-privacy-visibility')?.value ?? 'all';
      const groupId = visibility === 'groups' ? row.querySelector('.profile-privacy-group')?.value ?? null : null;
      result[row.dataset.privacyKey] = { visibility, groupId };
    });
    return result;
  }

  async function savePrivacy() {
    const message = document.querySelector('#profile-privacy-message');
    if (message) { message.textContent = 'Saving privacy…'; message.className = ''; }
    try {
      experience.privacy = await experienceFetch('/api/profile/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: collectPrivacyRows('field'),
          tiles: collectPrivacyRows('tile'),
          interactions: {
            guestbookEnabled: document.querySelector('#profile-guestbook-enabled')?.checked !== false,
            reactionsEnabled: document.querySelector('#profile-reactions-enabled')?.checked !== false
          }
        })
      });
      renderPrivacyPanel();
      if (message) { message.textContent = 'Privacy and interaction settings saved.'; message.className = 'success'; }
      await loadInteractions();
    } catch (error) {
      if (message) { message.textContent = error.message; message.className = 'error'; }
    }
  }

  function showPrivacyTab() {
    const editor = document.querySelector('#profile-unified-editor');
    if (!editor) return;
    editor.querySelectorAll('.profile-unified-tabs [data-unified-tab]').forEach(button => {
      const active = button.dataset.unifiedTab === 'privacy';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    editor.querySelectorAll('[data-unified-section]').forEach(section => { section.hidden = section.dataset.unifiedSection !== 'privacy'; });
    editor.querySelector('[data-unified-title]').textContent = 'Privacy & interaction';
    editor.querySelector('[data-unified-description]').textContent = 'Control individual details, tiles, guestbook messages and reactions.';
    editor.querySelector('.profile-unified-body').scrollTop = 0;
    renderPrivacyPanel();
  }

  function ensurePrivacyTab() {
    const editor = document.querySelector('#profile-unified-editor');
    const nav = editor?.querySelector('.profile-unified-tabs');
    if (!editor || !nav || editor.querySelector('[data-unified-tab="privacy"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.unifiedTab = 'privacy';
    button.id = 'profile-unified-tab-privacy';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'profile-unified-panel-privacy');
    button.setAttribute('aria-selected', 'false');
    button.tabIndex = -1;
    button.innerHTML = '<strong>Privacy</strong><span>Fields & interaction</span>';
    button.addEventListener('click', showPrivacyTab);
    nav.append(button);
    if (nav.dataset.experienceKeyboardReady !== 'true') {
      nav.dataset.experienceKeyboardReady = 'true';
      nav.addEventListener('keydown', event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        const buttons = [...nav.querySelectorAll('[data-unified-tab]')];
        const current = buttons.indexOf(document.activeElement);
        if (current < 0) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        let next = current;
        if (event.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
        if (event.key === 'ArrowRight') next = (current + 1) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        buttons[next].click();
        buttons[next].focus();
      }, true);
    }

    const section = document.createElement('section');
    section.id = 'profile-unified-panel-privacy';
    section.className = 'profile-unified-section';
    section.dataset.unifiedSection = 'privacy';
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-labelledby', button.id);
    section.hidden = true;
    section.innerHTML = `
      <div class="profile-unified-section-intro"><strong>Field-level privacy</strong><span>These settings save separately from the visual profile editor.</span></div>
      <div id="profile-privacy-panel" class="profile-privacy-panel">
        <section><h3>Profile details</h3><div data-privacy-fields class="profile-privacy-list"></div></section>
        <section><h3>Profile tiles</h3><div data-privacy-tiles class="profile-privacy-list"></div></section>
        <section><h3>Profile interaction</h3><label class="profile-privacy-toggle"><input id="profile-guestbook-enabled" type="checkbox"> Allow guestbook messages</label><label class="profile-privacy-toggle"><input id="profile-reactions-enabled" type="checkbox"> Allow profile reactions</label></section>
        <button id="profile-save-privacy" class="primary" type="button">Save privacy settings</button>
        <p id="profile-privacy-message" role="status"></p>
      </div>`;
    editor.querySelector('.profile-unified-body').append(section);
    section.querySelector('#profile-save-privacy').addEventListener('click', savePrivacy);
    loadPrivacy();
  }

  function reactionButton(reaction, icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.profileReaction = reaction;
    button.className = experience.interactions?.ownReaction === reaction ? 'active' : '';
    button.innerHTML = `<span>${icon}</span><strong>${label}</strong><b>${experience.interactions?.reactions?.[reaction] ?? 0}</b>`;
    button.addEventListener('click', () => setReaction(experience.interactions?.ownReaction === reaction ? null : reaction));
    return button;
  }

  function guestbookEntry(entry) {
    const article = document.createElement('article');
    article.className = 'profile-guestbook-entry';
    const heading = document.createElement('div');
    const author = document.createElement('button');
    author.type = 'button';
    author.className = 'profile-guestbook-author';
    author.dataset.profileUserId = entry.author.id;
    author.innerHTML = '<strong></strong><span></span>';
    author.querySelector('strong').textContent = entry.author.displayName;
    author.querySelector('span').textContent = `@${entry.author.username}`;
    const date = document.createElement('time');
    date.dateTime = new Date(entry.createdAt * 1000).toISOString();
    date.textContent = new Date(entry.createdAt * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    heading.append(author, date);
    const message = document.createElement('p');
    message.textContent = entry.message;
    article.append(heading, message);
    if (entry.canDelete) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'profile-guestbook-remove';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => deleteGuestbookEntry(entry.id));
      article.append(remove);
    }
    return article;
  }

  function renderInteractions() {
    const section = document.querySelector('#profile-interactions');
    if (!section || !experience.interactions) return;
    const reactions = section.querySelector('[data-profile-reactions]');
    reactions.hidden = !experience.interactions.reactionsEnabled;
    reactions.replaceChildren(
      reactionButton('wave', '👋', 'Wave'),
      reactionButton('heart', '♥', 'Heart'),
      reactionButton('fire', '🔥', 'Fire'),
      reactionButton('clap', '👏', 'Clap')
    );
    const guestbook = section.querySelector('[data-profile-guestbook]');
    guestbook.hidden = !experience.interactions.guestbookEnabled && !experience.interactions.canModerate;
    const form = section.querySelector('#profile-guestbook-form');
    form.hidden = !experience.interactions.guestbookEnabled;
    const list = section.querySelector('#profile-guestbook-list');
    const entries = experience.interactions.entries ?? [];
    if (entries.length) list.replaceChildren(...entries.map(guestbookEntry));
    else {
      const empty = document.createElement('p');
      empty.className = 'profile-guestbook-empty';
      empty.textContent = experience.interactions.guestbookEnabled ? 'No guestbook messages yet.' : 'This guestbook is closed.';
      list.replaceChildren(empty);
    }
  }

  async function loadInteractions() {
    if (!experience.profileId) return;
    try {
      experience.interactions = await experienceFetch(`/api/profiles/${encodeURIComponent(experience.profileId)}/interactions`);
      renderInteractions();
    } catch (error) {
      const message = document.querySelector('#profile-interaction-message');
      if (message) message.textContent = error.message;
    }
  }

  async function setReaction(reaction) {
    try {
      experience.interactions = await experienceFetch(`/api/profiles/${encodeURIComponent(experience.profileId)}/reaction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reaction })
      });
      renderInteractions();
    } catch (error) {
      document.querySelector('#profile-interaction-message').textContent = error.message;
    }
  }

  async function postGuestbook(event) {
    event.preventDefault();
    const input = document.querySelector('#profile-guestbook-message');
    const message = input?.value.trim();
    if (!message) return;
    const status = document.querySelector('#profile-interaction-message');
    status.textContent = 'Posting message…';
    try {
      experience.interactions = await experienceFetch(`/api/profiles/${encodeURIComponent(experience.profileId)}/guestbook`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message })
      });
      input.value = '';
      status.textContent = 'Guestbook message posted.';
      renderInteractions();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function deleteGuestbookEntry(entryId) {
    try {
      experience.interactions = await experienceFetch(`/api/profile/guestbook/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
      renderInteractions();
    } catch (error) {
      document.querySelector('#profile-interaction-message').textContent = error.message;
    }
  }

  function ensureInteractions() {
    if (document.querySelector('#profile-interactions')) return;
    const workspace = document.querySelector('#profile-workspace');
    if (!workspace) return;
    const section = document.createElement('section');
    section.id = 'profile-interactions';
    section.className = 'profile-interactions';
    section.innerHTML = `
      <div class="profile-interaction-heading"><div><p class="eyebrow">Profile interaction</p><h2>Reactions and guestbook</h2><p>A small private-community layer for people who can access this profile.</p></div></div>
      <div data-profile-reactions class="profile-reactions" aria-label="Profile reactions"></div>
      <section data-profile-guestbook class="profile-guestbook">
        <div class="profile-guestbook-heading"><h3>Guestbook</h3><span>Leave a message on this profile.</span></div>
        <form id="profile-guestbook-form"><textarea id="profile-guestbook-message" maxlength="500" rows="3" placeholder="Write a guestbook message…"></textarea><button class="primary" type="submit">Post message</button></form>
        <p id="profile-interaction-message" role="status"></p>
        <div id="profile-guestbook-list" class="profile-guestbook-list"></div>
      </section>`;
    workspace.insertAdjacentElement('afterend', section);
    section.querySelector('#profile-guestbook-form').addEventListener('submit', postGuestbook);
  }

  function routeHash() {
    if (location.hash === '#guestbook') document.querySelector('#profile-interactions')?.scrollIntoView({ block: 'start' });
    if (location.hash === '#themes' && profileState.profile?.isSelf) {
      document.querySelector('#profile-edit')?.click();
      setTimeout(() => {
        document.querySelector('.profile-unified-tabs [data-unified-tab="page"]')?.click();
        document.querySelector('#profile-theme-starters')?.scrollIntoView({ block: 'start' });
      }, 80);
    }
  }

  async function initializeExperience() {
    if (experience.initialized || !document.querySelector('#profile-card')) return;
    experience.initialized = true;
    ensureInteractions();
    ensureThemeStarters();
    ensureHomepageStarters();
    ensurePrivacyTab();

    for (let attempt = 0; attempt < 80 && !profileState.profile; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!profileState.profile) return;
    experience.profileId = profileState.profile.id;
    const card = document.querySelector('#profile-card');
    if (card) card.dataset.profileUserId = experience.profileId;
    await loadInteractions();
    if (profileState.profile.isSelf) await loadPrivacy();
    routeHash();
    window.addEventListener('hashchange', routeHash);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeExperience, { once: true });
  else initializeExperience();
})();
