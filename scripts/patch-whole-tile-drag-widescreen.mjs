import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before === after) throw new Error(`No changes produced for ${path}`);
  fs.writeFileSync(path, after);
}

patch('public/dashboard.html', source => {
  source = replaceOnce(source,
    '<div><p class="eyebrow">Live dashboard editor</p><h2>Edit directly on your dashboard</h2><p>Drag the top strip to move a tile and drag its bottom-right corner to resize it. The highlighted footprint shows exactly where it will land. Nothing is stored until you press Save dashboard.</p></div>',
    '<div><p class="eyebrow">Live dashboard editor</p><h2>Edit directly on your dashboard</h2><p>Grab and drag the tile itself to move it. Use Tile settings for exact size, colour and position controls, or drag the bottom-right corner to resize. Nothing is stored until you press Save dashboard.</p></div>',
    'editor help text');
  source = replaceOnce(source,
    '<div id="dashboard-selected-controls" class="dashboard-selected-controls" hidden>\n<div class="dashboard-selected-identity"><small>Selected tile</small><strong id="dashboard-selected-name">—</strong></div>\n<label>Size<select id="dashboard-selected-dimension"></select></label>\n<label>Colour<select id="dashboard-selected-colour"><option value="default">Default charcoal</option><option value="graphite">Graphite</option><option value="blue">Blue</option><option value="cyan">Cyan</option><option value="green">Green</option><option value="amber">Amber</option><option value="red">Red</option><option value="purple">Purple</option><option value="pink">Pink</option></select></label>\n<div class="dashboard-selected-arrows" aria-label="Move selected tile"><button type="button" data-move-x="-1" data-move-y="0" title="Move left">←</button><button type="button" data-move-x="0" data-move-y="-1" title="Move up">↑</button><button type="button" data-move-x="0" data-move-y="1" title="Move down">↓</button><button type="button" data-move-x="1" data-move-y="0" title="Move right">→</button></div>\n<button id="dashboard-remove-selected" class="danger-action" type="button">Remove tile</button>\n</div>',
    '<dialog id="dashboard-tile-settings-dialog" class="dashboard-tile-settings-dialog" aria-labelledby="dashboard-tile-settings-title">\n<div class="dashboard-tile-settings-heading"><div><p class="eyebrow">Tile settings</p><h2 id="dashboard-tile-settings-title">Configure tile</h2></div><button id="dashboard-close-tile-settings" type="button" aria-label="Close tile settings">Close</button></div>\n<div id="dashboard-selected-controls" class="dashboard-selected-controls" hidden>\n<div class="dashboard-selected-identity"><small>Selected tile</small><strong id="dashboard-selected-name">—</strong></div>\n<label>Size<select id="dashboard-selected-dimension"></select></label>\n<label>Colour<select id="dashboard-selected-colour"><option value="default">Default charcoal</option><option value="graphite">Graphite</option><option value="blue">Blue</option><option value="cyan">Cyan</option><option value="green">Green</option><option value="amber">Amber</option><option value="red">Red</option><option value="purple">Purple</option><option value="pink">Pink</option></select></label>\n<div class="dashboard-selected-arrows" aria-label="Move selected tile"><button type="button" data-move-x="-1" data-move-y="0" title="Move left">←</button><button type="button" data-move-x="0" data-move-y="-1" title="Move up">↑</button><button type="button" data-move-x="0" data-move-y="1" title="Move down">↓</button><button type="button" data-move-x="1" data-move-y="0" title="Move right">→</button></div>\n<button id="dashboard-remove-selected" class="danger-action" type="button">Remove tile</button>\n</div>\n</dialog>',
    'tile settings dialog');
  source = replaceOnce(source,
    '<div id="dashboard-grid-heading" class="dashboard-grid-heading" hidden><div><strong>Live grid</strong><span>Drag the top strip to move. Drag the bottom-right corner to resize. The highlighted footprint shows valid or blocked cells.</span></div><strong id="dashboard-grid-summary">6 columns</strong></div>',
    '<div id="dashboard-grid-heading" class="dashboard-grid-heading" hidden><div><strong>Live grid</strong><span>Grab the whole tile to move it. Use Tile settings for exact controls. Drag the bottom-right corner to resize.</span></div><strong id="dashboard-grid-summary">6 columns</strong></div>',
    'grid help text');
  return source;
});

