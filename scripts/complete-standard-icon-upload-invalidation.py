from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return source.replace(before, after, 1)


path = Path('public/dashboard.js')
source = path.read_text()
source = replace_once(
    source,
    '''function loadDefaultWorkingTiles() {
  const defaults = (dashboardState.payload?.features ?? [])''',
    '''function loadDefaultWorkingTiles() {
  dashboardState.iconUploads.clear();
  const defaults = (dashboardState.payload?.features ?? [])''',
    'clear uploads when loading defaults',
)
source = replace_once(
    source,
    '''dashboardElement('#dashboard-icon-media')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const file = event.currentTarget.files?.[0];
  if (!tile || !file) return;''',
    '''dashboardElement('#dashboard-icon-media')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  cancelIconUpload(tile.featureId);
  const file = event.currentTarget.files?.[0];
  if (!file) return;''',
    'cancel previous upload before validating new file',
)
source = replace_once(
    source,
    '''dashboardElement('#dashboard-reset-appearance')?.addEventListener('click', () => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  Object.assign(tile, DEFAULT_TILE_APPEARANCE);''',
    '''dashboardElement('#dashboard-reset-appearance')?.addEventListener('click', () => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  cancelIconUpload(tile.featureId);
  Object.assign(tile, DEFAULT_TILE_APPEARANCE);''',
    'cancel upload during full appearance reset',
)
path.write_text(source)
print('All standard icon upload replacement/reset paths invalidate stale reads.')
