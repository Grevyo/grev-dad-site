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
    '''  tile.iconMode = value;
  refreshAppearancePreview(tile, value === 'image' ? 'Picture icon selected. Upload a picture before saving.' : 'Letter icon selected.');''',
    '''  tile.iconMode = value;
  if (value === 'text') {
    tile.iconMedia = null;
    const input = dashboardElement('#dashboard-icon-media');
    if (input) input.value = '';
  }
  refreshAppearancePreview(tile, value === 'image' ? 'Picture icon selected. Upload a picture before saving.' : 'Letter icon selected. Any inactive icon picture was removed.');''',
    'clear inactive icon media in editor',
)
js_path.write_text(js)

ts_path = Path('src/dashboard.ts')
ts = ts_path.read_text()
ts = replace_once(
    ts,
    '''  const iconMediaValue = item.iconMedia === null || item.iconMedia === undefined || item.iconMedia === '' ? null : String(item.iconMedia);''',
    '''  const submittedIconMedia = item.iconMedia === null || item.iconMedia === undefined || item.iconMedia === '' ? null : String(item.iconMedia);''',
    'rename submitted icon media',
)
ts = replace_once(
    ts,
    '''  if (iconMediaValue && !validImageDataUrl(iconMediaValue)) return null;
  if (backgroundType === 'media' && !backgroundMediaValue) return null;
  if (contentMode === 'media-button' && (backgroundType !== 'media' || !backgroundMediaValue)) return null;
  if (iconMode === 'image' && !iconMediaValue) return null;
  return { backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: backgroundMediaValue, textColour, fontFamily, borderColour, contentMode, customTitle, customIcon, mediaFit, mediaOverlay, iconMode, iconLabel, iconMedia: iconMediaValue, iconTextColour, iconBackgroundColour, iconBorderColour, iconMediaFit };''',
    '''  if (submittedIconMedia && !validImageDataUrl(submittedIconMedia)) return null;
  const iconMedia = iconMode === 'image' ? submittedIconMedia : null;
  if (backgroundType === 'media' && !backgroundMediaValue) return null;
  if (contentMode === 'media-button' && (backgroundType !== 'media' || !backgroundMediaValue)) return null;
  if (iconMode === 'image' && !iconMedia) return null;
  return { backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: backgroundMediaValue, textColour, fontFamily, borderColour, contentMode, customTitle, customIcon, mediaFit, mediaOverlay, iconMode, iconLabel, iconMedia, iconTextColour, iconBackgroundColour, iconBorderColour, iconMediaFit };''',
    'discard inactive icon media on server',
)
ts_path.write_text(ts)

print('Inactive standard icon media is discarded.')
