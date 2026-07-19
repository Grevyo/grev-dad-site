from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return source.replace(before, after, 1)


js_path = Path('public/dashboard.js')
js = js_path.read_text()
js = replace_once(
    js,
    '''  tile.contentMode = value;
  if (value === 'media-button' && tile.iconMode === 'image' && !tile.iconMedia) tile.iconMode = 'text';
  if (value === 'media-button') {
    tile.backgroundType = 'media';''',
    '''  tile.contentMode = value;
  if (value === 'media-button') {
    tile.iconMode = 'text';
    tile.iconMedia = null;
    const iconInput = dashboardElement('#dashboard-icon-media');
    if (iconInput) iconInput.value = '';
    tile.backgroundType = 'media';''',
    'discard standard icon image when entering custom media mode',
)
js_path.write_text(js)

ts_path = Path('src/dashboard.ts')
ts = ts_path.read_text()
ts = replace_once(
    ts,
    '''  if (submittedIconMedia && !validImageDataUrl(submittedIconMedia)) return null;
  const iconMedia = iconMode === 'image' ? submittedIconMedia : null;
  if (backgroundType === 'media' && !backgroundMediaValue) return null;
  if (contentMode === 'media-button' && (backgroundType !== 'media' || !backgroundMediaValue)) return null;
  if (iconMode === 'image' && !iconMedia) return null;
  return { backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: backgroundMediaValue, textColour, fontFamily, borderColour, contentMode, customTitle, customIcon, mediaFit, mediaOverlay, iconMode, iconLabel, iconMedia, iconTextColour, iconBackgroundColour, iconBorderColour, iconMediaFit };''',
    '''  if (submittedIconMedia && !validImageDataUrl(submittedIconMedia)) return null;
  const activeIconMode: TileIconMode = contentMode === 'standard' ? iconMode : 'text';
  const iconMedia = activeIconMode === 'image' ? submittedIconMedia : null;
  if (backgroundType === 'media' && !backgroundMediaValue) return null;
  if (contentMode === 'media-button' && (backgroundType !== 'media' || !backgroundMediaValue)) return null;
  if (activeIconMode === 'image' && !iconMedia) return null;
  return { backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: backgroundMediaValue, textColour, fontFamily, borderColour, contentMode, customTitle, customIcon, mediaFit, mediaOverlay, iconMode: activeIconMode, iconLabel, iconMedia, iconTextColour, iconBackgroundColour, iconBorderColour, iconMediaFit };''',
    'server-side custom mode icon cleanup',
)
ts_path.write_text(ts)

print('Custom media mode now discards standard icon media.')
