import fs from 'node:fs';

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before === after) throw new Error(`No changes produced for ${path}`);
  fs.writeFileSync(path, after);
}
function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

patch('public/dashboard.js', source => replaceOnce(
  source,
`function normalizedTileAppearance(source = {}) {
  const appearance = source.appearance ?? source;`,
`function normalizedTileAppearance(source = {}) {
  const flatFields = ['backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','fontFamily','borderColour'];
  const hasFlatAppearance = flatFields.some(field => Object.prototype.hasOwnProperty.call(source, field));
  const appearance = hasFlatAppearance ? source : (source.appearance ?? source);`,
  'prefer flat working appearance'
));

patch('src/dashboard.ts', source => {
  source = replaceOnce(
    source,
`const DEFAULT_TILE_APPEARANCE: TileAppearance = {
  backgroundType: 'solid',
  backgroundPrimary: '#11161d',
  backgroundSecondary: '#5268aa',
  backgroundAngle: 135,
  backgroundMedia: null,
  textColour: '#f4f7fb',
  fontFamily: 'system',
  borderColour: '#394657'
};`,
`const DEFAULT_TILE_APPEARANCE: TileAppearance = {
  backgroundType: 'solid',
  backgroundPrimary: '#11161d',
  backgroundSecondary: '#5268aa',
  backgroundAngle: 135,
  backgroundMedia: null,
  textColour: '#f4f7fb',
  fontFamily: 'system',
  borderColour: '#394657'
};
const LEGACY_TILE_APPEARANCE: Record<TileColour, Pick<TileAppearance, 'backgroundPrimary' | 'borderColour'>> = {
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

function legacyAppearance(colour: TileColour): TileAppearance {
  const legacy = LEGACY_TILE_APPEARANCE[colour];
  return { ...DEFAULT_TILE_APPEARANCE, ...legacy };
}`,
    'legacy appearance mapping'
  );

  source = replaceOnce(
    source,
`function tileAppearanceFromInput(item: Record<string, unknown>): TileAppearance | null {
  const backgroundType = String(item.backgroundType ?? DEFAULT_TILE_APPEARANCE.backgroundType) as TileBackgroundType;
  const backgroundPrimary = String(item.backgroundPrimary ?? DEFAULT_TILE_APPEARANCE.backgroundPrimary).toLowerCase();
  const backgroundSecondary = String(item.backgroundSecondary ?? DEFAULT_TILE_APPEARANCE.backgroundSecondary).toLowerCase();
  const backgroundAngle = Number(item.backgroundAngle ?? DEFAULT_TILE_APPEARANCE.backgroundAngle);
  const backgroundMediaValue = item.backgroundMedia === null || item.backgroundMedia === undefined || item.backgroundMedia === '' ? null : String(item.backgroundMedia);
  const textColour = String(item.textColour ?? DEFAULT_TILE_APPEARANCE.textColour).toLowerCase();
  const fontFamily = String(item.fontFamily ?? DEFAULT_TILE_APPEARANCE.fontFamily) as TileFontFamily;
  const borderColour = String(item.borderColour ?? DEFAULT_TILE_APPEARANCE.borderColour).toLowerCase();`,
`function tileAppearanceFromInput(item: Record<string, unknown>): TileAppearance | null {
  const colourValue = String(item.colour ?? 'default') as TileColour;
  const legacyColour = VALID_TILE_COLOURS.has(colourValue) ? colourValue : 'default';
  const appearanceFields = ['backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia','textColour','fontFamily','borderColour'];
  const hasExplicitAppearance = appearanceFields.some(field => Object.prototype.hasOwnProperty.call(item, field));
  const defaults = hasExplicitAppearance ? DEFAULT_TILE_APPEARANCE : legacyAppearance(legacyColour);
  const backgroundType = String(item.backgroundType ?? defaults.backgroundType) as TileBackgroundType;
  const backgroundPrimary = String(item.backgroundPrimary ?? defaults.backgroundPrimary).toLowerCase();
  const backgroundSecondary = String(item.backgroundSecondary ?? defaults.backgroundSecondary).toLowerCase();
  const backgroundAngle = Number(item.backgroundAngle ?? defaults.backgroundAngle);
  const backgroundMediaValue = item.backgroundMedia === null || item.backgroundMedia === undefined || item.backgroundMedia === '' ? null : String(item.backgroundMedia);
  const textColour = String(item.textColour ?? defaults.textColour).toLowerCase();
  const fontFamily = String(item.fontFamily ?? defaults.fontFamily) as TileFontFamily;
  const borderColour = String(item.borderColour ?? defaults.borderColour).toLowerCase();`,
    'legacy client appearance fallback'
  );

  source = replaceOnce(
    source,
`    ...appearance,
    appearance,
    accessGroups: row.matched_groups ? row.matched_groups.split(', ') : []`,
`    ...appearance,
    accessGroups: row.matched_groups ? row.matched_groups.split(', ') : []`,
    'remove nested appearance duplication'
  );

  source = replaceOnce(
    source,
`  const features = rows.map(featureFromRow);
  return {
    ok: true,`,
`  const hydratedFeatures = rows.map(featureFromRow);
  const pinnedTiles = hydratedFeatures
    .filter(feature => feature.pinned)
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
  const features = hydratedFeatures.map(feature => ({
    ...feature,
    backgroundMedia: null,
    hasBackgroundMedia: Boolean(feature.backgroundMedia)
  }));
  return {
    ok: true,`,
    'separate catalogue and pinned media shapes'
  );

  source = replaceOnce(
    source,
`    features,
    pinnedTiles: features.filter(feature => feature.pinned).sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0)),`,
`    features,
    pinnedTiles,`,
    'return pinned media once'
  );
  return source;
});

console.log('Tile appearance review findings addressed.');
