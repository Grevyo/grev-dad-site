const profile$ = selector => document.querySelector(selector);
const PROFILE_COLUMNS = 8;
const PROFILE_MAX_WIDTH = 6;
const PROFILE_MAX_HEIGHT = 4;
const PROFILE_MAX_MEDIA_BYTES = 1_400_000;
const PROFILE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const PROFILE_FONT_STACKS = {
  system: 'Inter,Segoe UI,Arial,sans-serif',
  display: 'Impact,Arial Black,Inter,sans-serif',
  mono: 'ui-monospace,SFMono-Regular,Consolas,Liberation Mono,monospace',
  serif: 'Georgia,Times New Roman,serif',
  rounded: 'Trebuchet MS,Arial Rounded MT Bold,Arial,sans-serif'
};

const profileState = {
  profile: null,
  working: null,
  saved: null,
  editing: false,
  selectedId: null,
  uploads: new Set(),
  preview: null
};

function profileMessage(text, type = '') {
  const target = profile$('#profile-message');
  if (!target) return;
  target.textContent = text;
  target.className = `profile-message${type ? ` ${type}` : ''}`;
}

function profileEditorMessage(text, type = '') {
  const target = profile$('#profile-editor-message');
  if (!target) return;
  target.textContent = text;
  target.className = `profile-editor-message${type ? ` ${type}` : ''}`;
}

function cloneProfile(value) {
  return structuredClone(value);
}

function selectedTile() {
  return profileState.working?.tiles.find(tile => tile.tileId === profileState.selectedId) ?? null;
}

function profilePathId() {
  return decodeURIComponent(location.pathname.slice('/profile/'.length));
}

function fontStack(value) {
  return PROFILE_FONT_STACKS[value] ?? PROFILE_FONT_STACKS.system;
}

function tileOverlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function validProfilePlacement(candidate, ignoreId = null) {
  if (
    candidate.x < 0 || candidate.y < 0 ||
    candidate.width < 1 || candidate.width > PROFILE_MAX_WIDTH ||
    candidate.height < 1 || candidate.height > PROFILE_MAX_HEIGHT ||
    candidate.x + candidate.width > PROFILE_COLUMNS
  ) return false;
  return !profileState.working.tiles.some(tile => tile.tileId !== ignoreId && tileOverlaps(candidate, tile));
}

function firstFreeProfilePlacement(width, height, ignoreId = null) {
  for (let y = 0; y < 200; y += 1) {
    for (let x = 0; x <= PROFILE_COLUMNS - width; x += 1) {
      const candidate = { x, y, width, height };
      if (validProfilePlacement(candidate, ignoreId)) return candidate;
    }
  }
  return { x: 0, y: 199 - height + 1, width, height };
}

function profileTileDefaults(type) {
  const dimensions = {
    text: [3, 2],
    link: [2, 1],
    media: [3, 2],
    stat: [2, 1]
  }[type] ?? [2, 1];
  const placement = firstFreeProfilePlacement(dimensions[0], dimensions[1]);
  return {
    tileId: crypto.randomUUID(),
    tileType: type,
    ...placement,
    title: type === 'text' ? 'About me' : (type === 'link' ? 'My link' : (type === 'stat' ? 'Stat' : null)),
    body: type === 'text' ? 'Write something about yourself.' : null,
    linkLabel: type === 'link' ? 'Open link' : null,
    linkUrl: null,
    statValue: type === 'stat' ? '100%' : null,
    backgroundType: type === 'media' ? 'media' : 'solid',
    backgroundPrimary: '#11161d',
    backgroundSecondary: '#3157c9',
    backgroundAngle: 135,
    backgroundMedia: null,
    mediaFit: 'cover',
    mediaOverlay: 'dark',
    textColour: '#f4f7fb',
    borderColour: '#394657',
    fontFamily: 'system'
  };
}

