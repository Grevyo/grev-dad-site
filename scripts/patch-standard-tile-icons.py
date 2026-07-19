from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return source.replace(before, after, 1)


# Dashboard settings markup.
html_path = Path("public/dashboard.html")
html = html_path.read_text()
html = replace_once(
    html,
    '''<label>Content mode<select id="dashboard-content-mode"><option value="standard">Standard feature tile</option><option value="media-button">Custom media button</option></select></label>
<div id="dashboard-custom-content-controls" class="dashboard-custom-content-controls" hidden>''',
    '''<label>Content mode<select id="dashboard-content-mode"><option value="standard">Standard feature tile</option><option value="media-button">Custom media button</option></select></label>
<div id="dashboard-standard-icon-controls" class="dashboard-standard-icon-controls">
<div class="dashboard-standard-icon-heading"><strong>Standard tile icon</strong><span>Change the coloured letters block or replace it with a picture.</span></div>
<div class="dashboard-standard-icon-grid">
<label>Icon type<select id="dashboard-icon-mode"><option value="text">Letters or short text</option><option value="image">Picture</option></select></label>
<label id="dashboard-icon-label-control">Letters or short text<input id="dashboard-icon-label" type="text" maxlength="6" placeholder="Use feature default"></label>
</div>
<div class="dashboard-standard-icon-colours">
<label class="dashboard-colour-input">Letter colour<input id="dashboard-icon-text-colour" type="color" value="#090b0f"></label>
<label class="dashboard-colour-input">Icon background<input id="dashboard-icon-background-colour" type="color" value="#f3f5f8"></label>
<label class="dashboard-colour-input">Icon border<input id="dashboard-icon-border-colour" type="color" value="#667181"></label>
</div>
<div id="dashboard-icon-media-controls" class="dashboard-standard-icon-media" hidden>
<label class="dashboard-media-upload">Choose PNG, JPEG, WebP or animated GIF<input id="dashboard-icon-media" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></label>
<label>Picture fit<select id="dashboard-icon-media-fit"><option value="cover">Fill icon (cover)</option><option value="contain">Show whole picture (contain)</option><option value="stretch">Stretch to icon</option></select></label>
<div class="dashboard-media-actions"><span id="dashboard-icon-media-status">No icon picture selected.</span><button id="dashboard-remove-icon-media" type="button">Remove picture</button></div>
<small>Maximum file size: 1.4 MB. The picture is stored privately with your dashboard layout.</small>
</div>
<button id="dashboard-reset-icon" type="button">Reset standard icon</button>
</div>
<div id="dashboard-custom-content-controls" class="dashboard-custom-content-controls" hidden>''',
    "standard icon controls",
)
html_path.write_text(html)


# Dashboard styles.
css_path = Path("public/dashboard.css")
css = css_path.read_text()
css = replace_once(
    css,
    '''.dashboard-action-icon,.dashboard-content-icon{display:grid;place-items:center;width:48px;height:48px;border:1px solid var(--tile-border-strong);background:var(--tile-accent);color:#080b0f;font-weight:950;letter-spacing:-.04em}''',
    '''.dashboard-action-icon,.dashboard-content-icon{display:grid;place-items:center;width:48px;height:48px;border:1px solid var(--tile-icon-border,var(--tile-border-strong));background:var(--tile-icon-bg,var(--tile-accent));color:var(--tile-icon-text,#080b0f);font-weight:950;letter-spacing:-.04em;overflow:hidden}
.dashboard-standard-icon img{display:block;width:100%;height:100%;object-fit:var(--tile-icon-fit,cover);object-position:center}
.dashboard-standard-icon[data-icon-mode="image"]{padding:0}''',
    "standard icon base styles",
)
css = replace_once(
    css,
    '''.dashboard-tile[data-custom-appearance="true"] .dashboard-action-icon,.dashboard-tile[data-custom-appearance="true"] .dashboard-content-icon,.dashboard-tile[data-custom-appearance="true"] .dashboard-profile-avatar{border-color:color-mix(in srgb,var(--tile-custom-border) 75%,white);background:color-mix(in srgb,var(--tile-custom-border) 35%,#f4f7fb);color:var(--tile-custom-text)}''',
    '''.dashboard-tile[data-custom-appearance="true"] .dashboard-profile-avatar{border-color:color-mix(in srgb,var(--tile-custom-border) 75%,white);background:color-mix(in srgb,var(--tile-custom-border) 35%,#f4f7fb);color:var(--tile-custom-text)}''',
    "do not override independent standard icon colours",
)
css = replace_once(
    css,
    '''.dashboard-custom-content-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px;border:1px solid var(--line);background:#0b0f14}''',
    '''.dashboard-standard-icon-controls{display:grid;gap:12px;padding:12px;border:1px solid var(--line);background:#0b0f14}
.dashboard-standard-icon-heading{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.dashboard-standard-icon-heading span{color:var(--muted);font-size:.75rem;text-align:right}
.dashboard-standard-icon-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dashboard-standard-icon-colours{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.dashboard-standard-icon-media{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,.45fr);gap:10px;padding:12px;border:1px dashed #536174;background:#10161e}
.dashboard-standard-icon-media .dashboard-media-actions,.dashboard-standard-icon-media>small{grid-column:1/-1}
.dashboard-standard-icon-controls>button{justify-self:start}
.dashboard-custom-content-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px;border:1px solid var(--line);background:#0b0f14}''',
    "standard icon settings layout",
)
css = replace_once(
    css,
    '''@media(max-width:760px){.dashboard-custom-content-controls,.dashboard-custom-media-options{grid-template-columns:1fr}}''',
    '''@media(max-width:760px){.dashboard-custom-content-controls,.dashboard-custom-media-options,.dashboard-standard-icon-grid,.dashboard-standard-icon-colours,.dashboard-standard-icon-media{grid-template-columns:1fr}.dashboard-standard-icon-heading{align-items:flex-start;flex-direction:column}.dashboard-standard-icon-heading span{text-align:left}}''',
    "standard icon settings mobile layout",
)
css_path.write_text(css)


