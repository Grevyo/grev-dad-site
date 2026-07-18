import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Patch anchor not found: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

const jsPath = 'public/dashboard.js';
let js = fs.readFileSync(jsPath, 'utf8');

js = replaceOnce(js,
`const dashboardElement = selector => document.querySelector(selector);\n`,
`const dashboardElement = selector => document.querySelector(selector);\n\nfunction isSingleColumnFallback() {\n  return window.matchMedia?.('(max-width: 900px)').matches ?? false;\n}\n`,
'mobile fallback helper');

js = replaceOnce(js,
`  if (editing) {\n    article.tabIndex = 0;\n    article.setAttribute('aria-label', \`${'${feature.name}'}, ${'${feature.width}'} by ${'${feature.height}'} tile\`);\n    article.addEventListener('click', event => {\n      if (event.target.closest('.dashboard-tile-move')) return;\n      selectTile(feature.id);\n    });\n    article.addEventListener('keydown', event => {\n      if (event.key === 'Enter' || event.key === ' ') {\n        event.preventDefault();\n        selectTile(feature.id);\n      }\n    });\n\n    const handle = document.createElement('button');\n    handle.type = 'button';\n    handle.className = 'dashboard-tile-move';\n    handle.textContent = 'MOVE';\n    handle.title = \`Drag ${'${feature.name}'}\`;\n    handle.draggable = true;\n    handle.addEventListener('click', event => {\n      event.stopPropagation();\n      selectTile(feature.id);\n    });\n    handle.addEventListener('dragstart', event => {\n      dashboardState.draggingId = feature.id;\n      dashboardState.selectedId = feature.id;\n      article.classList.add('dragging');\n      event.dataTransfer?.setData('text/plain', feature.id);\n      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';\n      renderSelectedControls();\n    });\n    handle.addEventListener('dragend', () => {\n      dashboardState.draggingId = null;\n      article.classList.remove('dragging');\n    });\n    article.append(handle);\n  }\n`,
`  if (editing) {\n    const strip = document.createElement('div');\n    strip.className = 'dashboard-tile-edit-strip';\n\n    const select = document.createElement('button');\n    select.type = 'button';\n    select.className = 'dashboard-tile-select';\n    select.textContent = 'SELECT';\n    select.setAttribute('aria-label', \`Select ${'${feature.name}'} tile for editing\`);\n    select.setAttribute('aria-pressed', String(dashboardState.selectedId === feature.id));\n    select.addEventListener('click', () => selectTile(feature.id));\n\n    const handle = document.createElement('button');\n    handle.type = 'button';\n    handle.className = 'dashboard-tile-move';\n    handle.textContent = isSingleColumnFallback() ? 'MOVE ON DESKTOP' : 'MOVE';\n    handle.title = isSingleColumnFallback() ? 'Open this editor on a wider screen to drag tiles' : \`Drag ${'${feature.name}'}\`;\n    handle.disabled = isSingleColumnFallback();\n    handle.draggable = !isSingleColumnFallback();\n    handle.addEventListener('click', () => selectTile(feature.id));\n    handle.addEventListener('dragstart', event => {\n      if (isSingleColumnFallback()) {\n        event.preventDefault();\n        return;\n      }\n      dashboardState.draggingId = feature.id;\n      dashboardState.selectedId = feature.id;\n      article.classList.add('dragging');\n      event.dataTransfer?.setData('text/plain', feature.id);\n      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';\n      renderSelectedControls();\n    });\n    handle.addEventListener('dragend', () => {\n      dashboardState.draggingId = null;\n      article.classList.remove('dragging');\n    });\n    strip.append(select, handle);\n    article.append(strip);\n  }\n`,
'accessible edit strip');

js = replaceOnce(js,
`  const tiles = dashboardState.editing\n    ? dashboardState.workingTiles.map(tile => {\n        const feature = featureById(tile.featureId);\n        return feature ? { ...feature, ...tile, id: feature.id, dimension: dimensionKey(tile.width, tile.height) } : null;\n      }).filter(Boolean)\n    : dashboardState.payload.pinnedTiles;\n`,
`  let tiles = dashboardState.editing\n    ? dashboardState.workingTiles.map(tile => {\n        const feature = featureById(tile.featureId);\n        return feature ? { ...feature, ...tile, id: feature.id, dimension: dimensionKey(tile.width, tile.height) } : null;\n      }).filter(Boolean)\n    : dashboardState.payload.pinnedTiles;\n  if (dashboardState.editing && isSingleColumnFallback()) {\n    tiles = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);\n  }\n`,
'mobile coordinate render order');

js = replaceOnce(js,
`  feature.allowedDimensions.forEach(value => {\n    const option = document.createElement('option');\n    option.value = value;\n    option.textContent = value.replace('x', ' × ');\n    option.selected = dimensionKey(tile.width, tile.height) === value;\n    size.append(option);\n  });\n}\n`,
`  feature.allowedDimensions.forEach(value => {\n    const option = document.createElement('option');\n    option.value = value;\n    option.textContent = value.replace('x', ' × ');\n    option.selected = dimensionKey(tile.width, tile.height) === value;\n    size.append(option);\n  });\n  document.querySelectorAll('[data-move-x][data-move-y]').forEach(button => {\n    const horizontal = Number(button.dataset.moveX) !== 0;\n    button.disabled = isSingleColumnFallback() && horizontal;\n    button.title = button.disabled ? 'Horizontal placement requires a wider screen' : button.title;\n  });\n}\n`,
'disable misleading mobile movement');