function profileTileBackground(tile) {
  if (tile.backgroundType === 'gradient') {
    return `linear-gradient(${tile.backgroundAngle}deg,${tile.backgroundPrimary},${tile.backgroundSecondary})`;
  }
  if (tile.backgroundType === 'media' && tile.backgroundMedia) {
    return `url("${tile.backgroundMedia.replaceAll('"', '\\"')}")`;
  }
  return tile.backgroundPrimary;
}

function profileTileElement(tile) {
  const element = document.createElement('article');
  element.className = `dashboard-tile profile-tile${profileState.editing ? ' editing' : ''}${profileState.selectedId === tile.tileId ? ' selected' : ''}`;
  element.dataset.tileId = tile.tileId;
  element.dataset.backgroundType = tile.backgroundType;
  element.dataset.mediaFit = tile.mediaFit;
  element.dataset.mediaOverlay = tile.mediaOverlay;
  element.dataset.width = String(tile.width);
  element.dataset.height = String(tile.height);
  element.style.gridColumn = `${tile.x + 1} / span ${tile.width}`;
  element.style.gridRow = `${tile.y + 1} / span ${tile.height}`;
  element.style.setProperty('--profile-mobile-width', String(Math.min(2, tile.width >= 3 ? 2 : tile.width)));
  element.style.setProperty('--profile-mobile-height', String(Math.max(1, Math.min(4, tile.height))));
  element.style.setProperty('--profile-tile-primary', tile.backgroundPrimary);
  element.style.setProperty('--profile-tile-secondary', tile.backgroundSecondary);
  element.style.setProperty('--profile-tile-angle', `${tile.backgroundAngle}deg`);
  element.style.setProperty('--profile-tile-text', tile.textColour);
  element.style.setProperty('--profile-tile-border', tile.borderColour);
  element.style.setProperty('--profile-tile-font', fontStack(tile.fontFamily));
  element.style.background = profileTileBackground(tile);
  element.style.backgroundPosition = 'center';
  element.style.backgroundRepeat = 'no-repeat';
  element.style.backgroundSize = tile.mediaFit === 'stretch' ? '100% 100%' : tile.mediaFit;

  if (profileState.editing) {
    const strip = document.createElement('div');
    strip.className = 'profile-tile-settings-strip';
    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'profile-tile-settings-button';
    settings.textContent = 'Tile settings';
    settings.addEventListener('pointerdown', event => event.stopPropagation());
    settings.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openProfileTileSettings(tile.tileId);
    });
    strip.append(settings);
    element.append(strip);

    const resize = document.createElement('button');
    resize.type = 'button';
    resize.className = 'profile-tile-resize';
    resize.textContent = '↘';
    resize.setAttribute('aria-label', `Resize ${tile.title || tile.tileType} tile`);
    resize.addEventListener('pointerdown', event => startProfileResize(event, tile, element));
    element.append(resize);

    element.addEventListener('pointerdown', event => startProfileMove(event, tile, element));
    element.addEventListener('click', event => {
      if (event.target.closest('button,input,textarea,select,a')) return;
      profileState.selectedId = tile.tileId;
      renderProfileGrid();
    });
  }

  const content = tile.tileType === 'link' && tile.linkUrl && !profileState.editing
    ? document.createElement('a')
    : document.createElement('div');
  content.className = 'profile-tile-content';
  if (content instanceof HTMLAnchorElement) {
    content.href = tile.linkUrl;
    content.target = '_blank';
    content.rel = 'noopener noreferrer';
  }

  const kind = document.createElement('span');
  kind.className = 'profile-tile-kind';
  kind.textContent = tile.tileType === 'media' ? 'Picture / GIF' : tile.tileType;

  const title = document.createElement('h2');
  title.textContent = tile.title || (tile.tileType === 'media' ? 'Picture tile' : 'Untitled');

  content.append(kind, title);

  if (tile.tileType === 'stat') {
    const value = document.createElement('strong');
    value.className = 'profile-tile-stat';
    value.textContent = tile.statValue || '—';
    content.append(value);
  }

  if (tile.body) {
    const body = document.createElement('p');
    body.textContent = tile.body;
    content.append(body);
  }

  if (tile.tileType === 'link') {
    const label = document.createElement('span');
    label.className = 'profile-tile-link-label';
    label.textContent = tile.linkLabel || 'Open link';
    content.append(label);
  }

  if (tile.tileType === 'media' && !tile.backgroundMedia) {
    const placeholder = document.createElement('p');
    placeholder.textContent = profileState.editing ? 'Open Tile settings and choose a picture or animated GIF.' : 'No picture selected.';
    content.append(placeholder);
  }

  element.append(content);
  return element;
}