# Dashboard client behaviour.
js_path = Path("public/dashboard.js")
js = js_path.read_text()
js = replace_once(
    js,
    '''const TILE_CONTENT_MODES = new Set(['standard','media-button']);
const TILE_MEDIA_FITS = new Set(['cover','contain','stretch']);''',
    '''const TILE_CONTENT_MODES = new Set(['standard','media-button']);
const TILE_ICON_MODES = new Set(['text','image']);
const TILE_MEDIA_FITS = new Set(['cover','contain','stretch']);''',
    "icon modes constant",
)
js = replace_once(
    js,
    '''const DEFAULT_TILE_APPEARANCE = Object.freeze({ backgroundType: 'solid', backgroundPrimary: '#11161d', backgroundSecondary: '#5268aa', backgroundAngle: 135, backgroundMedia: null, textColour: '#f4f7fb', fontFamily: 'system', borderColour: '#394657', contentMode: 'standard', customTitle: null, customIcon: null, mediaFit: 'cover', mediaOverlay: 'dark' });''',
    '''const DEFAULT_TILE_APPEARANCE = Object.freeze({ backgroundType: 'solid', backgroundPrimary: '#11161d', backgroundSecondary: '#5268aa', backgroundAngle: 135, backgroundMedia: null, textColour: '#f4f7fb', fontFamily: 'system', borderColour: '#394657', contentMode: 'standard', customTitle: null, customIcon: null, mediaFit: 'cover', mediaOverlay: 'dark', iconMode: 'text', iconLabel: null, iconMedia: null, iconTextColour: '#090b0f', iconBackgroundColour: '#f3f5f8', iconBorderColour: '#667181', iconMediaFit: 'cover' });''',
    "default icon appearance",
)
js = replace_once(
    js,
    '''  const flatFields = ['backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','fontFamily','borderColour','contentMode','customTitle','customIcon','mediaFit','mediaOverlay'];''',
    '''  const flatFields = ['backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','fontFamily','borderColour','contentMode','customTitle','customIcon','mediaFit','mediaOverlay','iconMode','iconLabel','iconMedia','iconTextColour','iconBackgroundColour','iconBorderColour','iconMediaFit'];''',
    "normalized icon fields",
)
js = replace_once(
    js,
    '''    mediaFit: TILE_MEDIA_FITS.has(appearance.mediaFit) ? appearance.mediaFit : DEFAULT_TILE_APPEARANCE.mediaFit,
    mediaOverlay: TILE_MEDIA_OVERLAYS.has(appearance.mediaOverlay) ? appearance.mediaOverlay : DEFAULT_TILE_APPEARANCE.mediaOverlay
  };''',
    '''    mediaFit: TILE_MEDIA_FITS.has(appearance.mediaFit) ? appearance.mediaFit : DEFAULT_TILE_APPEARANCE.mediaFit,
    mediaOverlay: TILE_MEDIA_OVERLAYS.has(appearance.mediaOverlay) ? appearance.mediaOverlay : DEFAULT_TILE_APPEARANCE.mediaOverlay,
    iconMode: TILE_ICON_MODES.has(appearance.iconMode) ? appearance.iconMode : DEFAULT_TILE_APPEARANCE.iconMode,
    iconLabel: typeof appearance.iconLabel === 'string' && appearance.iconLabel.trim() ? appearance.iconLabel.trim().slice(0, 6) : null,
    iconMedia: typeof appearance.iconMedia === 'string' && appearance.iconMedia.startsWith('data:image/') ? appearance.iconMedia : null,
    iconTextColour: validHex(appearance.iconTextColour) ? appearance.iconTextColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.iconTextColour,
    iconBackgroundColour: validHex(appearance.iconBackgroundColour) ? appearance.iconBackgroundColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.iconBackgroundColour,
    iconBorderColour: validHex(appearance.iconBorderColour) ? appearance.iconBorderColour.toLowerCase() : DEFAULT_TILE_APPEARANCE.iconBorderColour,
    iconMediaFit: TILE_MEDIA_FITS.has(appearance.iconMediaFit) ? appearance.iconMediaFit : DEFAULT_TILE_APPEARANCE.iconMediaFit
  };''',
    "normalized icon appearance",
)
js = replace_once(
    js,
    '''  article.style.setProperty('--tile-accent', appearance.borderColour);
  article.style.borderColor = appearance.borderColour;''',
    '''  article.style.setProperty('--tile-accent', appearance.borderColour);
  article.style.setProperty('--tile-icon-text', appearance.iconTextColour);
  article.style.setProperty('--tile-icon-bg', appearance.iconBackgroundColour);
  article.style.setProperty('--tile-icon-border', appearance.iconBorderColour);
  article.style.setProperty('--tile-icon-fit', appearance.iconMediaFit === 'stretch' ? 'fill' : appearance.iconMediaFit);
  article.style.borderColor = appearance.borderColour;''',
    "apply icon CSS variables",
)
js = replace_once(
    js,
    '''function createActionTileContent(feature, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-action-tile');
  const icon = document.createElement('span');
  icon.className = 'dashboard-action-icon';
  icon.textContent = feature.iconText;''',
    '''function createStandardTileIcon(feature, className) {
  const appearance = normalizedTileAppearance(feature);
  const icon = document.createElement('span');
  icon.className = `${className} dashboard-standard-icon`;
  icon.dataset.iconMode = appearance.iconMode;
  icon.setAttribute('aria-hidden', 'true');
  if (appearance.iconMode === 'image' && appearance.iconMedia) {
    const image = document.createElement('img');
    image.src = appearance.iconMedia;
    image.alt = '';
    image.draggable = false;
    icon.append(image);
  } else {
    icon.textContent = appearance.iconLabel ?? feature.iconText;
  }
  return icon;
}

function createActionTileContent(feature, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-action-tile');
  const icon = createStandardTileIcon(feature, 'dashboard-action-icon');''',
    "standard action icon helper",
)
content_icon_anchor = '''  const icon = document.createElement('span');
  icon.className = 'dashboard-content-icon';
  icon.textContent = feature.iconText;
  heading.append(label, icon);'''
