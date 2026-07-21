(() => {
  const COLUMNS = 4;
  const MAX_TILES = 4;
  const MAX_Y = 7;
  const MAX_FILE_BYTES = 1_400_000;
  const FONT_STACKS = {
    system: 'Inter,Segoe UI,Arial,sans-serif',
    display: 'Impact,Haettenschweiler,Arial Narrow Bold,sans-serif',
    mono: 'ui-monospace,SFMono-Regular,Consolas,Liberation Mono,monospace',
    serif: 'Georgia,Times New Roman,serif',
    rounded: 'Trebuchet MS,Arial Rounded MT Bold,Arial,sans-serif'
  };
  const state = {
    profile: null,
    root: null,
    saved: [],
    working: [],
    catalogue: [],
    editing: false,
    selectedId: null,
    pendingUploads: new Set(),
    editor: null,
    dialog: null,
    message: null,
    drag: null
  };
  const nativeFetch = window.fetch.bind(window);

  const clone = value => JSON.parse(JSON.stringify(value));
  const tileById = id => state.working.find(tile => tile.tileId === id) ?? null;
  const selectedTile = () => tileById(state.selectedId);
  const featureFor = tile => tile.feature ?? state.catalogue.find(feature => feature.id === tile.featureId) ?? null;

  function defaults(kind) {
    const tile = {
      tileId: crypto.randomUUID(),
      tileKind: kind,
      featureId: null,
      position: state.working.length,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      title: kind === 'link' ? 'New link' : (kind === 'custom' ? 'Custom tile' : null),
      description: null,
      linkLabel: kind === 'link' ? 'Open link' : null,
      linkUrl: null,
      contentMode: 'standard',
      customTitle: null,
      customIcon: null,
      backgroundType: 'solid',
      backgroundPrimary: '#11161d',
      backgroundSecondary: '#5268aa',
      backgroundAngle: 135,
      backgroundMedia: null,
      textColour: '#f4f7fb',
      fontFamily: 'system',
      borderColour: '#394657',
      mediaFit: 'cover',
      mediaOverlay: 'dark',
      iconMode: 'text',
      iconLabel: kind === 'link' ? '↗' : (kind === 'custom' ? '•' : null),
      iconMedia: null,
      iconTextColour: '#090b0f',
      iconBackgroundColour: '#f3f5f8',
      iconBorderColour: '#667181',
      iconMediaFit: 'cover',
      feature: null
    };
    if (kind === 'feature' && state.catalogue[0]) {
      tile.featureId = state.catalogue[0].id;
      tile.feature = state.catalogue[0];
    }
    const placement = firstFreePlacement(tile.width, tile.height);
    tile.x = placement.x;
    tile.y = placement.y;
    return tile;
  }

  function firstFreePlacement(width, height, ignoreId = null) {
    for (let y = 0; y <= MAX_Y - height + 1; y += 1) {
      for (let x = 0; x <= COLUMNS - width; x += 1) {
        const candidate = { x, y, width, height };
        if (validPlacement(candidate, ignoreId)) return candidate;
      }
    }
    return { x: 0, y: Math.max(0, MAX_Y - height + 1), width, height };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function validPlacement(candidate, ignoreId = null) {
    if (!Number.isInteger(candidate.x) || !Number.isInteger(candidate.y) || !Number.isInteger(candidate.width) || !Number.isInteger(candidate.height)) return false;
    if (candidate.x < 0 || candidate.y < 0 || candidate.y > MAX_Y || candidate.width < 1 || candidate.width > COLUMNS || candidate.height < 1 || candidate.height > 2) return false;
    if (candidate.x + candidate.width > COLUMNS || candidate.y + candidate.height > MAX_Y + 1) return false;
    return !state.working.some(tile => tile.tileId !== ignoreId && overlaps(candidate, tile));
  }

  function tileHref(tile) {
    const feature = featureFor(tile);
    if (tile.tileKind === 'feature') return feature?.route ?? null;
    return tile.linkUrl || null;
  }

  function tileTitle(tile) {
    const feature = featureFor(tile);
    return tile.title || tile.linkLabel || feature?.name || (tile.tileKind === 'link' ? 'External link' : 'Custom tile');
  }

  function tileDescription(tile) {
    const feature = featureFor(tile);
    return tile.description || feature?.description || (tile.tileKind === 'link' ? tile.linkUrl : '');
  }

  function tileIcon(tile) {
    const feature = featureFor(tile);
    return tile.iconLabel || feature?.iconText || (tile.tileKind === 'link' ? '↗' : '•');
  }

  function setBackground(element, tile) {
    const font = FONT_STACKS[tile.fontFamily] || FONT_STACKS.system;
    element.style.setProperty('--card-tile-text', tile.textColour);
    element.style.setProperty('--card-tile-border', tile.borderColour);
    element.style.setProperty('--card-tile-font', font);
    element.style.setProperty('--card-icon-text', tile.iconTextColour);
    element.style.setProperty('--card-icon-background', tile.iconBackgroundColour);
    element.style.setProperty('--card-icon-border', tile.iconBorderColour);
    element.style.setProperty('--card-icon-fit', tile.iconMediaFit);
    element.style.setProperty('--card-mobile-width', String(Math.min(2, Math.max(1, tile.width))));
    element.style.setProperty('--card-mobile-height', String(Math.min(2, Math.max(1, tile.height))));
    if (tile.backgroundType === 'media' && tile.backgroundMedia) {
      element.style.setProperty('--card-tile-background', `url("${tile.backgroundMedia.replaceAll('"', '\\"')}") center/${tile.mediaFit === 'stretch' ? '100% 100%' : tile.mediaFit} no-repeat`);
    } else if (tile.backgroundType === 'gradient') {
      element.style.setProperty('--card-tile-background', `linear-gradient(${tile.backgroundAngle}deg,${tile.backgroundPrimary},${tile.backgroundSecondary})`);
    } else {
      element.style.setProperty('--card-tile-background', tile.backgroundPrimary);
    }
    const overlays = { none: 'transparent', dark: 'rgba(0,0,0,.38)', light: 'rgba(255,255,255,.28)' };
    element.style.setProperty('--card-tile-overlay', tile.backgroundType === 'media' ? overlays[tile.mediaOverlay] : 'transparent');
    element.dataset.overlay = tile.mediaOverlay;
  }

  function iconElement(tile) {
    const icon = document.createElement('span');
    icon.className = 'profile-card-mini-icon';
    if (tile.iconMode === 'image' && tile.iconMedia) {
      icon.style.backgroundImage = `url("${tile.iconMedia.replaceAll('"', '\\"')}")`;
      icon.textContent = '';
    } else {
      icon.textContent = tileIcon(tile);
    }
    return icon;
  }

  function standardContent(tile) {
    const content = document.createElement('div');
    content.className = 'profile-card-mini-content';
    const head = document.createElement('div');
    head.className = 'profile-card-mini-head';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'profile-card-mini-title-wrap';
    const kind = document.createElement('small');
    kind.className = 'profile-card-mini-kind';
    kind.textContent = tile.tileKind === 'feature' ? (featureFor(tile)?.category || 'Grev.dad') : (tile.tileKind === 'link' ? 'External link' : 'Custom');
    const title = document.createElement('strong');
    title.className = 'profile-card-mini-title';
    title.textContent = tileTitle(tile);
    titleWrap.append(kind, title);
    head.append(iconElement(tile), titleWrap);
    const description = document.createElement('p');
    description.className = 'profile-card-mini-description';
    description.textContent = tileDescription(tile) || '';
    content.append(head, description);
    return content;
  }

  function mediaContent(tile) {
    const content = document.createElement('div');
    content.className = 'profile-card-mini-media';
    if (tile.customIcon) {
      const icon = document.createElement('span');
      icon.className = 'profile-card-mini-media-icon';
      icon.textContent = tile.customIcon;
      content.append(icon);
    }
    const titleText = tile.customTitle || tileTitle(tile);
    if (titleText) {
      const title = document.createElement('strong');
      title.className = 'profile-card-mini-media-title';
      title.textContent = titleText;
      content.append(title);
    }
    if (!tile.backgroundMedia) {
      const placeholder = document.createElement('span');
      placeholder.className = 'profile-card-mini-placeholder';
      placeholder.textContent = 'Choose picture / GIF';
      content.append(placeholder);
    }
    return content;
  }

  function createTileElement(tile) {
    const href = !state.editing ? tileHref(tile) : null;
    const element = href ? document.createElement('a') : document.createElement('article');
    element.className = `profile-card-mini-tile${state.editing ? ' card-editing' : ''}${state.selectedId === tile.tileId ? ' card-selected' : ''}`;
    element.dataset.tileId = tile.tileId;
    element.style.gridColumn = `${tile.x + 1} / span ${tile.width}`;
    element.style.gridRow = `${tile.y + 1} / span ${tile.height}`;
    setBackground(element, tile);
    if (href) {
      element.href = href;
      if (/^https?:\/\//i.test(href)) {
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      }
    }
    element.append(tile.contentMode === 'media-button' ? mediaContent(tile) : standardContent(tile));
    if (state.editing) {
      const strip = document.createElement('div');
      strip.className = 'profile-card-mini-edit-strip';
      const settings = document.createElement('button');
      settings.type = 'button';
      settings.className = 'profile-card-mini-settings';
      settings.textContent = 'Tile settings';
      settings.addEventListener('pointerdown', event => event.stopPropagation());
      settings.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openDialog(tile.tileId);
      });
      strip.append(settings);
      const resize = document.createElement('span');
      resize.className = 'profile-card-mini-resize';
      resize.title = 'Resize tile';
      resize.addEventListener('pointerdown', event => beginPointerEdit(event, tile, 'resize', element));
      element.append(strip, resize);
      element.addEventListener('pointerdown', event => {
        if (event.target.closest('button,.profile-card-mini-resize')) return;
        beginPointerEdit(event, tile, 'move', element);
      });
      element.addEventListener('dblclick', () => openDialog(tile.tileId));
    }
    return element;
  }

  function ensureArea(root) {
    let area = root.querySelector('.profile-card-tile-area');
    if (!area) {
      area = document.createElement('section');
      area.className = 'profile-card-tile-area';
      area.setAttribute('aria-label', 'Profile card tiles');
      const grid = document.createElement('div');
      grid.className = 'profile-card-tile-grid';
      grid.id = 'profile-card-tile-grid';
      area.append(grid);
      root.append(area);
    }
    return area;
  }

  function render() {
    if (!state.root) return;
    const area = ensureArea(state.root);
    const grid = area.querySelector('.profile-card-tile-grid');
    const tiles = state.editing ? state.working : state.saved;
    area.hidden = tiles.length === 0 && !state.editing;
    grid.replaceChildren(...tiles.slice().sort((a, b) => a.y - b.y || a.x - b.x || a.position - b.position).map(createTileElement));
    updateEditorSummary();
  }

  function updateEditorSummary() {
    if (!state.editor) return;
    const count = state.working.length;
    const summary = state.editor.querySelector('[data-card-tile-count]');
    if (summary) summary.textContent = `${count} of ${MAX_TILES}`;
    state.editor.querySelectorAll('[data-add-card-tile]').forEach(button => { button.disabled = count >= MAX_TILES; });
  }

  function editorMessage(text, type = '') {
    if (!state.message) return;
    state.message.textContent = text;
    state.message.className = `profile-card-tile-editor-message${type ? ` ${type}` : ''}`;
  }

  async function loadCatalogue() {
    if (state.catalogue.length) return;
    const response = await nativeFetch('/api/profile-card-tiles/catalogue', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'Unable to load site tiles.');
    state.catalogue = payload.features || [];
    refreshFeatureSelect();
  }

  function addTile(kind) {
    if (state.working.length >= MAX_TILES) return editorMessage('The profile card can contain up to four tiles.', 'error');
    if (kind === 'feature' && !state.catalogue.length) return editorMessage('No site tiles are currently available to this account.', 'error');
    const tile = defaults(kind);
    if (!validPlacement(tile, tile.tileId)) return editorMessage('There is no free space for another tile. Move or resize an existing tile first.', 'error');
    state.working.push(tile);
    state.working.forEach((item, index) => { item.position = index; });
    state.selectedId = tile.tileId;
    render();
    openDialog(tile.tileId);
  }

  function packTiles() {
    const packed = [];
    for (const tile of state.working.slice().sort((a, b) => a.position - b.position)) {
      const original = state.working;
      state.working = packed;
      const placement = firstFreePlacement(tile.width, tile.height, tile.tileId);
      state.working = original;
      packed.push({ ...tile, x: placement.x, y: placement.y });
    }
    state.working = packed.map((tile, index) => ({ ...tile, position: index }));
    render();
    editorMessage('Card tiles packed into the first available spaces.', 'success');
  }

  function beginPointerEdit(event, tile, mode, element) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    state.selectedId = tile.tileId;
    const grid = element.parentElement;
    const gridRect = grid.getBoundingClientRect();
    const style = getComputedStyle(grid);
    const gap = Number.parseFloat(style.columnGap) || 0;
    const rowGap = Number.parseFloat(style.rowGap) || gap;
    const cellWidth = (gridRect.width - gap * (COLUMNS - 1)) / COLUMNS;
    const rowHeight = Number.parseFloat(style.gridAutoRows) || 92;
    const tileRect = element.getBoundingClientRect();
    const grabX = mode === 'move' ? Math.max(0, Math.min(tile.width - 1, Math.floor((event.clientX - tileRect.left) / (cellWidth + gap)))) : 0;
    const grabY = mode === 'move' ? Math.max(0, Math.min(tile.height - 1, Math.floor((event.clientY - tileRect.top) / (rowHeight + rowGap)))) : 0;
    state.drag = { mode, tile, element, gridRect, gap, rowGap, cellWidth, rowHeight, grabX, grabY };
    element.classList.add('card-selected');
    const move = pointerEvent => pointerMove(pointerEvent);
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      state.drag = null;
      render();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
  }

  function pointerMove(event) {
    const drag = state.drag;
    if (!drag) return;
    const tile = drag.tile;
    let candidate;
    if (drag.mode === 'move') {
      const column = Math.floor((event.clientX - drag.gridRect.left) / (drag.cellWidth + drag.gap)) - drag.grabX;
      const row = Math.floor((event.clientY - drag.gridRect.top) / (drag.rowHeight + drag.rowGap)) - drag.grabY;
      candidate = { x: Math.max(0, Math.min(COLUMNS - tile.width, column)), y: Math.max(0, Math.min(MAX_Y - tile.height + 1, row)), width: tile.width, height: tile.height };
    } else {
      const width = Math.max(1, Math.min(COLUMNS - tile.x, Math.ceil((event.clientX - drag.element.getBoundingClientRect().left + drag.gap) / (drag.cellWidth + drag.gap))));
      const height = Math.max(1, Math.min(2, Math.ceil((event.clientY - drag.element.getBoundingClientRect().top + drag.rowGap) / (drag.rowHeight + drag.rowGap))));
      candidate = { x: tile.x, y: tile.y, width, height };
    }
    if (!validPlacement(candidate, tile.tileId)) return;
    Object.assign(tile, candidate);
    drag.element.style.gridColumn = `${tile.x + 1} / span ${tile.width}`;
    drag.element.style.gridRow = `${tile.y + 1} / span ${tile.height}`;
  }

  function validate() {
    if (state.pendingUploads.size) return 'Wait for the selected card-tile picture to finish loading.';
    if (state.working.length > MAX_TILES) return 'Choose up to four profile-card tiles.';
    for (const tile of state.working) {
      if (!validPlacement(tile, tile.tileId)) return 'Every profile-card tile must stay inside the four-column mini grid without overlapping.';
      if (tile.tileKind === 'feature' && !tile.featureId) return 'Choose a Grev.dad site tile.';
      if (tile.tileKind === 'link' && !validUrl(tile.linkUrl)) return 'Every external link tile needs a valid HTTP or HTTPS address.';
      if (tile.backgroundType === 'media' && !tile.backgroundMedia) return 'Picture backgrounds need an uploaded picture or GIF.';
      if (tile.contentMode === 'media-button' && (tile.backgroundType !== 'media' || !tile.backgroundMedia)) return 'Full media tiles need a picture or GIF background.';
      if (tile.contentMode === 'standard' && tile.iconMode === 'image' && !tile.iconMedia) return 'Picture icons need an uploaded picture or GIF.';
    }
    return null;
  }

  function validUrl(value) {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function serializableTiles() {
    return state.working.map((tile, position) => ({ ...tile, feature: undefined, position }));
  }

  function injectEditor() {
    const preferences = document.querySelector('.profile-editor-preferences');
    if (!preferences || document.querySelector('#profile-card-tile-editor')) return;
    const editor = document.createElement('section');
    editor.id = 'profile-card-tile-editor';
    editor.className = 'profile-card-tile-editor';
    editor.hidden = true;
    editor.innerHTML = `
      <div class="profile-card-tile-editor-heading">
        <div><p class="eyebrow">Profile-card tiles</p><h3>Add up to four mini tiles</h3><p>Use Grev.dad features, external links or custom content. Drag, resize and style each tile independently.</p></div>
        <strong data-card-tile-count>0 of 4</strong>
      </div>
      <div class="profile-card-tile-add">
        <button type="button" data-add-card-tile="feature"><strong>Site tile</strong><span>Link to a feature this account can access.</span></button>
        <button type="button" data-add-card-tile="link"><strong>External link</strong><span>Open any HTTP or HTTPS website.</span></button>
        <button type="button" data-add-card-tile="custom"><strong>Custom tile</strong><span>Text, picture, GIF or optional link.</span></button>
        <button type="button" data-pack-card-tiles><strong>Pack tiles</strong><span>Move them into the first available spaces.</span></button>
      </div>
      <p class="profile-card-tile-editor-message" role="status">The mini-grid uses four columns and supports the same appearance controls as other tiles.</p>`;
    preferences.insertAdjacentElement('afterend', editor);
    state.editor = editor;
    state.message = editor.querySelector('.profile-card-tile-editor-message');
    editor.querySelectorAll('[data-add-card-tile]').forEach(button => button.addEventListener('click', () => addTile(button.dataset.addCardTile)));
    editor.querySelector('[data-pack-card-tiles]').addEventListener('click', packTiles);
  }

  function injectDialog() {
    if (document.querySelector('#profile-card-tile-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'profile-card-tile-dialog';
    dialog.className = 'profile-settings-dialog';
    dialog.innerHTML = `
      <div class="profile-dialog-heading"><div><p class="eyebrow">Profile-card tile</p><h2>Edit mini tile</h2></div><button type="button" data-card-dialog-close>Close</button></div>
      <div class="profile-dialog-body">
        <section class="card-tile-dialog-section"><h3>Layout</h3><div class="card-tile-two"><label>Size<select id="card-tile-size"></select></label><div class="card-tile-move" aria-label="Move card tile"><button type="button" data-card-move="-1,0">←</button><button type="button" data-card-move="0,-1">↑</button><button type="button" data-card-move="0,1">↓</button><button type="button" data-card-move="1,0">→</button></div></div></section>
        <section class="card-tile-dialog-section"><h3>Content</h3>
          <div class="card-tile-two"><label>Tile type<select id="card-tile-kind"><option value="feature">Grev.dad site tile</option><option value="link">External link</option><option value="custom">Custom tile</option></select></label><label>Content mode<select id="card-tile-content-mode"><option value="standard">Standard tile</option><option value="media-button">Full media tile</option></select></label></div>
          <label id="card-feature-control">Site feature<select id="card-tile-feature"></select></label>
          <div id="card-text-controls"><label>Title<input id="card-tile-title" type="text" maxlength="80"></label><label>Description<textarea id="card-tile-description" rows="4" maxlength="500"></textarea></label></div>
          <div id="card-link-controls" class="card-tile-two"><label>Link label<input id="card-tile-link-label" type="text" maxlength="80"></label><label>HTTP / HTTPS address<input id="card-tile-link-url" type="url" maxlength="500" placeholder="https://"></label></div>
          <div id="card-media-content-controls" class="card-tile-two" hidden><label>Optional media title<input id="card-tile-custom-title" type="text" maxlength="80"></label><label>Optional icon / emoji<input id="card-tile-custom-icon" type="text" maxlength="12"></label></div>
        </section>
        <section id="card-standard-icon-section" class="card-tile-dialog-section"><h3>Standard icon</h3>
          <div class="card-tile-two"><label>Icon type<select id="card-tile-icon-mode"><option value="text">Letters or short text</option><option value="image">Picture / GIF</option></select></label><label>Letters or short text<input id="card-tile-icon-label" type="text" maxlength="6"></label></div>
          <div class="card-tile-three"><label>Text colour<input id="card-tile-icon-text" type="color"></label><label>Background<input id="card-tile-icon-background" type="color"></label><label>Border<input id="card-tile-icon-border" type="color"></label></div>
          <div id="card-icon-media-controls" hidden><label class="card-tile-upload">Icon picture / GIF<input id="card-tile-icon-media" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><span id="card-tile-icon-status">No icon picture selected.</span></label><div class="card-tile-media-actions"><label>Picture fit<select id="card-tile-icon-fit"><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option></select></label><button id="card-tile-remove-icon" type="button">Remove icon picture</button></div></div>
        </section>
        <section class="card-tile-dialog-section"><h3>Appearance</h3>
          <label>Background type<select id="card-tile-background-type"><option value="solid">Solid colour</option><option value="gradient">Gradient</option><option value="media">Picture / animated GIF</option></select></label>
          <div class="card-tile-four"><label>First colour<input id="card-tile-primary" type="color"></label><label>Second colour<input id="card-tile-secondary" type="color"></label><label>Text colour<input id="card-tile-text" type="color"></label><label>Border colour<input id="card-tile-border" type="color"></label></div>
          <label>Gradient angle <output id="card-tile-angle-output">135°</output><input id="card-tile-angle" type="range" min="0" max="360" step="5"></label>
          <div id="card-background-media-controls" hidden><label class="card-tile-upload">Background picture / GIF<input id="card-tile-background-media" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><span id="card-tile-background-status">No background picture selected.</span></label><div class="card-tile-media-actions"><div class="card-tile-two"><label>Picture fit<select id="card-tile-media-fit"><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option></select></label><label>Overlay<select id="card-tile-overlay"><option value="dark">Dark</option><option value="light">Light</option><option value="none">None</option></select></label></div><button id="card-tile-remove-background" type="button">Remove background picture</button></div></div>
          <label>Font<select id="card-tile-font"><option value="system">Grev.dad system</option><option value="display">Bold display</option><option value="mono">Monospace</option><option value="serif">Serif</option><option value="rounded">Rounded</option></select></label>
        </section>
        <button id="card-tile-remove" class="card-tile-danger" type="button">Remove mini tile</button>
      </div>`;
    document.body.append(dialog);
    state.dialog = dialog;
    populateSizeOptions();
    bindDialog();
  }

  function populateSizeOptions() {
    const select = document.querySelector('#card-tile-size');
    if (!select) return;
    const options = [];
    for (let height = 1; height <= 2; height += 1) {
      for (let width = 1; width <= COLUMNS; width += 1) options.push(new Option(`${width} × ${height}`, `${width}x${height}`));
    }
    select.replaceChildren(...options);
  }

  function refreshFeatureSelect() {
    const select = document.querySelector('#card-tile-feature');
    if (!select) return;
    select.replaceChildren(...state.catalogue.map(feature => new Option(`${feature.category} · ${feature.name}`, feature.id)));
  }

  function openDialog(tileId) {
    state.selectedId = tileId;
    populateDialog();
    render();
    state.dialog?.showModal();
  }

  function closeDialog() {
    state.dialog?.close();
  }

  function populateDialog() {
    const tile = selectedTile();
    if (!tile) return;
    const set = (selector, value) => { const element = document.querySelector(selector); if (element) element.value = value ?? ''; };
    set('#card-tile-size', `${tile.width}x${tile.height}`);
    set('#card-tile-kind', tile.tileKind);
    set('#card-tile-content-mode', tile.contentMode);
    set('#card-tile-feature', tile.featureId);
    set('#card-tile-title', tile.title);
    set('#card-tile-description', tile.description);
    set('#card-tile-link-label', tile.linkLabel);
    set('#card-tile-link-url', tile.linkUrl);
    set('#card-tile-custom-title', tile.customTitle);
    set('#card-tile-custom-icon', tile.customIcon);
    set('#card-tile-icon-mode', tile.iconMode);
    set('#card-tile-icon-label', tile.iconLabel);
    set('#card-tile-icon-text', tile.iconTextColour);
    set('#card-tile-icon-background', tile.iconBackgroundColour);
    set('#card-tile-icon-border', tile.iconBorderColour);
    set('#card-tile-icon-fit', tile.iconMediaFit);
    set('#card-tile-background-type', tile.backgroundType);
    set('#card-tile-primary', tile.backgroundPrimary);
    set('#card-tile-secondary', tile.backgroundSecondary);
    set('#card-tile-text', tile.textColour);
    set('#card-tile-border', tile.borderColour);
    set('#card-tile-angle', tile.backgroundAngle);
    set('#card-tile-media-fit', tile.mediaFit);
    set('#card-tile-overlay', tile.mediaOverlay);
    set('#card-tile-font', tile.fontFamily);
    const angle = document.querySelector('#card-tile-angle-output');
    if (angle) angle.textContent = `${tile.backgroundAngle}°`;
    const bgStatus = document.querySelector('#card-tile-background-status');
    if (bgStatus) bgStatus.textContent = tile.backgroundMedia ? 'Background picture selected.' : 'No background picture selected.';
    const iconStatus = document.querySelector('#card-tile-icon-status');
    if (iconStatus) iconStatus.textContent = tile.iconMedia ? 'Icon picture selected.' : 'No icon picture selected.';
    refreshDialogVisibility();
  }

  function refreshDialogVisibility() {
    const tile = selectedTile();
    if (!tile) return;
    document.querySelector('#card-feature-control').hidden = tile.tileKind !== 'feature';
    document.querySelector('#card-link-controls').hidden = tile.tileKind === 'feature';
    document.querySelector('#card-media-content-controls').hidden = tile.contentMode !== 'media-button';
    document.querySelector('#card-standard-icon-section').hidden = tile.contentMode !== 'standard';
    document.querySelector('#card-icon-media-controls').hidden = tile.contentMode !== 'standard' || tile.iconMode !== 'image';
    document.querySelector('#card-background-media-controls').hidden = tile.backgroundType !== 'media';
  }

  function updateSelected(field, value, renderNow = true) {
    const tile = selectedTile();
    if (!tile) return;
    tile[field] = value;
    if (renderNow) render();
  }

  function bindDialog() {
    state.dialog.querySelector('[data-card-dialog-close]').addEventListener('click', closeDialog);
    state.dialog.addEventListener('close', () => { state.selectedId = null; render(); });
    document.querySelector('#card-tile-size').addEventListener('change', event => {
      const tile = selectedTile();
      if (!tile) return;
      const [width, height] = event.target.value.split('x').map(Number);
      const candidate = { x: tile.x, y: tile.y, width, height };
      if (!validPlacement(candidate, tile.tileId)) {
        event.target.value = `${tile.width}x${tile.height}`;
        return editorMessage('That size overlaps another card tile or leaves the mini-grid.', 'error');
      }
      Object.assign(tile, candidate);
      render();
    });
    state.dialog.querySelectorAll('[data-card-move]').forEach(button => button.addEventListener('click', () => {
      const tile = selectedTile();
      if (!tile) return;
      const [dx, dy] = button.dataset.cardMove.split(',').map(Number);
      const candidate = { x: tile.x + dx, y: tile.y + dy, width: tile.width, height: tile.height };
      if (!validPlacement(candidate, tile.tileId)) return editorMessage('That direction is blocked.', 'error');
      Object.assign(tile, candidate);
      render();
    }));
    document.querySelector('#card-tile-kind').addEventListener('change', event => {
      const tile = selectedTile();
      if (!tile) return;
      tile.tileKind = event.target.value;
      if (tile.tileKind === 'feature') {
        tile.featureId = tile.featureId || state.catalogue[0]?.id || null;
        tile.feature = state.catalogue.find(feature => feature.id === tile.featureId) || null;
        tile.linkUrl = null;
      } else {
        tile.featureId = null;
        tile.feature = null;
      }
      refreshDialogVisibility();
      render();
    });
    document.querySelector('#card-tile-content-mode').addEventListener('change', event => {
      updateSelected('contentMode', event.target.value, false);
      refreshDialogVisibility();
      render();
    });
    document.querySelector('#card-tile-feature').addEventListener('change', event => {
      const tile = selectedTile();
      if (!tile) return;
      tile.featureId = event.target.value;
      tile.feature = state.catalogue.find(feature => feature.id === tile.featureId) || null;
      render();
    });
    const bindings = [
      ['#card-tile-title', 'title'], ['#card-tile-description', 'description'], ['#card-tile-link-label', 'linkLabel'], ['#card-tile-link-url', 'linkUrl'],
      ['#card-tile-custom-title', 'customTitle'], ['#card-tile-custom-icon', 'customIcon'], ['#card-tile-icon-label', 'iconLabel'],
      ['#card-tile-icon-text', 'iconTextColour'], ['#card-tile-icon-background', 'iconBackgroundColour'], ['#card-tile-icon-border', 'iconBorderColour'],
      ['#card-tile-primary', 'backgroundPrimary'], ['#card-tile-secondary', 'backgroundSecondary'], ['#card-tile-text', 'textColour'], ['#card-tile-border', 'borderColour']
    ];
    bindings.forEach(([selector, field]) => document.querySelector(selector).addEventListener('input', event => updateSelected(field, event.target.value || null)));
    [['#card-tile-icon-mode', 'iconMode'], ['#card-tile-icon-fit', 'iconMediaFit'], ['#card-tile-background-type', 'backgroundType'], ['#card-tile-media-fit', 'mediaFit'], ['#card-tile-overlay', 'mediaOverlay'], ['#card-tile-font', 'fontFamily']]
      .forEach(([selector, field]) => document.querySelector(selector).addEventListener('change', event => {
        updateSelected(field, event.target.value, false);
        refreshDialogVisibility();
        render();
      }));
    document.querySelector('#card-tile-angle').addEventListener('input', event => {
      updateSelected('backgroundAngle', Number(event.target.value), false);
      document.querySelector('#card-tile-angle-output').textContent = `${event.target.value}°`;
      render();
    });
    document.querySelector('#card-tile-background-media').addEventListener('change', event => loadFile(event.target.files?.[0], 'backgroundMedia', 'background'));
    document.querySelector('#card-tile-icon-media').addEventListener('change', event => loadFile(event.target.files?.[0], 'iconMedia', 'icon'));
    document.querySelector('#card-tile-remove-background').addEventListener('click', () => {
      updateSelected('backgroundMedia', null, false);
      document.querySelector('#card-tile-background-status').textContent = 'No background picture selected.';
      render();
    });
    document.querySelector('#card-tile-remove-icon').addEventListener('click', () => {
      updateSelected('iconMedia', null, false);
      document.querySelector('#card-tile-icon-status').textContent = 'No icon picture selected.';
      render();
    });
    document.querySelector('#card-tile-remove').addEventListener('click', () => {
      const id = state.selectedId;
      state.working = state.working.filter(tile => tile.tileId !== id).map((tile, index) => ({ ...tile, position: index }));
      state.selectedId = null;
      closeDialog();
      render();
    });
  }

  function loadFile(file, field, slot) {
    if (!file) return;
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowed.has(file.type) || file.size > MAX_FILE_BYTES) return editorMessage('Choose a PNG, JPEG, WebP or animated GIF no larger than 1.4 MB.', 'error');
    const tile = selectedTile();
    if (!tile) return;
    const key = `${tile.tileId}:${slot}`;
    state.pendingUploads.add(key);
    const reader = new FileReader();
    reader.onload = () => {
      const current = tileById(tile.tileId);
      if (current) current[field] = String(reader.result || '');
      state.pendingUploads.delete(key);
      const status = document.querySelector(slot === 'background' ? '#card-tile-background-status' : '#card-tile-icon-status');
      if (status) status.textContent = `${file.name} selected.`;
      render();
    };
    reader.onerror = () => {
      state.pendingUploads.delete(key);
      editorMessage('The selected picture could not be loaded.', 'error');
    };
    reader.readAsDataURL(file);
  }

  const originalApply = window.GrevProfileCard?.apply?.bind(window.GrevProfileCard);
  if (originalApply) {
    window.GrevProfileCard.apply = (root, profile) => {
      originalApply(root, profile);
      state.profile = profile;
      state.root = root;
      if (!state.editing) {
        state.saved = clone(profile.cardTiles || []);
        state.working = clone(state.saved);
      }
      render();
    };
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET')).toUpperCase();
    if (method === 'PUT' && new URL(url, location.origin).pathname === '/api/profile' && state.editing) {
      let body;
      try { body = JSON.parse(String(init.body || '{}')); } catch { body = {}; }
      body.cardTiles = serializableTiles();
      const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
      headers.set('Content-Type', 'application/json');
      const response = await nativeFetch(input, { ...init, headers, body: JSON.stringify(body) });
      if (response.ok) {
        try {
          const payload = await response.clone().json();
          if (payload.profile) {
            state.profile = payload.profile;
            state.saved = clone(payload.profile.cardTiles || state.working);
            state.working = clone(state.saved);
          }
        } catch {}
        state.editing = false;
        state.selectedId = null;
        if (state.editor) state.editor.hidden = true;
        closeDialog();
        render();
      }
      return response;
    }
    return nativeFetch(input, init);
  };

  function initialise() {
    injectEditor();
    injectDialog();
    const edit = document.querySelector('#profile-edit');
    const cancel = document.querySelector('#profile-cancel');
    const save = document.querySelector('#profile-save');
    edit?.addEventListener('click', async () => {
      state.editing = true;
      state.working = clone(state.saved);
      state.editor.hidden = false;
      try {
        await loadCatalogue();
        editorMessage('Add up to four mini tiles, then save them with the rest of the profile.');
      } catch (error) {
        editorMessage(error.message || 'Unable to load site tiles.', 'error');
      }
      render();
    });
    cancel?.addEventListener('click', () => {
      state.editing = false;
      state.selectedId = null;
      state.working = clone(state.saved);
      state.editor.hidden = true;
      closeDialog();
      render();
    });
    save?.addEventListener('click', event => {
      if (!state.editing) return;
      const problem = validate();
      if (!problem) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      editorMessage(problem, 'error');
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