function renderProfileCard() {
  if (!profileState.working) return;
  const cardProfile = {
    ...profileState.profile,
    displayName: profileState.working.card.displayName,
    card: profileState.working.card
  };
  window.GrevProfileCard?.apply(profile$('#profile-card'), cardProfile);
  const title = profile$('#profile-page-title');
  if (title) title.textContent = profileState.working.card.displayName;
}

function renderProfileGrid() {
  const grid = profile$('#profile-grid');
  const empty = profile$('#profile-empty');
  if (!grid || !profileState.working) return;
  const preferences = profileState.working.preferences;
  grid.className = `dashboard-tile-grid dashboard-grid profile-grid ${preferences.density}${profileState.editing ? ' editing-grid' : ''}`;
  grid.style.setProperty('--dashboard-gap', `${preferences.tileGap}px`);
  grid.style.setProperty('--dashboard-margin', `${preferences.outerMargin}px`);
  grid.replaceChildren(...profileState.working.tiles.map(profileTileElement));
  empty.hidden = profileState.working.tiles.length > 0;
  if (!profileState.working.tiles.length) {
    const text = empty.querySelector('p');
    if (text) text.textContent = profileState.editing
      ? 'Choose a tile type from the profile builder.'
      : 'This member has not added anything below their profile card.';
  }
}

function renderProfile() {
  renderProfileCard();
  renderProfileGrid();
  const editor = profile$('#profile-editor-toolbar');
  const catalogue = profile$('#profile-catalogue');
  const workspace = profile$('#profile-workspace');
  const editButton = profile$('#profile-edit');
  if (editor) editor.hidden = !profileState.editing;
  if (catalogue) catalogue.hidden = !profileState.editing;
  workspace?.classList.toggle('editing', profileState.editing);
  if (editButton) editButton.hidden = !profileState.profile?.isSelf || profileState.editing;
  const settingsLink = profile$('#profile-settings-link');
  if (settingsLink) settingsLink.hidden = !profileState.profile?.isSelf;
  const homeLink = profile$('#profile-grev-home-link');
  if (homeLink) homeLink.hidden = !profileState.profile?.isSelf || !profileState.editing;
  const description = profile$('#profile-grid-description');
  if (description) description.textContent = profileState.editing
    ? 'Grab a tile to move it, use the corner to resize it, or open Tile settings.'
    : 'Personal tiles selected by this member.';
}

function setPreferenceControls() {
  if (!profileState.working) return;
  profile$('#profile-density').value = profileState.working.preferences.density;
  profile$('#profile-tile-gap').value = String(profileState.working.preferences.tileGap);
  profile$('#profile-outer-margin').value = String(profileState.working.preferences.outerMargin);
}

function enterProfileEditor() {
  if (!profileState.profile?.isSelf || !profileState.working) return;
  profileState.saved = cloneProfile(profileState.working);
  profileState.editing = true;
  profileState.selectedId = null;
  setPreferenceControls();
  renderProfile();
  profileEditorMessage('Edit the card or add, move and resize profile tiles.');
}

function leaveProfileEditor(saved = false) {
  if (!saved && profileState.saved) profileState.working = cloneProfile(profileState.saved);
  profileState.editing = false;
  profileState.selectedId = null;
  profileState.saved = null;
  closeProfileDialogs();
  clearProfilePreview();
  renderProfile();
}

