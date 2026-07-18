import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let source = fs.readFileSync('public/dashboard.js', 'utf8');
const before = `  if (editing) {
    const strip = document.createElement('div');
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
    handle.textContent = isSingleColumnFallback() ? 'MOVE ON DESKTOP' : 'MOVE';
    handle.title = isSingleColumnFallback() ? 'Open this editor on a wider screen to drag tiles' : \`Drag \${feature.name}\`;
    handle.disabled = isSingleColumnFallback();
    handle.draggable = !isSingleColumnFallback();
    handle.addEventListener('click', () => selectTile(feature.id));
    handle.addEventListener('dragstart', event => {
      if (isSingleColumnFallback()) {
        event.preventDefault();
        return;
      }
      dashboardState.draggingId = feature.id;
      dashboardState.selectedId = feature.id;
      article.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', feature.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      renderSelectedControls();
    });
    handle.addEventListener('dragend', () => {
      dashboardState.draggingId = null;
      article.classList.remove('dragging');
    });
    strip.append(select, handle);
    article.append(strip);
  }`;

const after = `  if (editing) {
    const strip = document.createElement('div');
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
    article.append(strip);

    const resize = document.createElement('button');
    resize.type = 'button';
    resize.className = 'dashboard-tile-resize';
    resize.textContent = '↘';
    resize.setAttribute('aria-label', \`Drag to resize \${feature.name}\`);
    resize.title = isSingleColumnFallback() ? 'Use the Size menu on narrow screens' : \`Drag the corner to resize \${feature.name}\`;
    resize.disabled = isSingleColumnFallback();
    resize.addEventListener('pointerdown', event => beginTileResize(event, feature.id));
    article.append(resize);
  }`;

source = replaceOnce(source, before, after, 'tile controls');
source = replaceOnce(source,
`  grid.className = \`dashboard-tile-grid dashboard-grid \${preferences.density}\${dashboardState.editing ? ' editing-grid' : ''}\`;
  grid.replaceChildren();`,
`  grid.className = \`dashboard-tile-grid dashboard-grid \${preferences.density}\${dashboardState.editing ? ' editing-grid' : ''}\`;
  clearPlacementPreview();
  grid.replaceChildren();`,
'preview cleanup');
source = replaceOnce(source,
`function closeEditor(saved = false) {
  dashboardState.editing = false;`,
`function closeEditor(saved = false) {
  clearPlacementPreview();
  dashboardState.draggingId = null;
  dashboardState.resizing = null;
  dashboardState.editing = false;`,
'editor cleanup');
fs.writeFileSync('public/dashboard.js', source);