js = replaceOnce(js,
`function moveWorkingTile(featureId, deltaX, deltaY) {\n  const tile = workingTile(featureId);\n  if (!tile) return;\n`,
`function moveWorkingTile(featureId, deltaX, deltaY) {\n  const tile = workingTile(featureId);\n  if (!tile) return;\n  if (isSingleColumnFallback() && deltaX !== 0) {\n    editorMessage('Horizontal tile placement is available on screens wider than 900px. Vertical order still follows the saved row coordinates.', 'error');\n    return;\n  }\n`,
'mobile movement guard');

js = replaceOnce(js,
`  editorMessage('Select a tile, drag its MOVE strip, or change its preset size. The dashboard updates immediately.');\n`,
`  editorMessage(isSingleColumnFallback()\n    ? 'Single-column preview: select tiles, resize them, and change vertical order. Use a wider screen for exact column placement and dragging.'\n    : 'Select a tile, drag its MOVE strip, or change its preset size. The dashboard updates immediately.');\n`,
'mobile editor guidance');

js = replaceOnce(js,
`dashboardGrid?.addEventListener('dragover', event => {\n  if (!dashboardState.editing) return;\n`,
`dashboardGrid?.addEventListener('dragover', event => {\n  if (!dashboardState.editing || isSingleColumnFallback()) return;\n`,
'mobile dragover guard');

js = replaceOnce(js,
`dashboardGrid?.addEventListener('drop', event => {\n  if (!dashboardState.editing) return;\n`,
`dashboardGrid?.addEventListener('drop', event => {\n  if (!dashboardState.editing || isSingleColumnFallback()) return;\n`,
'mobile drop guard');

js = replaceOnce(js,
`document.addEventListener('keydown', event => {\n  if (event.key === 'Escape' && dashboardState.editing) closeEditor(false);\n});\n\nloadDashboardSystem();\n`,
`document.addEventListener('keydown', event => {\n  if (event.key === 'Escape' && dashboardState.editing) closeEditor(false);\n});\nwindow.addEventListener('resize', () => {\n  if (!dashboardState.editing) return;\n  renderEditor();\n  editorMessage(isSingleColumnFallback()\n    ? 'Single-column preview: the visual order follows saved row and column coordinates. Exact horizontal placement requires a wider screen.'\n    : 'Wide-grid editing restored. Drag tiles or move them one cell at a time.');\n});\n\nloadDashboardSystem();\n`,
'responsive editor rerender');

fs.writeFileSync(jsPath, js);

const cssPath = 'public/dashboard.css';
let css = fs.readFileSync(cssPath, 'utf8');
css = replaceOnce(css,
`.dashboard-tile-move{min-height:25px!important;padding:4px 7px!important;border:0!important;border-bottom:1px solid #435066!important;background:#1d2633!important;color:#dce7ff!important;font-size:.62rem!important;letter-spacing:.12em!important;cursor:grab!important;transform:none!important;box-shadow:none!important}\n.dashboard-tile.editing .dashboard-tile-content{height:calc(100% - 25px)}\n`,
`.dashboard-tile-edit-strip{display:grid;grid-template-columns:1fr 1fr;min-height:24px;border-bottom:1px solid #435066;background:#1d2633}\n.dashboard-tile-select,.dashboard-tile-move{min-height:24px!important;padding:3px 7px!important;border:0!important;background:#1d2633!important;color:#dce7ff!important;font-size:.6rem!important;letter-spacing:.1em!important;transform:none!important;box-shadow:none!important}\n.dashboard-tile-select{border-right:1px solid #435066!important;cursor:pointer!important}\n.dashboard-tile-select[aria-pressed="true"]{background:#e7edf8!important;color:#080b0f!important}\n.dashboard-tile-move{cursor:grab!important}\n.dashboard-tile-move:disabled{cursor:not-allowed!important;color:#778291!important;background:#151b23!important}\n.dashboard-tile.editing .dashboard-tile-content{height:calc(100% - 24px)}\n.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] .dashboard-tile-edit-strip{min-height:20px}\n.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] .dashboard-tile-content{height:calc(100% - 20px);grid-template-columns:minmax(0,1fr) auto;grid-template-rows:1fr;column-gap:6px;padding:4px 6px}\n.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] .dashboard-tile-body,.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] .dashboard-tile-meta,.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] .dashboard-tile-icon,.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] .dashboard-access-label{display:none}\n.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] .dashboard-tile-head,.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] .dashboard-tile-footer{align-self:center;margin:0}\n.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] h2{margin:0;font-size:.82rem;line-height:1.05}\n.dashboard-grid.compact .dashboard-tile.editing[data-height="1"] .dashboard-feature-action{min-height:22px;padding:2px 5px;font-size:.58rem}\n`,
'accessible strip and compact tile CSS');

css = replaceOnce(css,
`  .dashboard-grid-cell{display:none}\n`,
`  .dashboard-grid-cell{display:none}\n  .dashboard-tile-edit-strip{grid-template-columns:1fr}\n  .dashboard-tile-move{display:none}\n`,
'mobile edit strip CSS');

fs.writeFileSync(cssPath, css);
console.log('Applied inline dashboard review fixes.');
