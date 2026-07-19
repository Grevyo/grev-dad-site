from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return source.replace(before, after, 1)


html_path = Path('public/dashboard.html')
html = html_path.read_text()
html = replace_once(html, 'id="dashboard-icon-background-colour" type="color" value="#f3f5f8"', 'id="dashboard-icon-background-colour" type="color" value="#394657"', 'icon background input default')
html_path.write_text(html)

css_path = Path('public/dashboard.css')
css = css_path.read_text()
css = replace_once(
    css,
    '.dashboard-profile-avatar{display:grid;place-items:center;width:62px;height:62px;border:1px solid var(--tile-border-strong);background:var(--tile-accent);color:#080b0f;font-size:1.15rem;font-weight:950}',
    '.dashboard-profile-avatar{display:grid;place-items:center;width:62px;height:62px;border:1px solid var(--tile-icon-border,var(--tile-border-strong));background:var(--tile-icon-bg,var(--tile-accent));color:var(--tile-icon-text,#080b0f);font-size:1.15rem;font-weight:950;overflow:hidden}',
    'profile icon styles',
)
css = replace_once(
    css,
    '.dashboard-tile[data-custom-appearance="true"] .dashboard-profile-avatar{border-color:color-mix(in srgb,var(--tile-custom-border) 75%,white);background:color-mix(in srgb,var(--tile-custom-border) 35%,#f4f7fb);color:var(--tile-custom-text)}\n',
    '',
    'remove profile appearance override',
)
css_path.write_text(css)

js_path = Path('public/dashboard.js')
js = js_path.read_text()
js = replace_once(js, "iconBackgroundColour: '#f3f5f8'", "iconBackgroundColour: '#394657'", 'frontend icon background default')
js = replace_once(
    js,
    '''function createStandardTileIcon(feature, className) {
  const appearance = normalizedTileAppearance(feature);''',
    '''function standardIconFallback(feature) {
  return feature.id === 'feature-profile' ? viewerInitials(dashboardState.payload?.viewer) : feature.iconText;
}

function createStandardTileIcon(feature, className) {
  const appearance = normalizedTileAppearance(feature);''',
    'standard icon fallback helper',
)
js = replace_once(js, '    icon.textContent = appearance.iconLabel ?? feature.iconText;', '    icon.textContent = appearance.iconLabel ?? standardIconFallback(feature);', 'use standard icon fallback')
js = replace_once(
    js,
    '''  const avatar = document.createElement('span');
  avatar.className = 'dashboard-profile-avatar';
  avatar.textContent = viewerInitials(viewer);''',
    '''  const avatar = createStandardTileIcon(feature, 'dashboard-profile-avatar');''',
    'profile tile standard icon renderer',
)
js = replace_once(
    js,
    '''    iconLabel.placeholder = feature?.iconText ? `Use feature default (${feature.iconText})` : 'Use feature default';''',
    '''    const fallback = feature ? standardIconFallback(feature) : '';
    iconLabel.placeholder = fallback ? `Use feature default (${fallback})` : 'Use feature default';''',
    'icon placeholder fallback',
)
js_path.write_text(js)

ts_path = Path('src/dashboard.ts')
ts = ts_path.read_text()
ts = replace_once(ts, "iconBackgroundColour: '#f3f5f8'", "iconBackgroundColour: '#394657'", 'backend icon background default')
ts_path.write_text(ts)

migration_path = Path('migrations/20260719_standard_tile_icon_customization.sql')
migration = migration_path.read_text()
migration = replace_once(migration, "icon_background_colour TEXT NOT NULL DEFAULT '#f3f5f8'", "icon_background_colour TEXT NOT NULL DEFAULT '#394657'", 'migration icon background default')
migration_path.write_text(migration)

print('Standard tile icon defaults and profile behavior refined.')