function profileGridMetrics() {
  const grid = profile$('#profile-grid');
  if (!grid) return null;
  const styles = getComputedStyle(grid);
  const rect = grid.getBoundingClientRect();
  const gap = Number.parseFloat(styles.columnGap) || 0;
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const columnWidth = (rect.width - paddingLeft - paddingRight - gap * (PROFILE_COLUMNS - 1)) / PROFILE_COLUMNS;
  const rowHeight = Number.parseFloat(styles.getPropertyValue('--tile-row-height')) || 100;
  return {
    grid,
    left: rect.left + paddingLeft,
    top: rect.top + paddingTop,
    pitchX: columnWidth + gap,
    pitchY: rowHeight + gap
  };
}

function showProfilePreview(candidate, valid) {
  clearProfilePreview();
  const grid = profile$('#profile-grid');
  if (!grid) return;
  const preview = document.createElement('div');
  preview.className = `profile-drop-preview${valid ? '' : ' invalid'}`;
  preview.dataset.label = valid ? 'Drop here' : 'Position blocked';
  preview.style.gridColumn = `${candidate.x + 1} / span ${candidate.width}`;
  preview.style.gridRow = `${candidate.y + 1} / span ${candidate.height}`;
  grid.append(preview);
  profileState.preview = preview;
}

function clearProfilePreview() {
  profileState.preview?.remove();
  profileState.preview = null;
}

function startProfileMove(event, tile, element) {
  if (!profileState.editing || event.button !== 0 || event.target.closest('button,input,textarea,select,a') || matchMedia('(max-width:900px)').matches) return;
  event.preventDefault();
  const metrics = profileGridMetrics();
  if (!metrics) return;
  const tileRect = element.getBoundingClientRect();
  const grabColumn = Math.max(0, Math.min(tile.width - 1, Math.floor((event.clientX - tileRect.left) / metrics.pitchX)));
  const grabRow = Math.max(0, Math.min(tile.height - 1, Math.floor((event.clientY - tileRect.top) / metrics.pitchY)));
  let candidate = { ...tile };
  let valid = true;
  profileState.selectedId = tile.tileId;
  element.classList.add('dragging');

  const move = pointerEvent => {
    const x = Math.floor((pointerEvent.clientX - metrics.left) / metrics.pitchX) - grabColumn;
    const y = Math.floor((pointerEvent.clientY - metrics.top) / metrics.pitchY) - grabRow;
    candidate = { ...tile, x, y };
    valid = validProfilePlacement(candidate, tile.tileId);
    showProfilePreview(candidate, valid);
  };

  const finish = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    element.classList.remove('dragging');
    if (valid) Object.assign(tile, { x: candidate.x, y: candidate.y });
    clearProfilePreview();
    renderProfileGrid();
  };

  const cancel = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    element.classList.remove('dragging');
    clearProfilePreview();
    renderProfileGrid();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
}

function startProfileResize(event, tile, element) {
  if (!profileState.editing || event.button !== 0 || matchMedia('(max-width:900px)').matches) return;
  event.preventDefault();
  event.stopPropagation();
  const metrics = profileGridMetrics();
  if (!metrics) return;
  const tileRect = element.getBoundingClientRect();
  let candidate = { ...tile };
  let valid = true;
  profileState.selectedId = tile.tileId;
  element.classList.add('resizing');

  const move = pointerEvent => {
    const width = Math.max(1, Math.min(PROFILE_MAX_WIDTH, Math.round((pointerEvent.clientX - tileRect.left + metrics.pitchX * .25) / metrics.pitchX)));
    const height = Math.max(1, Math.min(PROFILE_MAX_HEIGHT, Math.round((pointerEvent.clientY - tileRect.top + metrics.pitchY * .25) / metrics.pitchY)));
    candidate = { ...tile, width, height };
    valid = validProfilePlacement(candidate, tile.tileId);
    showProfilePreview(candidate, valid);
  };

  const finish = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    element.classList.remove('resizing');
    if (valid) Object.assign(tile, { width: candidate.width, height: candidate.height });
    clearProfilePreview();
    renderProfileGrid();
  };

  const cancel = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', cancel);
    element.classList.remove('resizing');
    clearProfilePreview();
    renderProfileGrid();
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', finish, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
}

