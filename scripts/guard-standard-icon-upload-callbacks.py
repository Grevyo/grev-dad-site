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
    '''  resizing: null,
  selectedId: null,
  editing: false''',
    '''  resizing: null,
  selectedId: null,
  iconUploads: new Map(),
  editing: false''',
    'icon upload token state',
)
source = replace_once(
    source,
    '''function workingTile(featureId) {
  return dashboardState.workingTiles.find(tile => tile.featureId === featureId) ?? null;
}

function validHex(value) {''',
    '''function workingTile(featureId) {
  return dashboardState.workingTiles.find(tile => tile.featureId === featureId) ?? null;
}

function cancelIconUpload(featureId) {
  if (featureId) dashboardState.iconUploads.delete(featureId);
}

function validHex(value) {''',
    'icon upload cancellation helper',
)
source = replace_once(
    source,
    '''function removeWorkingTile(featureId) {
  const feature = featureById(featureId);
  dashboardState.workingTiles = dashboardState.workingTiles.filter(tile => tile.featureId !== featureId);''',
    '''function removeWorkingTile(featureId) {
  const feature = featureById(featureId);
  cancelIconUpload(featureId);
  dashboardState.workingTiles = dashboardState.workingTiles.filter(tile => tile.featureId !== featureId);''',
    'cancel upload when removing tile',
)
source = replace_once(
    source,
    '''  dashboardState.editing = true;
  dashboardState.workingTiles = clonePinnedTiles();''',
    '''  dashboardState.editing = true;
  dashboardState.iconUploads.clear();
  dashboardState.workingTiles = clonePinnedTiles();''',
    'clear uploads when opening editor',
)
source = replace_once(
    source,
    '''  dashboardState.resizing = null;
  dashboardState.editing = false;''',
    '''  dashboardState.resizing = null;
  dashboardState.iconUploads.clear();
  dashboardState.editing = false;''',
    'clear uploads when closing editor',
)
source = replace_once(
    source,
    '''  tile.iconMode = value;
  if (value === 'text') {
    tile.iconMedia = null;''',
    '''  tile.iconMode = value;
  if (value === 'text') {
    cancelIconUpload(tile.featureId);
    tile.iconMedia = null;''',
    'cancel upload when selecting letters',
)
source = replace_once(
    source,
    '''  if (value === 'media-button') {
    tile.iconMode = 'text';
    tile.iconMedia = null;''',
    '''  if (value === 'media-button') {
    cancelIconUpload(tile.featureId);
    tile.iconMode = 'text';
    tile.iconMedia = null;''',
    'cancel upload when selecting custom media mode',
)
source = replace_once(
    source,
    '''  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (typeof reader.result !== 'string') return;
    tile.iconMode = 'image';
    tile.iconMedia = reader.result;
    refreshAppearancePreview(tile, file.name + ' selected as the standard tile icon.');
  });
  reader.addEventListener('error', () => editorMessage('The icon picture or GIF could not be read.', 'error'));
  reader.readAsDataURL(file);''',
    '''  const featureId = tile.featureId;
  const uploadToken = Symbol(file.name);
  dashboardState.iconUploads.set(featureId, uploadToken);
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const currentTile = workingTile(featureId);
    if (typeof reader.result !== 'string'
      || !currentTile
      || dashboardState.iconUploads.get(featureId) !== uploadToken
      || currentTile.contentMode !== 'standard'
      || currentTile.iconMode !== 'image') return;
    dashboardState.iconUploads.delete(featureId);
    currentTile.iconMedia = reader.result;
    refreshAppearancePreview(currentTile, file.name + ' selected as the standard tile icon.');
  });
  reader.addEventListener('error', () => {
    if (dashboardState.iconUploads.get(featureId) === uploadToken) dashboardState.iconUploads.delete(featureId);
    editorMessage('The icon picture or GIF could not be read.', 'error');
  });
  reader.readAsDataURL(file);''',
    'guard icon FileReader callback',
)
source = replace_once(
    source,
    '''  if (!tile) return;
  tile.iconMedia = null;
  tile.iconMode = 'text';''',
    '''  if (!tile) return;
  cancelIconUpload(tile.featureId);
  tile.iconMedia = null;
  tile.iconMode = 'text';''',
    'cancel upload when removing icon media',
)
source = replace_once(
    source,
    '''  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  Object.assign(tile, {''',
    '''  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  cancelIconUpload(tile.featureId);
  Object.assign(tile, {''',
    'cancel upload when resetting icon',
)
path.write_text(source)
print('Standard icon upload callbacks are guarded.')
