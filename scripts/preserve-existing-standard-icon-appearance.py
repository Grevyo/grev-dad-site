from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return source.replace(before, after, 1)


migration_path = Path('migrations/20260719_standard_tile_icon_customization.sql')
migration = migration_path.read_text()
migration = '''ALTER TABLE user_dashboard_tiles ADD COLUMN icon_mode TEXT;
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_label TEXT;
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_media TEXT;
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_text_colour TEXT;
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_background_colour TEXT;
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_border_colour TEXT;
ALTER TABLE user_dashboard_tiles ADD COLUMN icon_media_fit TEXT;
'''
migration_path.write_text(migration)

js_path = Path('public/dashboard.js')
js = js_path.read_text()
js = replace_once(
    js,
    '''  tile.contentMode = value;
  if (value === 'media-button') {
    tile.backgroundType = 'media';''',
    '''  tile.contentMode = value;
  if (value === 'media-button' && tile.iconMode === 'image' && !tile.iconMedia) tile.iconMode = 'text';
  if (value === 'media-button') {
    tile.backgroundType = 'media';''',
    'clear hidden incomplete icon mode',
)
js_path.write_text(js)

ts_path = Path('src/dashboard.ts')
ts = ts_path.read_text()
ts = replace_once(
    ts,
    '''const LEGACY_TILE_APPEARANCE: Record<TileColour, Pick<TileAppearance, 'backgroundPrimary' | 'borderColour'>> = {
  default: { backgroundPrimary: '#11161d', borderColour: '#394657' },
  graphite: { backgroundPrimary: '#171b22', borderColour: '#3e4856' },
  blue: { backgroundPrimary: '#101a2a', borderColour: '#365987' },
  cyan: { backgroundPrimary: '#0e2023', borderColour: '#2f6c73' },
  green: { backgroundPrimary: '#112319', borderColour: '#376c4b' },
  amber: { backgroundPrimary: '#2a2010', borderColour: '#7b5b26' },
  red: { backgroundPrimary: '#291417', borderColour: '#793842' },
  purple: { backgroundPrimary: '#21172f', borderColour: '#60457f' },
  pink: { backgroundPrimary: '#2b1624', borderColour: '#7c3b65' }
};''',
    '''const LEGACY_TILE_APPEARANCE: Record<TileColour, Pick<TileAppearance, 'backgroundPrimary' | 'borderColour'>> = {
  default: { backgroundPrimary: '#11161d', borderColour: '#394657' },
  graphite: { backgroundPrimary: '#171b22', borderColour: '#3e4856' },
  blue: { backgroundPrimary: '#101a2a', borderColour: '#365987' },
  cyan: { backgroundPrimary: '#0e2023', borderColour: '#2f6c73' },
  green: { backgroundPrimary: '#112319', borderColour: '#376c4b' },
  amber: { backgroundPrimary: '#2a2010', borderColour: '#7b5b26' },
  red: { backgroundPrimary: '#291417', borderColour: '#793842' },
  purple: { backgroundPrimary: '#21172f', borderColour: '#60457f' },
  pink: { backgroundPrimary: '#2b1624', borderColour: '#7c3b65' }
};
const LEGACY_ICON_BORDERS: Record<TileColour, string> = {
  default: '#667181', graphite: '#687789', blue: '#5c82b8', cyan: '#4e9ca5', green: '#58936c',
  amber: '#aa813d', red: '#a95461', purple: '#8765aa', pink: '#a9588a'
};''',
    'legacy icon border map',
)
ts = replace_once(
    ts,
    '''  const backgroundType = VALID_BACKGROUND_TYPES.has(backgroundTypeValue) ? backgroundTypeValue : DEFAULT_TILE_APPEARANCE.backgroundType;
  const fontFamily = VALID_FONT_FAMILIES.has(fontFamilyValue) ? fontFamilyValue : DEFAULT_TILE_APPEARANCE.fontFamily;
  const appearance: TileAppearance = {''',
    '''  const backgroundType = VALID_BACKGROUND_TYPES.has(backgroundTypeValue) ? backgroundTypeValue : DEFAULT_TILE_APPEARANCE.backgroundType;
  const fontFamily = VALID_FONT_FAMILIES.has(fontFamilyValue) ? fontFamilyValue : DEFAULT_TILE_APPEARANCE.fontFamily;
  const borderColour = HEX_COLOUR.test(String(row.border_colour ?? '')) ? String(row.border_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.borderColour;
  const appearance: TileAppearance = {''',
    'computed current tile border',
)
ts = replace_once(
    ts,
    '''    borderColour: HEX_COLOUR.test(String(row.border_colour ?? '')) ? String(row.border_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.borderColour,''',
    '''    borderColour,''',
    'reuse current tile border',
)
ts = replace_once(
    ts,
    '''    iconBackgroundColour: HEX_COLOUR.test(String(row.icon_background_colour ?? '')) ? String(row.icon_background_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.iconBackgroundColour,
    iconBorderColour: HEX_COLOUR.test(String(row.icon_border_colour ?? '')) ? String(row.icon_border_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.iconBorderColour,''',
    '''    iconBackgroundColour: HEX_COLOUR.test(String(row.icon_background_colour ?? '')) ? String(row.icon_background_colour).toLowerCase() : borderColour,
    iconBorderColour: HEX_COLOUR.test(String(row.icon_border_colour ?? '')) ? String(row.icon_border_colour).toLowerCase() : LEGACY_ICON_BORDERS[tileColour],''',
    'inherit existing icon appearance',
)
ts_path.write_text(ts)

print('Existing standard icon appearance compatibility applied.')