function closeProfileDialogs() {
  for (const dialog of document.querySelectorAll('.profile-settings-dialog')) {
    if (dialog.open) dialog.close();
  }
}

function populateCardDialog() {
  const card = profileState.working?.card;
  if (!card) return;
  profile$('#profile-card-display-name').value = card.displayName;
  profile$('#profile-card-headline').value = card.headline ?? '';
  profile$('#profile-card-bio').value = card.bio ?? '';
  profile$('#profile-card-location').value = card.location ?? '';
  profile$('#profile-card-website').value = card.websiteUrl ?? '';
  profile$('#profile-card-primary').value = card.backgroundPrimary;
  profile$('#profile-card-secondary').value = card.backgroundSecondary;
  profile$('#profile-card-text').value = card.textColour;
  profile$('#profile-card-border').value = card.borderColour;
  profile$('#profile-card-angle').value = String(card.backgroundAngle);
  profile$('#profile-card-angle-value').textContent = `${card.backgroundAngle}°`;
  profile$('#profile-show-username').checked = card.showUsername;
  profile$('#profile-show-status').checked = card.showStatus;
  profile$('#profile-show-member-since').checked = card.showMemberSince;
  profile$('#profile-avatar-media-status').textContent = card.avatarMedia ? 'Custom picture selected.' : 'No custom picture.';
  profile$('#profile-cover-media-status').textContent = card.coverMedia ? 'Custom cover selected.' : 'No custom cover.';
}

function openCardDialog() {
  populateCardDialog();
  profile$('#profile-card-dialog')?.showModal();
}

function updateCardFromControls() {
  const card = profileState.working?.card;
  if (!card) return;
  card.displayName = profile$('#profile-card-display-name').value;
  card.headline = profile$('#profile-card-headline').value.trim() || null;
  card.bio = profile$('#profile-card-bio').value.trim() || null;
  card.location = profile$('#profile-card-location').value.trim() || null;
  card.websiteUrl = profile$('#profile-card-website').value.trim() || null;
  card.backgroundPrimary = profile$('#profile-card-primary').value;
  card.backgroundSecondary = profile$('#profile-card-secondary').value;
  card.textColour = profile$('#profile-card-text').value;
  card.borderColour = profile$('#profile-card-border').value;
  card.backgroundAngle = Number(profile$('#profile-card-angle').value);
  card.showUsername = profile$('#profile-show-username').checked;
  card.showStatus = profile$('#profile-show-status').checked;
  card.showMemberSince = profile$('#profile-show-member-since').checked;
  profile$('#profile-card-angle-value').textContent = `${card.backgroundAngle}°`;
  renderProfileCard();
}

function sizeOptions(tile) {
  const select = profile$('#profile-tile-size');
  select.replaceChildren();
  for (let height = 1; height <= PROFILE_MAX_HEIGHT; height += 1) {
    for (let width = 1; width <= PROFILE_MAX_WIDTH; width += 1) {
      const option = document.createElement('option');
      option.value = `${width}x${height}`;
      option.textContent = `${width} × ${height}`;
      option.selected = width === tile.width && height === tile.height;
      select.append(option);
    }
  }
}

function populateTileDialog() {
  const tile = selectedTile();
  if (!tile) return;
  profile$('#profile-tile-dialog-title').textContent = tile.title || `${tile.tileType} tile`;
  profile$('#profile-tile-type-label').textContent = `${tile.tileType} tile`;
  sizeOptions(tile);
  profile$('#profile-tile-title').value = tile.title ?? '';
  profile$('#profile-tile-body').value = tile.body ?? '';
  profile$('#profile-link-label').value = tile.linkLabel ?? '';
  profile$('#profile-link-url').value = tile.linkUrl ?? '';
  profile$('#profile-stat-value').value = tile.statValue ?? '';
  profile$('#profile-link-controls').hidden = tile.tileType !== 'link';
  profile$('#profile-stat-control').hidden = tile.tileType !== 'stat';
  profile$('#profile-tile-body-control').hidden = tile.tileType === 'media';
  profile$('#profile-tile-background-type').value = tile.backgroundType;
  profile$('#profile-tile-primary').value = tile.backgroundPrimary;
  profile$('#profile-tile-secondary').value = tile.backgroundSecondary;
  profile$('#profile-tile-text').value = tile.textColour;
  profile$('#profile-tile-border').value = tile.borderColour;
  profile$('#profile-tile-angle').value = String(tile.backgroundAngle);
  profile$('#profile-tile-angle-value').textContent = `${tile.backgroundAngle}°`;
  profile$('#profile-tile-media-fit').value = tile.mediaFit;
  profile$('#profile-tile-media-overlay').value = tile.mediaOverlay;
  profile$('#profile-tile-font').value = tile.fontFamily;
  profile$('#profile-tile-media-controls').hidden = tile.backgroundType !== 'media';
  profile$('#profile-tile-media-status').textContent = tile.backgroundMedia ? 'Picture selected.' : 'No picture selected.';
}

