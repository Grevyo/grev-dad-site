import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function replaceFirst(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before === after) throw new Error(`No changes produced for ${path}`);
  fs.writeFileSync(path, after);
}

patch('src/dashboard.ts', source => {
  source = replaceOnce(
    source,
    "  const presentationValue = String(data.presentation ?? 'action');\n  const presentation = (['action', 'content'].includes(presentationValue) ? presentationValue : 'action') as TilePresentation;",
    "  const hasPresentation = Object.prototype.hasOwnProperty.call(data, 'presentation');\n  const presentationValue = String(data.presentation ?? 'action');\n  const presentation = hasPresentation\n    ? (['action', 'content'].includes(presentationValue) ? presentationValue : 'action') as TilePresentation\n    : null;",
    'optional presentation normalization'
  );
  source = replaceOnce(
    source,
    "  const input = normalizedFeatureInput(data);\n  if (!/^[a-z0-9]+",
    "  const input = normalizedFeatureInput(data);\n  let presentation: TilePresentation = input.presentation ?? 'action';\n  if (!/^[a-z0-9]+",
    'presentation working value'
  );
  source = replaceOnce(
    source,
    "    const existing = await env.DB.prepare(`SELECT id FROM dashboard_features WHERE id=?`).bind(featureId).first<{ id: string }>();\n    if (!existing) return secureJson({ ok: false, message: 'Dashboard feature not found.' }, { status: 404 });\n    statements.push(env.DB.prepare(`",
    "    const existing = await env.DB.prepare(`SELECT id,tile_presentation FROM dashboard_features WHERE id=?`).bind(featureId).first<{ id: string; tile_presentation: string }>();\n    if (!existing) return secureJson({ ok: false, message: 'Dashboard feature not found.' }, { status: 404 });\n    presentation = input.presentation ?? (existing.tile_presentation === 'content' ? 'content' : 'action');\n    statements.push(env.DB.prepare(`",
    'preserve stored presentation on update'
  );
  source = replaceFirst(source, 'input.featureType, input.presentation, input.route', 'input.featureType, presentation, input.route', 'update presentation bind');
  source = replaceFirst(source, 'input.featureType, input.presentation, input.route', 'input.featureType, presentation, input.route', 'insert presentation bind');
  source = replaceOnce(source, 'presentation: input.presentation, audience:', 'presentation, audience:', 'audit presentation');
  return source;
});

patch('public/dashboard.js', source => {
  source = replaceOnce(source, "  if (feature.slug === 'profile') return createProfileTileContent(feature, editing);", "  if (feature.id === 'feature-profile') return createProfileTileContent(feature, editing);", 'stable profile id');
  source = replaceOnce(source, "  if (feature.slug === 'grev-news') return createNewsTileContent(feature, editing);", "  if (feature.id === 'feature-grev-news') return createNewsTileContent(feature, editing);", 'stable news id');
  return source;
});

console.log('Action/content review fixes applied.');