content_icon_replacement = '''  const icon = createStandardTileIcon(feature, 'dashboard-content-icon');
  heading.append(label, icon);'''
if js.count(content_icon_anchor) != 2:
    raise RuntimeError(f"standard content icons: expected two anchors, found {js.count(content_icon_anchor)}")
js = js.replace(content_icon_anchor, content_icon_replacement)
js = replace_once(
    js,
    '''function setCustomContentVisibility(mode) {
  const controls = dashboardElement('#dashboard-custom-content-controls');
  if (controls) controls.hidden = mode !== 'media-button';
}

function setAppearanceModeVisibility(type) {''',
    '''function setCustomContentVisibility(mode) {
  const controls = dashboardElement('#dashboard-custom-content-controls');
  const standardIcon = dashboardElement('#dashboard-standard-icon-controls');
  if (controls) controls.hidden = mode !== 'media-button';
  if (standardIcon) standardIcon.hidden = mode !== 'standard';
}

function setStandardIconVisibility(mode) {
  const label = dashboardElement('#dashboard-icon-label-control');
  const media = dashboardElement('#dashboard-icon-media-controls');
  if (label) label.hidden = mode !== 'text';
  if (media) media.hidden = mode !== 'image';
}

function setAppearanceModeVisibility(type) {''',
    "standard icon visibility",
)
js = replace_once(
    js,
    '''  const mediaOverlay = dashboardElement('#dashboard-media-overlay');
  if (contentMode) contentMode.value = appearance.contentMode;''',
    '''  const mediaOverlay = dashboardElement('#dashboard-media-overlay');
  const iconMode = dashboardElement('#dashboard-icon-mode');
  const iconLabel = dashboardElement('#dashboard-icon-label');
  const iconTextColour = dashboardElement('#dashboard-icon-text-colour');
  const iconBackgroundColour = dashboardElement('#dashboard-icon-background-colour');
  const iconBorderColour = dashboardElement('#dashboard-icon-border-colour');
  const iconMediaFit = dashboardElement('#dashboard-icon-media-fit');
  if (contentMode) contentMode.value = appearance.contentMode;''',
    "read standard icon controls",
)
js = replace_once(
    js,
    '''  if (mediaOverlay) mediaOverlay.value = appearance.mediaOverlay;
  setCustomContentVisibility(appearance.contentMode);''',
    '''  if (mediaOverlay) mediaOverlay.value = appearance.mediaOverlay;
  if (iconMode) iconMode.value = appearance.iconMode;
  if (iconLabel) {
    iconLabel.value = appearance.iconLabel ?? '';
    const feature = featureById(tile.featureId);
    iconLabel.placeholder = feature?.iconText ? `Use feature default (${feature.iconText})` : 'Use feature default';
  }
  if (iconTextColour) iconTextColour.value = appearance.iconTextColour;
  if (iconBackgroundColour) iconBackgroundColour.value = appearance.iconBackgroundColour;
  if (iconBorderColour) iconBorderColour.value = appearance.iconBorderColour;
  if (iconMediaFit) iconMediaFit.value = appearance.iconMediaFit;
  setCustomContentVisibility(appearance.contentMode);
  setStandardIconVisibility(appearance.iconMode);''',
    "populate standard icon controls",
)
js = replace_once(
    js,
    '''  const removeMedia = dashboardElement('#dashboard-remove-media');
  if (removeMedia) removeMedia.disabled = !appearance.backgroundMedia;

  const solidPalette = dashboardElement('#dashboard-solid-palette');''',
    '''  const removeMedia = dashboardElement('#dashboard-remove-media');
  if (removeMedia) removeMedia.disabled = !appearance.backgroundMedia;
  const iconMediaStatus = dashboardElement('#dashboard-icon-media-status');
  if (iconMediaStatus) iconMediaStatus.textContent = appearance.iconMedia ? 'Icon picture selected and ready to save.' : 'No icon picture selected.';
  const removeIconMedia = dashboardElement('#dashboard-remove-icon-media');
  if (removeIconMedia) removeIconMedia.disabled = !appearance.iconMedia;

  const solidPalette = dashboardElement('#dashboard-solid-palette');''',
    "standard icon media status",
)
js = replace_once(
    js,
    '''dashboardElement('#dashboard-content-mode')?.addEventListener('change', event => {''',
    '''dashboardElement('#dashboard-icon-mode')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const value = String(event.currentTarget.value);
  if (!tile || !TILE_ICON_MODES.has(value)) return;
  tile.iconMode = value;
  refreshAppearancePreview(tile, value === 'image' ? 'Picture icon selected. Upload a picture before saving.' : 'Letter icon selected.');
});
dashboardElement('#dashboard-icon-label')?.addEventListener('input', event => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  const value = String(event.currentTarget.value).slice(0, 6);
  tile.iconLabel = value.trim() || null;
  renderDashboardGrid();
});
dashboardElement('#dashboard-icon-media-fit')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const value = String(event.currentTarget.value);
  if (!tile || !TILE_MEDIA_FITS.has(value)) return;
  tile.iconMediaFit = value;
  refreshAppearancePreview(tile);
});
dashboardElement('#dashboard-content-mode')?.addEventListener('change', event => {''',
    "standard icon listeners",
)
js = replace_once(
    js,
    '''[['#dashboard-background-primary','backgroundPrimary'],['#dashboard-gradient-primary','backgroundPrimary'],['#dashboard-background-secondary','backgroundSecondary'],['#dashboard-text-colour','textColour'],['#dashboard-border-colour','borderColour']].forEach(([selector, field]) => {''',
    '''[['#dashboard-background-primary','backgroundPrimary'],['#dashboard-gradient-primary','backgroundPrimary'],['#dashboard-background-secondary','backgroundSecondary'],['#dashboard-text-colour','textColour'],['#dashboard-border-colour','borderColour'],['#dashboard-icon-text-colour','iconTextColour'],['#dashboard-icon-background-colour','iconBackgroundColour'],['#dashboard-icon-border-colour','iconBorderColour']].forEach(([selector, field]) => {''',
    "standard icon colour listeners",
)
js = replace_once(
    js,
    '''dashboardElement('#dashboard-background-media')?.addEventListener('change', event => {''',
    '''dashboardElement('#dashboard-icon-media')?.addEventListener('change', event => {
  const tile = workingTile(dashboardState.selectedId);
  const file = event.currentTarget.files?.[0];
  if (!tile || !file) return;
  const allowed = new Set(['image/png','image/jpeg','image/webp','image/gif']);
  if (!allowed.has(file.type)) {
    event.currentTarget.value = '';
    editorMessage('Choose a PNG, JPEG, WebP or animated GIF for the icon.', 'error');
    return;
  }
  if (file.size > MAX_TILE_MEDIA_BYTES) {
    event.currentTarget.value = '';
    editorMessage('Icon pictures and GIFs must be 1.4 MB or smaller.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    if (typeof reader.result !== 'string') return;
    tile.iconMode = 'image';
    tile.iconMedia = reader.result;
    refreshAppearancePreview(tile, file.name + ' selected as the standard tile icon.');
  });
  reader.addEventListener('error', () => editorMessage('The icon picture or GIF could not be read.', 'error'));
  reader.readAsDataURL(file);
});
dashboardElement('#dashboard-remove-icon-media')?.addEventListener('click', () => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  tile.iconMedia = null;
  tile.iconMode = 'text';
  const input = dashboardElement('#dashboard-icon-media');
  if (input) input.value = '';
  refreshAppearancePreview(tile, 'Icon picture removed. The letter icon is active again.');
});
dashboardElement('#dashboard-reset-icon')?.addEventListener('click', () => {
  const tile = workingTile(dashboardState.selectedId);
  if (!tile) return;
  Object.assign(tile, {
    iconMode: DEFAULT_TILE_APPEARANCE.iconMode,
    iconLabel: DEFAULT_TILE_APPEARANCE.iconLabel,
    iconMedia: DEFAULT_TILE_APPEARANCE.iconMedia,
    iconTextColour: DEFAULT_TILE_APPEARANCE.iconTextColour,
    iconBackgroundColour: DEFAULT_TILE_APPEARANCE.iconBackgroundColour,
    iconBorderColour: DEFAULT_TILE_APPEARANCE.iconBorderColour,
    iconMediaFit: DEFAULT_TILE_APPEARANCE.iconMediaFit
  });
  const input = dashboardElement('#dashboard-icon-media');
  if (input) input.value = '';
  refreshAppearancePreview(tile, 'Standard tile icon reset.');
});
dashboardElement('#dashboard-background-media')?.addEventListener('change', event => {''',
    "standard icon media listeners",
)
js = replace_once(
    js,
    '''  const input = dashboardElement('#dashboard-background-media');
  if (input) input.value = '';
  refreshAppearancePreview(tile, 'Tile appearance reset.');''',
    '''  const input = dashboardElement('#dashboard-background-media');
  const iconInput = dashboardElement('#dashboard-icon-media');
  if (input) input.value = '';
  if (iconInput) iconInput.value = '';
  refreshAppearancePreview(tile, 'Tile appearance reset.');''',
    "reset icon file input",
)
js_path.write_text(js)


