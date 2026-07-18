import fs from 'node:fs';

let css = fs.readFileSync('public/dashboard.css', 'utf8');
const previewBefore = '.dashboard-placement-preview{position:relative;z-index:1;';
const previewAfter = '.dashboard-placement-preview{position:relative;z-index:5;';
if (!css.includes(previewBefore)) throw new Error('Placement preview z-index anchor not found.');
css = css.replace(previewBefore, previewAfter);
fs.writeFileSync('public/dashboard.css', css);

let js = fs.readFileSync('public/dashboard.js', 'utf8');
const before = `  const move = pointerEvent => updateResizePreview(pointerEvent);
  const end = pointerEvent => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    finishTileResize(pointerEvent);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);`;
const after = `  const move = pointerEvent => updateResizePreview(pointerEvent);
  const removeListeners = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
  };
  const end = pointerEvent => {
    removeListeners();
    finishTileResize(pointerEvent);
  };
  const cancel = pointerEvent => {
    if (!dashboardState.resizing || pointerEvent.pointerId !== dashboardState.resizing.pointerId) return;
    removeListeners();
    dashboardState.resizing = null;
    clearPlacementPreview();
    renderEditor();
    editorMessage('Resize cancelled. The tile returned to its previous size.');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', cancel);`;
if (!js.includes(before)) throw new Error('Pointer resize cleanup anchor not found.');
js = js.replace(before, after);
fs.writeFileSync('public/dashboard.js', js);