patch('public/dashboard.js', source => {
  source = replaceOnce(source,
`    const strip = document.createElement('div');
    strip.className = 'dashboard-tile-edit-strip';

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'dashboard-tile-select';
    select.textContent = 'SELECT';
    select.setAttribute('aria-label', \`Select \${feature.name} tile for editing\`);
    select.setAttribute('aria-pressed', String(dashboardState.selectedId === feature.id));
    select.addEventListener('click', () => selectTile(feature.id));

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'dashboard-tile-move';
    handle.textContent = isSingleColumnFallback() ? 'MOVE ON DESKTOP' : 'DRAG TO MOVE';
    handle.title = isSingleColumnFallback() ? 'Open this editor on a wider screen to drag tiles' : \`Drag \${feature.name} to another grid position\`;
    handle.disabled = isSingleColumnFallback();
    handle.draggable = !isSingleColumnFallback();
    handle.addEventListener('click', () => selectTile(feature.id));
    handle.addEventListener('dragstart', event => {
      if (isSingleColumnFallback()) {
        event.preventDefault();
        return;
      }
      const tile = workingTile(feature.id);
      dashboardState.draggingId = feature.id;
      dashboardState.selectedId = feature.id;
      article.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', feature.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      if (tile) showPlacementPreview(tile, true, 'CURRENT POSITION');
      renderSelectedControls();
    });
    handle.addEventListener('dragend', () => {
      dashboardState.draggingId = null;
      article.classList.remove('dragging');
      clearPlacementPreview();
    });
    strip.append(select, handle);
    article.append(strip);`,
`    const strip = document.createElement('div');
    strip.className = 'dashboard-tile-edit-strip';

    const settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'dashboard-tile-settings';
    settings.textContent = 'TILE SETTINGS';
    settings.setAttribute('aria-label', \`Open settings for \${feature.name}\`);
    settings.addEventListener('pointerdown', event => event.stopPropagation());
    settings.addEventListener('dragstart', event => event.preventDefault());
    settings.addEventListener('click', event => {
      event.stopPropagation();
      openTileSettings(feature.id);
    });
    strip.append(settings);
    article.append(strip);

    article.draggable = !isSingleColumnFallback();
    article.title = isSingleColumnFallback() ? 'Exact tile dragging requires a wider screen' : \`Drag \${feature.name} to another grid position\`;
    article.addEventListener('dragstart', event => {
      if (isSingleColumnFallback() || event.target.closest('button,select,input,a')) {
        event.preventDefault();
        return;
      }
      const tile = workingTile(feature.id);
      dashboardState.draggingId = feature.id;
      dashboardState.selectedId = feature.id;
      article.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', feature.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      if (tile) showPlacementPreview(tile, true, 'CURRENT POSITION');
      renderSelectedControls();
    });
    article.addEventListener('dragend', () => {
      dashboardState.draggingId = null;
      article.classList.remove('dragging');
      clearPlacementPreview();
    });`,
    'whole tile drag controls');
  source = replaceOnce(source,
`function selectTile(featureId) {
  if (!dashboardState.editing || !workingTile(featureId)) return;
  dashboardState.selectedId = featureId;
  renderSelectedControls();
  renderDashboardGrid();
}
`,
`function selectTile(featureId) {
  if (!dashboardState.editing || !workingTile(featureId)) return;
  dashboardState.selectedId = featureId;
  renderSelectedControls();
  renderDashboardGrid();
}

function openTileSettings(featureId) {
  selectTile(featureId);
  const dialog = dashboardElement('#dashboard-tile-settings-dialog');
  if (!dialog) return;
  if (!dialog.open) dialog.showModal();
}

function closeTileSettings() {
  const dialog = dashboardElement('#dashboard-tile-settings-dialog');
  if (dialog?.open) dialog.close();
}
`, 'tile settings functions');
  source = replaceOnce(source,
`  editorMessage(isSingleColumnFallback()
    ? 'Single-column preview: select tiles, resize them, and change vertical order. Use a wider screen for exact column placement and dragging.'
    : 'Select a tile, drag its MOVE strip, or change its preset size. The dashboard updates immediately.');`,
`  editorMessage(isSingleColumnFallback()
    ? 'Single-column preview: use Tile settings to resize and change vertical order. Use a wider screen for exact dragging.'
    : 'Grab any tile to move it, use Tile settings for exact controls, or drag its corner to resize.');`, 'editor message');
  source = replaceOnce(source, 'function closeEditor(saved = false) {\n  clearPlacementPreview();', 'function closeEditor(saved = false) {\n  closeTileSettings();\n  clearPlacementPreview();', 'close dialog with editor');
  source = replaceOnce(source, "    button.textContent = pinned ? 'Select tile' : 'Place tile';\n    button.addEventListener('click', () => pinned ? selectTile(feature.id) : addWorkingTile(feature));", "    button.textContent = pinned ? 'Tile settings' : 'Place tile';\n    button.addEventListener('click', () => pinned ? openTileSettings(feature.id) : addWorkingTile(feature));", 'catalogue settings button');
  source = replaceOnce(source,
`dashboardElement('#dashboard-remove-selected')?.addEventListener('click', () => {
  if (dashboardState.selectedId) removeWorkingTile(dashboardState.selectedId);
});`,
`dashboardElement('#dashboard-close-tile-settings')?.addEventListener('click', closeTileSettings);
dashboardElement('#dashboard-tile-settings-dialog')?.addEventListener('click', event => {
  if (event.target === event.currentTarget) closeTileSettings();
});
dashboardElement('#dashboard-remove-selected')?.addEventListener('click', () => {
  if (dashboardState.selectedId) {
    removeWorkingTile(dashboardState.selectedId);
    closeTileSettings();
  }
});`, 'dialog event handlers');
  source = replaceOnce(source,
`document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && dashboardState.editing) closeEditor(false);
});`,
`document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !dashboardState.editing) return;
  if (dashboardElement('#dashboard-tile-settings-dialog')?.open) return;
  closeEditor(false);
});`, 'escape behaviour');
  return source;
});

