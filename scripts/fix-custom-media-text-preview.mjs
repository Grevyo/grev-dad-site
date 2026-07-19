import fs from 'node:fs';

const path = 'public/dashboard.js';
let source = fs.readFileSync(path, 'utf8');
const before = `[['#dashboard-custom-title','customTitle',80],['#dashboard-custom-icon','customIcon',12]].forEach(([selector, field, maximum]) => {
  dashboardElement(selector)?.addEventListener('input', event => {
    const tile = workingTile(dashboardState.selectedId);
    if (!tile) return;
    const value = String(event.currentTarget.value).slice(0, Number(maximum)).trim();
    tile[field] = value || null;
    refreshAppearancePreview(tile);
  });
});`;
const after = `[['#dashboard-custom-title','customTitle',80],['#dashboard-custom-icon','customIcon',12]].forEach(([selector, field, maximum]) => {
  dashboardElement(selector)?.addEventListener('input', event => {
    const tile = workingTile(dashboardState.selectedId);
    if (!tile) return;
    const value = String(event.currentTarget.value).slice(0, Number(maximum));
    tile[field] = value || null;
    renderDashboardGrid();
  });
});`;
if (!source.includes(before)) throw new Error('Custom title/icon input handler was not found.');
source = source.replace(before, after);
fs.writeFileSync(path, source);
console.log('Custom title and icon now preview without rebuilding settings controls.');
