import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

let source = fs.readFileSync('public/dashboard.css', 'utf8');
source = replaceOnce(source,
`  display:grid;position:relative;gap:var(--dashboard-gap);padding:var(--dashboard-margin);margin-top:24px;min-height:120px;box-sizing:border-box`,
`  display:grid;position:relative;grid-auto-rows:var(--tile-row-height);gap:var(--dashboard-gap);padding:var(--dashboard-margin);margin-top:24px;min-height:120px;box-sizing:border-box`,
'grid rows');

source = replaceOnce(source,
`.dashboard-grid-cell{z-index:0;border:1px dashed #29323e;background:#0d1117;pointer-events:none}
.dashboard-tile.editing{border-color:#64728a;box-shadow:4px 4px 0 #030508;cursor:pointer}`,
`.dashboard-grid-cell{z-index:0;border:1px dashed #29323e;background:#0d1117;pointer-events:none}
.dashboard-placement-preview{position:relative;z-index:1;display:grid;place-items:center;min-width:0;min-height:0;border:2px solid #8cb4ff;background:rgba(77,126,214,.22);box-shadow:inset 0 0 0 2px rgba(10,14,20,.7);pointer-events:none}
.dashboard-placement-preview::after{content:attr(data-label);padding:6px 8px;border:1px solid currentColor;background:#090d13;color:#dce9ff;font-size:.67rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}
.dashboard-placement-preview.invalid{border-color:#ff6677;background:rgba(160,35,54,.3)}
.dashboard-placement-preview.invalid::after{color:#ff9aaa}
.dashboard-tile.editing{border-color:#64728a;box-shadow:4px 4px 0 #030508;cursor:pointer}`,
'placement preview');

source = replaceOnce(source,
`.dashboard-tile.editing.dragging{opacity:.45}
.dashboard-tile-edit-strip`,
`.dashboard-tile.editing.dragging{opacity:.45}
.dashboard-tile.editing.resizing{opacity:.78}
.dashboard-tile.editing.resize-blocked{border-color:#ff6677;box-shadow:0 0 0 2px rgba(255,102,119,.45),6px 6px 0 #030508}
.dashboard-tile-edit-strip`,
'resize states');

source = replaceOnce(source,
`.dashboard-tile-move:disabled{cursor:not-allowed!important;color:#778291!important;background:#151b23!important}
.dashboard-tile.editing .dashboard-tile-content`,
`.dashboard-tile-move:disabled{cursor:not-allowed!important;color:#778291!important;background:#151b23!important}
.dashboard-tile-resize{position:absolute;right:0;bottom:0;z-index:8;display:grid;place-items:center;width:30px;height:30px;padding:0!important;border:1px solid #7586a2!important;border-right:0!important;border-bottom:0!important;border-radius:0!important;background:#202b3a!important;color:#edf3ff!important;font-size:1rem!important;font-weight:950!important;line-height:1!important;cursor:nwse-resize!important;transform:none!important;box-shadow:none!important;touch-action:none}
.dashboard-tile-resize:hover,.dashboard-tile-resize:focus-visible{background:#edf3ff!important;color:#090d13!important}
.dashboard-tile-resize:disabled{display:none}
.dashboard-tile.editing .dashboard-tile-content`,
'resize grip');

source = replaceOnce(source,
`  .dashboard-tile-move{display:none}
  .dashboard-tile[data-height="1"]`,
`  .dashboard-tile-move,.dashboard-tile-resize{display:none}
  .dashboard-tile[data-height="1"]`,
'mobile fallback');

fs.writeFileSync('public/dashboard.css', source);