function openProfileTileSettings(tileId) {
  profileState.selectedId = tileId;
  renderProfileGrid();
  populateTileDialog();
  profile$('#profile-tile-dialog')?.showModal();
}

function updateSelectedTileFromControls() {
  const tile = selectedTile();
  if (!tile) return;
  tile.title = profile$('#profile-tile-title').value.trim() || null;
  tile.body = profile$('#profile-tile-body').value.trim() || null;
  tile.linkLabel = profile$('#profile-link-label').value.trim() || null;
  tile.linkUrl = profile$('#profile-link-url').value.trim() || null;
  tile.statValue = profile$('#profile-stat-value').value.trim() || null;
  tile.backgroundType = profile$('#profile-tile-background-type').value;
  tile.backgroundPrimary = profile$('#profile-tile-primary').value;
  tile.backgroundSecondary = profile$('#profile-tile-secondary').value;
  tile.textColour = profile$('#profile-tile-text').value;
  tile.borderColour = profile$('#profile-tile-border').value;
  tile.backgroundAngle = Number(profile$('#profile-tile-angle').value);
  tile.mediaFit = profile$('#profile-tile-media-fit').value;
  tile.mediaOverlay = profile$('#profile-tile-media-overlay').value;
  tile.fontFamily = profile$('#profile-tile-font').value;
  profile$('#profile-tile-angle-value').textContent = `${tile.backgroundAngle}°`;
  profile$('#profile-tile-media-controls').hidden = tile.backgroundType !== 'media';
  renderProfileGrid();
}

function moveSelectedTile(dx, dy) {
  const tile = selectedTile();
  if (!tile) return;
  const candidate = { ...tile, x: tile.x + dx, y: tile.y + dy };
  if (!validProfilePlacement(candidate, tile.tileId)) return profileEditorMessage('That position is blocked.', 'error');
  Object.assign(tile, { x: candidate.x, y: candidate.y });
  renderProfileGrid();
  profileEditorMessage('Tile moved.');
}

function resizeSelectedTile(value) {
  const tile = selectedTile();
  if (!tile) return;
  const [width, height] = value.split('x').map(Number);
  const candidate = { ...tile, width, height };
  if (!validProfilePlacement(candidate, tile.tileId)) {
    profile$('#profile-tile-size').value = `${tile.width}x${tile.height}`;
    return profileEditorMessage('That tile size collides with another tile or exceeds the grid.', 'error');
  }
  Object.assign(tile, { width, height });
  renderProfileGrid();
}

function removeSelectedTile() {
  if (!profileState.selectedId) return;
  profileState.working.tiles = profileState.working.tiles.filter(tile => tile.tileId !== profileState.selectedId);
  profileState.selectedId = null;
  profile$('#profile-tile-dialog')?.close();
  renderProfileGrid();
  profileEditorMessage('Tile removed. Save profile to make the change permanent.');
}

function packProfileTiles() {
  const packed = [];
  const original = profileState.working.tiles;
  profileState.working.tiles = packed;
  for (const tile of original) {
    const placement = firstFreeProfilePlacement(tile.width, tile.height);
    Object.assign(tile, placement);
    packed.push(tile);
  }
  renderProfileGrid();
  profileEditorMessage('Tiles packed into the earliest available spaces.');
}