patch('public/dashboard.css', source => {
  source = replaceOnce(source, '.dashboard-shell{width:min(1480px,calc(100% - 40px));margin:auto;padding:54px 0 90px}', '.dashboard-shell{width:min(calc(100vw - 24px),177.7778vh);max-width:none;margin:auto;padding:54px 0 90px}', 'widescreen dashboard page');
  source = replaceOnce(source, '.dashboard-tile.editing{border-color:#64728a;box-shadow:4px 4px 0 #030508;cursor:pointer}', '.dashboard-tile.editing{border-color:#64728a;box-shadow:4px 4px 0 #030508;cursor:grab}\n.dashboard-tile.editing:active{cursor:grabbing}', 'whole tile drag cursor');
  source = replaceOnce(source,
'.dashboard-tile-edit-strip{display:grid;grid-template-columns:1fr 1fr;min-height:24px;border-bottom:1px solid #435066;background:#1d2633}\n.dashboard-tile-select,.dashboard-tile-move{min-height:24px!important;padding:3px 7px!important;border:0!important;background:#1d2633!important;color:#dce7ff!important;font-size:.6rem!important;letter-spacing:.1em!important;transform:none!important;box-shadow:none!important}\n.dashboard-tile-select{border-right:1px solid #435066!important;cursor:pointer!important}\n.dashboard-tile-select[aria-pressed="true"]{background:#e7edf8!important;color:#080b0f!important}\n.dashboard-tile-move{cursor:grab!important}\n.dashboard-tile-move:disabled{cursor:not-allowed!important;color:#778291!important;background:#151b23!important}',
'.dashboard-tile-edit-strip{display:grid;grid-template-columns:1fr;min-height:24px;border-bottom:1px solid #435066;background:#1d2633}\n.dashboard-tile-settings{min-height:24px!important;padding:3px 7px!important;border:0!important;background:#1d2633!important;color:#dce7ff!important;font-size:.6rem!important;letter-spacing:.1em!important;cursor:pointer!important;transform:none!important;box-shadow:none!important}\n.dashboard-tile-settings:hover,.dashboard-tile-settings:focus-visible{background:#e7edf8!important;color:#080b0f!important}', 'tile settings strip');
  source += `\n.dashboard-tile-settings-dialog{width:min(620px,calc(100vw - 28px));padding:0;border:1px solid var(--line-strong);border-radius:0;background:#0b0f14;color:var(--text);box-shadow:12px 12px 0 #000}\n.dashboard-tile-settings-dialog::backdrop{background:rgba(3,5,8,.72);backdrop-filter:blur(3px)}\n.dashboard-tile-settings-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:20px;border-bottom:1px solid var(--line-strong)}\n.dashboard-tile-settings-heading h2{margin:4px 0 0;font-size:2rem}\n.dashboard-tile-settings-heading button{min-height:38px;padding:8px 12px;border:1px solid var(--line-strong);border-radius:0;background:#171c23;color:var(--text);font-weight:900;cursor:pointer}\n.dashboard-tile-settings-dialog .dashboard-selected-controls{margin:0;padding:20px;border:0;background:transparent}\n@media(max-width:760px){.dashboard-shell{width:calc(100% - 16px)}.dashboard-tile-settings-dialog .dashboard-selected-controls{padding:15px}}\n`;
  return source;
});

console.log('Whole-tile dragging, tile settings dialog and widescreen dashboard patch applied.');