# Worker validation and persistence.
ts_path = Path("src/dashboard.ts")
ts = ts_path.read_text()
ts = replace_once(
    ts,
    '''type TileContentMode = 'standard' | 'media-button';
type TileMediaFit = 'cover' | 'contain' | 'stretch';''',
    '''type TileContentMode = 'standard' | 'media-button';
type TileIconMode = 'text' | 'image';
type TileMediaFit = 'cover' | 'contain' | 'stretch';''',
    "icon mode type",
)
ts = replace_once(
    ts,
    '''  customIcon: string | null;
  mediaFit: TileMediaFit;
  mediaOverlay: TileMediaOverlay;''',
    '''  customIcon: string | null;
  mediaFit: TileMediaFit;
  mediaOverlay: TileMediaOverlay;
  iconMode: TileIconMode;
  iconLabel: string | null;
  iconMedia: string | null;
  iconTextColour: string;
  iconBackgroundColour: string;
  iconBorderColour: string;
  iconMediaFit: TileMediaFit;''',
    "tile icon appearance type",
)
ts = replace_once(
    ts,
    '''  media_overlay: string | null;
  matched_groups: string;''',
    '''  media_overlay: string | null;
  icon_mode: string | null;
  icon_label: string | null;
  icon_media: string | null;
  icon_text_colour: string | null;
  icon_background_colour: string | null;
  icon_border_colour: string | null;
  icon_media_fit: string | null;
  matched_groups: string;''',
    "feature row icon fields",
)
ts = replace_once(
    ts,
    '''const VALID_CONTENT_MODES = new Set<TileContentMode>(['standard','media-button']);
const VALID_MEDIA_FITS = new Set<TileMediaFit>(['cover','contain','stretch']);''',
    '''const VALID_CONTENT_MODES = new Set<TileContentMode>(['standard','media-button']);
const VALID_ICON_MODES = new Set<TileIconMode>(['text','image']);
const VALID_MEDIA_FITS = new Set<TileMediaFit>(['cover','contain','stretch']);''',
    "valid icon modes",
)
ts = replace_once(
    ts,
    '''  customIcon: null,
  mediaFit: 'cover',
  mediaOverlay: 'dark'
};''',
    '''  customIcon: null,
  mediaFit: 'cover',
  mediaOverlay: 'dark',
  iconMode: 'text',
  iconLabel: null,
  iconMedia: null,
  iconTextColour: '#090b0f',
  iconBackgroundColour: '#f3f5f8',
  iconBorderColour: '#667181',
  iconMediaFit: 'cover'
};''',
    "default icon appearance backend",
)
ts = replace_once(
    ts,
    '''  const appearanceFields = ['backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','fontFamily','borderColour'];''',
    '''  const appearanceFields = ['backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','fontFamily','borderColour','iconMode','iconLabel','iconMedia','iconTextColour','iconBackgroundColour','iconBorderColour','iconMediaFit'];''',
    "explicit icon appearance fields",
)
ts = replace_once(
    ts,
    '''  const mediaFit = String(item.mediaFit ?? defaults.mediaFit) as TileMediaFit;
  const mediaOverlay = String(item.mediaOverlay ?? defaults.mediaOverlay) as TileMediaOverlay;
  if ((customTitle?.length ?? 0) > 80 || (customIcon?.length ?? 0) > 12) return null;''',
    '''  const mediaFit = String(item.mediaFit ?? defaults.mediaFit) as TileMediaFit;
  const mediaOverlay = String(item.mediaOverlay ?? defaults.mediaOverlay) as TileMediaOverlay;
  const iconMode = String(item.iconMode ?? defaults.iconMode) as TileIconMode;
  const iconLabelRaw = item.iconLabel === null || item.iconLabel === undefined || item.iconLabel === '' ? null : item.iconLabel;
  const iconMediaValue = item.iconMedia === null || item.iconMedia === undefined || item.iconMedia === '' ? null : String(item.iconMedia);
  if (iconLabelRaw !== null && typeof iconLabelRaw !== 'string') return null;
  const iconLabel = typeof iconLabelRaw === 'string' && iconLabelRaw.trim() ? iconLabelRaw.trim() : null;
  const iconTextColour = String(item.iconTextColour ?? defaults.iconTextColour).toLowerCase();
  const iconBackgroundColour = String(item.iconBackgroundColour ?? defaults.iconBackgroundColour).toLowerCase();
  const iconBorderColour = String(item.iconBorderColour ?? defaults.iconBorderColour).toLowerCase();
  const iconMediaFit = String(item.iconMediaFit ?? defaults.iconMediaFit) as TileMediaFit;
  if ((customTitle?.length ?? 0) > 80 || (customIcon?.length ?? 0) > 12 || (iconLabel?.length ?? 0) > 6) return null;''',
    "parse icon appearance input",
)
ts = replace_once(
    ts,
    '''  if (!VALID_CONTENT_MODES.has(contentMode) || !VALID_MEDIA_FITS.has(mediaFit) || !VALID_MEDIA_OVERLAYS.has(mediaOverlay)) return null;
  if (!VALID_BACKGROUND_TYPES.has(backgroundType) || !HEX_COLOUR.test(backgroundPrimary) || !HEX_COLOUR.test(backgroundSecondary) || !HEX_COLOUR.test(textColour) || !HEX_COLOUR.test(borderColour)) return null;''',
    '''  if (!VALID_CONTENT_MODES.has(contentMode) || !VALID_ICON_MODES.has(iconMode) || !VALID_MEDIA_FITS.has(mediaFit) || !VALID_MEDIA_FITS.has(iconMediaFit) || !VALID_MEDIA_OVERLAYS.has(mediaOverlay)) return null;
  if (!VALID_BACKGROUND_TYPES.has(backgroundType) || !HEX_COLOUR.test(backgroundPrimary) || !HEX_COLOUR.test(backgroundSecondary) || !HEX_COLOUR.test(textColour) || !HEX_COLOUR.test(borderColour) || !HEX_COLOUR.test(iconTextColour) || !HEX_COLOUR.test(iconBackgroundColour) || !HEX_COLOUR.test(iconBorderColour)) return null;''',
    "validate icon appearance",
)
ts = replace_once(
    ts,
    '''  if (backgroundMediaValue && !validImageDataUrl(backgroundMediaValue)) return null;
  if (backgroundType === 'media' && !backgroundMediaValue) return null;
  if (contentMode === 'media-button' && (backgroundType !== 'media' || !backgroundMediaValue)) return null;
  return { backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: backgroundMediaValue, textColour, fontFamily, borderColour, contentMode, customTitle, customIcon, mediaFit, mediaOverlay };''',
    '''  if (backgroundMediaValue && !validImageDataUrl(backgroundMediaValue)) return null;
  if (iconMediaValue && !validImageDataUrl(iconMediaValue)) return null;
  if (backgroundType === 'media' && !backgroundMediaValue) return null;
  if (contentMode === 'media-button' && (backgroundType !== 'media' || !backgroundMediaValue)) return null;
  if (iconMode === 'image' && !iconMediaValue) return null;
  return { backgroundType, backgroundPrimary, backgroundSecondary, backgroundAngle, backgroundMedia: backgroundMediaValue, textColour, fontFamily, borderColour, contentMode, customTitle, customIcon, mediaFit, mediaOverlay, iconMode, iconLabel, iconMedia: iconMediaValue, iconTextColour, iconBackgroundColour, iconBorderColour, iconMediaFit };''',
    "validate icon media and return",
)
ts = replace_once(
    ts,
    '''    mediaOverlay: VALID_MEDIA_OVERLAYS.has(String(row.media_overlay ?? '') as TileMediaOverlay) ? String(row.media_overlay) as TileMediaOverlay : DEFAULT_TILE_APPEARANCE.mediaOverlay
  };''',
    '''    mediaOverlay: VALID_MEDIA_OVERLAYS.has(String(row.media_overlay ?? '') as TileMediaOverlay) ? String(row.media_overlay) as TileMediaOverlay : DEFAULT_TILE_APPEARANCE.mediaOverlay,
    iconMode: VALID_ICON_MODES.has(String(row.icon_mode ?? '') as TileIconMode) ? String(row.icon_mode) as TileIconMode : DEFAULT_TILE_APPEARANCE.iconMode,
    iconLabel: typeof row.icon_label === 'string' && row.icon_label.trim() ? row.icon_label.trim().slice(0, 6) : null,
    iconMedia: typeof row.icon_media === 'string' && row.icon_media ? row.icon_media : null,
    iconTextColour: HEX_COLOUR.test(String(row.icon_text_colour ?? '')) ? String(row.icon_text_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.iconTextColour,
    iconBackgroundColour: HEX_COLOUR.test(String(row.icon_background_colour ?? '')) ? String(row.icon_background_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.iconBackgroundColour,
    iconBorderColour: HEX_COLOUR.test(String(row.icon_border_colour ?? '')) ? String(row.icon_border_colour).toLowerCase() : DEFAULT_TILE_APPEARANCE.iconBorderColour,
    iconMediaFit: VALID_MEDIA_FITS.has(String(row.icon_media_fit ?? '') as TileMediaFit) ? String(row.icon_media_fit) as TileMediaFit : DEFAULT_TILE_APPEARANCE.iconMediaFit
  };''',
    "hydrate icon appearance",
)
ts = replace_once(
    ts,
    '''       t.media_fit,
       t.media_overlay,
      COALESCE((''',
    '''       t.media_fit,
       t.media_overlay,
       t.icon_mode,
       t.icon_label,
       t.icon_media,
       t.icon_text_colour,
       t.icon_background_colour,
       t.icon_border_colour,
       t.icon_media_fit,
      COALESCE((''',
    "select icon columns",
)
null_columns_before = "NULL AS content_mode,NULL AS custom_title,NULL AS custom_icon,NULL AS media_fit,NULL AS media_overlay,'' AS matched_groups"
null_columns_after = "NULL AS content_mode,NULL AS custom_title,NULL AS custom_icon,NULL AS media_fit,NULL AS media_overlay,NULL AS icon_mode,NULL AS icon_label,NULL AS icon_media,NULL AS icon_text_colour,NULL AS icon_background_colour,NULL AS icon_border_colour,NULL AS icon_media_fit,'' AS matched_groups"
if ts.count(null_columns_before) != 2:
    raise RuntimeError(f"default/admin null icon columns: expected two anchors, found {ts.count(null_columns_before)}")