async function readProfileImage(file, key) {
  if (!file) return null;
  if (!PROFILE_IMAGE_TYPES.has(file.type) || file.size > PROFILE_MAX_MEDIA_BYTES) {
    profileEditorMessage('Choose a PNG, JPEG, WebP or animated GIF no larger than 1.4 MB.', 'error');
    return null;
  }
  profileState.uploads.add(key);
  try {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(typeof reader.result === 'string' ? reader.result : null), { once: true });
      reader.addEventListener('error', () => reject(reader.error), { once: true });
      reader.readAsDataURL(file);
    });
  } finally {
    profileState.uploads.delete(key);
  }
}

function addProfileTile(type) {
  const tile = profileTileDefaults(type);
  profileState.working.tiles.push(tile);
  profileState.selectedId = tile.tileId;
  renderProfileGrid();
  openProfileTileSettings(tile.tileId);
  profileEditorMessage(`${type === 'media' ? 'Picture / GIF' : type} tile added. Configure it before saving.`);
}

function profilePayloadForSave() {
  return {
    card: profileState.working.card,
    tiles: profileState.working.tiles,
    preferences: profileState.working.preferences
  };
}

function validateProfileBeforeSave() {
  const card = profileState.working.card;
  if (!card.displayName.trim()) return 'Display name cannot be empty.';
  if (card.websiteUrl && !/^https?:\/\//i.test(card.websiteUrl)) return 'Website links must start with http:// or https://.';
  for (const tile of profileState.working.tiles) {
    if (tile.tileType === 'link' && (!tile.linkUrl || !/^https?:\/\//i.test(tile.linkUrl))) return 'Every link tile needs a valid http:// or https:// URL.';
    if ((tile.tileType === 'media' || tile.backgroundType === 'media') && !tile.backgroundMedia) return 'Every picture/GIF tile needs an uploaded picture.';
  }
  return null;
}

async function saveProfile() {
  if (profileState.uploads.size) return profileEditorMessage('Wait for the selected picture to finish loading before saving.', 'error');
  const invalid = validateProfileBeforeSave();
  if (invalid) return profileEditorMessage(invalid, 'error');
  profileEditorMessage('Saving profile…');
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profilePayloadForSave())
  });
  const payload = await response.json();
  if (!response.ok || !payload.profile) return profileEditorMessage(payload.message ?? 'Unable to save profile.', 'error');
  profileState.profile = payload.profile;
  profileState.working = {
    card: cloneProfile(payload.profile.card),
    tiles: cloneProfile(payload.profile.tiles),
    preferences: cloneProfile(payload.profile.preferences)
  };
  profileState.saved = cloneProfile(profileState.working);
  leaveProfileEditor(true);
  profileMessage('Profile saved.', 'success');
}

async function loadProfileBuilder() {
  if (!profile$('#profile-card')) return;
  const response = await fetch(`/api/profiles/${encodeURIComponent(profilePathId())}`, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok || !payload.profile) {
    profileMessage(payload.message ?? 'This profile is unavailable.', 'error');
    return;
  }
  profileState.profile = payload.profile;
  profileState.working = {
    card: cloneProfile(payload.profile.card),
    tiles: cloneProfile(payload.profile.tiles ?? []),
    preferences: cloneProfile(payload.profile.preferences)
  };
  document.title = `${payload.profile.card.displayName} · Grev.dad`;
  renderProfile();
  profileMessage(payload.profile.isSelf ? 'This is your editable profile.' : `Viewing @${payload.profile.username}.`);
}

profile$('#profile-edit')?.addEventListener('click', enterProfileEditor);
profile$('#profile-card-settings')?.addEventListener('click', openCardDialog);
profile$('#profile-cancel')?.addEventListener('click', () => leaveProfileEditor(false));
profile$('#profile-save')?.addEventListener('click', saveProfile);
profile$('#profile-pack')?.addEventListener('click', packProfileTiles);

for (const button of document.querySelectorAll('[data-close-dialog]')) {
  button.addEventListener('click', () => profile$(`#${button.dataset.closeDialog}`)?.close());
}

for (const control of document.querySelectorAll('#profile-card-dialog input:not([type="file"]),#profile-card-dialog textarea')) {
  control.addEventListener('input', updateCardFromControls);
  control.addEventListener('change', updateCardFromControls);
}

profile$('#profile-avatar-media')?.addEventListener('change', async event => {
  const media = await readProfileImage(event.currentTarget.files?.[0], 'avatar');
  if (!media) return;
  profileState.working.card.avatarMedia = media;
  profile$('#profile-avatar-media-status').textContent = 'Custom picture selected.';
  renderProfileCard();
});

profile$('#profile-cover-media')?.addEventListener('change', async event => {
  const media = await readProfileImage(event.currentTarget.files?.[0], 'cover');
  if (!media) return;
  profileState.working.card.coverMedia = media;
  profile$('#profile-cover-media-status').textContent = 'Custom cover selected.';
  renderProfileCard();
});

profile$('#profile-remove-avatar')?.addEventListener('click', () => {
  profileState.working.card.avatarMedia = null;
  profile$('#profile-avatar-media-status').textContent = 'No custom picture.';
  renderProfileCard();
});

profile$('#profile-remove-cover')?.addEventListener('click', () => {
  profileState.working.card.coverMedia = null;
  profile$('#profile-cover-media-status').textContent = 'No custom cover.';
  renderProfileCard();
});

for (const button of document.querySelectorAll('[data-add-profile-tile]')) {
  button.addEventListener('click', () => addProfileTile(button.dataset.addProfileTile));
}

for (const control of document.querySelectorAll('#profile-tile-dialog input:not([type="file"]),#profile-tile-dialog textarea,#profile-tile-dialog select:not(#profile-tile-size)')) {
  control.addEventListener('input', updateSelectedTileFromControls);
  control.addEventListener('change', updateSelectedTileFromControls);
}

profile$('#profile-tile-size')?.addEventListener('change', event => resizeSelectedTile(event.currentTarget.value));

for (const button of document.querySelectorAll('[data-profile-move]')) {
  button.addEventListener('click', () => {
    const [dx, dy] = button.dataset.profileMove.split(',').map(Number);
    moveSelectedTile(dx, dy);
  });
}

profile$('#profile-remove-tile')?.addEventListener('click', removeSelectedTile);

profile$('#profile-tile-media')?.addEventListener('change', async event => {
  const tile = selectedTile();
  if (!tile) return;
  const media = await readProfileImage(event.currentTarget.files?.[0], `tile-${tile.tileId}`);
  if (!media) return;
  tile.backgroundMedia = media;
  tile.backgroundType = 'media';
  profile$('#profile-tile-background-type').value = 'media';
  profile$('#profile-tile-media-status').textContent = 'Picture selected.';
  populateTileDialog();
  renderProfileGrid();
});

profile$('#profile-remove-tile-media')?.addEventListener('click', () => {
  const tile = selectedTile();
  if (!tile) return;
  tile.backgroundMedia = null;
  if (tile.tileType !== 'media') tile.backgroundType = 'solid';
  profile$('#profile-tile-media-status').textContent = 'No picture selected.';
  populateTileDialog();
  renderProfileGrid();
});

profile$('#profile-density')?.addEventListener('change', event => {
  profileState.working.preferences.density = event.currentTarget.value;
  renderProfileGrid();
});
profile$('#profile-tile-gap')?.addEventListener('change', event => {
  profileState.working.preferences.tileGap = Number(event.currentTarget.value);
  renderProfileGrid();
});
profile$('#profile-outer-margin')?.addEventListener('change', event => {
  profileState.working.preferences.outerMargin = Number(event.currentTarget.value);
  renderProfileGrid();
});

profile$('#logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  location.replace('/');
});

loadProfileBuilder().catch(error => {
  console.error(error);
  profileMessage('Unable to load this profile.', 'error');
});