ts = ts.replace(null_columns_before, null_columns_after)
ts = replace_once(
    ts,
    '''    backgroundMedia: null,
    hasBackgroundMedia: Boolean(feature.backgroundMedia)
  }));''',
    '''    backgroundMedia: null,
    hasBackgroundMedia: Boolean(feature.backgroundMedia),
    iconMedia: null,
    hasIconMedia: Boolean(feature.iconMedia)
  }));''',
    "strip duplicate icon media from catalogue",
)
ts = replace_once(
    ts,
    '''    if (appearance.backgroundMedia) {
      totalMediaBytes += dataUrlByteLength(appearance.backgroundMedia);
      if (totalMediaBytes > MAX_LAYOUT_MEDIA_BYTES) return secureJson({ ok: false, message: 'Tile pictures and GIFs may use up to 8 MB across one dashboard layout.' }, { status: 400 });
    }''',
    '''    if (appearance.backgroundMedia) totalMediaBytes += dataUrlByteLength(appearance.backgroundMedia);
    if (appearance.iconMedia) totalMediaBytes += dataUrlByteLength(appearance.iconMedia);
    if (totalMediaBytes > MAX_LAYOUT_MEDIA_BYTES) return secureJson({ ok: false, message: 'Tile backgrounds and icon pictures may use up to 8 MB across one dashboard layout.' }, { status: 400 });''',
    "count icon media bytes",
)
ts = replace_once(
    ts,
    '''if (!appearance) return secureJson({ ok: false, message: 'Choose a valid tile background, text colour, font, border and media file.' }, { status: 400 });''',
    '''if (!appearance) return secureJson({ ok: false, message: 'Choose valid tile and icon colours, text, picture files and display modes.' }, { status: 400 });''',
    "icon validation response",
)
ts = replace_once(
    ts,
    '''INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,background_type,background_primary,background_secondary,background_angle,background_media,text_colour,font_family,border_colour,content_mode,custom_title,custom_icon,media_fit,media_overlay,pinned_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, tile.colour ?? 'default', tile.backgroundType, tile.backgroundPrimary, tile.backgroundSecondary, tile.backgroundAngle, tile.backgroundMedia, tile.textColour, tile.fontFamily, tile.borderColour, tile.contentMode, tile.customTitle, tile.customIcon, tile.mediaFit, tile.mediaOverlay, now, now));''',
    '''INSERT INTO user_dashboard_tiles(user_id,feature_id,position,size,grid_x,grid_y,tile_width,tile_height,tile_colour,background_type,background_primary,background_secondary,background_angle,background_media,text_colour,font_family,border_colour,content_mode,custom_title,custom_icon,media_fit,media_overlay,icon_mode,icon_label,icon_media,icon_text_colour,icon_background_colour,icon_border_colour,icon_media_fit,pinned_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(user.id, tile.featureId, position, legacySizeForDimension(tile.width, tile.height), tile.x, tile.y, tile.width, tile.height, tile.colour ?? 'default', tile.backgroundType, tile.backgroundPrimary, tile.backgroundSecondary, tile.backgroundAngle, tile.backgroundMedia, tile.textColour, tile.fontFamily, tile.borderColour, tile.contentMode, tile.customTitle, tile.customIcon, tile.mediaFit, tile.mediaOverlay, tile.iconMode, tile.iconLabel, tile.iconMedia, tile.iconTextColour, tile.iconBackgroundColour, tile.iconBorderColour, tile.iconMediaFit, now, now));''',
    "persist icon appearance",
)
ts = replace_once(
    ts,
    '''hasCustomIcon: Boolean(tile.customIcon), mediaFit: tile.mediaFit, mediaOverlay: tile.mediaOverlay''',
    '''hasCustomIcon: Boolean(tile.customIcon), mediaFit: tile.mediaFit, mediaOverlay: tile.mediaOverlay, iconMode: tile.iconMode, iconLabel: tile.iconLabel, hasIconMedia: Boolean(tile.iconMedia), iconTextColour: tile.iconTextColour, iconBackgroundColour: tile.iconBackgroundColour, iconBorderColour: tile.iconBorderColour, iconMediaFit: tile.iconMediaFit''',
    "audit icon appearance",
)
ts_path.write_text(ts)

print("Standard tile icon customization applied.")
