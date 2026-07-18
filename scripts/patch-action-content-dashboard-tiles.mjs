import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Patch anchor is not unique: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function replaceRegexOnce(source, pattern, after, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`Expected one regex match for ${label}, found ${matches.length}`);
  return source.replace(pattern, after);
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
    "type TileColour = 'default' | 'graphite' | 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'pink';\ntype Dimension = { width: number; height: number };",
    "type TileColour = 'default' | 'graphite' | 'blue' | 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'pink';\ntype TilePresentation = 'action' | 'content';\ntype Dimension = { width: number; height: number };",
    'tile presentation type'
  );
  source = replaceOnce(
    source,
    "  feature_type: 'workspace' | 'link' | 'system';\n  route: string;",
    "  feature_type: 'workspace' | 'link' | 'system';\n  tile_presentation: TilePresentation;\n  route: string;",
    'feature row presentation'
  );
  source = replaceOnce(
    source,
    "    featureType: row.feature_type,\n    route: row.route,",
    "    featureType: row.feature_type,\n    presentation: row.tile_presentation === 'content' ? 'content' : 'action',\n    route: row.route,",
    'feature payload presentation'
  );
  source = replaceOnce(
    source,
    "    ok: true,\n    grid: { columns: GRID_COLUMNS, maxY: MAX_GRID_Y, dimensions: ALL_DIMENSIONS },",
    "    ok: true,\n    viewer: { id: user.id, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin, isOwner: user.isOwner },\n    grid: { columns: GRID_COLUMNS, maxY: MAX_GRID_Y, dimensions: ALL_DIMENSIONS },",
    'dashboard viewer payload'
  );
  source = replaceOnce(
    source,
    "  const featureType = (['workspace', 'link', 'system'].includes(featureTypeValue) ? featureTypeValue : 'workspace') as 'workspace' | 'link' | 'system';\n  const audienceValue = String(data.audience ?? 'groups');",
    "  const featureType = (['workspace', 'link', 'system'].includes(featureTypeValue) ? featureTypeValue : 'workspace') as 'workspace' | 'link' | 'system';\n  const presentationValue = String(data.presentation ?? 'action');\n  const presentation = (['action', 'content'].includes(presentationValue) ? presentationValue : 'action') as TilePresentation;\n  const audienceValue = String(data.audience ?? 'groups');",
    'normalize presentation'
  );
  source = replaceOnce(
    source,
    "    slug, name, description, category, featureType, audience, defaultDimension, allowedDimensions,\n    route, iconText, groupIds,",
    "    slug, name, description, category, featureType, presentation, audience, defaultDimension, allowedDimensions,\n    route, iconText, groupIds,",
    'return normalized presentation'
  );
  source = replaceOnce(
    source,
    "      SET slug=?,name=?,description=?,category=?,feature_type=?,route=?,icon_text=?,audience=?,default_size=?,allowed_sizes=?,default_width=?,default_height=?,allowed_dimensions=?,is_active=?,is_default=?,sort_order=?,updated_at=?\n      WHERE id=?\n    `).bind(input.slug, input.name, input.description, input.category, input.featureType, input.route, input.iconText, input.audience, legacySize, legacySize, input.defaultDimension.width, input.defaultDimension.height, input.allowedDimensions.join(','), input.isActive ? 1 : 0, input.isDefault ? 1 : 0, input.sortOrder, now, id));",
    "      SET slug=?,name=?,description=?,category=?,feature_type=?,tile_presentation=?,route=?,icon_text=?,audience=?,default_size=?,allowed_sizes=?,default_width=?,default_height=?,allowed_dimensions=?,is_active=?,is_default=?,sort_order=?,updated_at=?\n      WHERE id=?\n    `).bind(input.slug, input.name, input.description, input.category, input.featureType, input.presentation, input.route, input.iconText, input.audience, legacySize, legacySize, input.defaultDimension.width, input.defaultDimension.height, input.allowedDimensions.join(','), input.isActive ? 1 : 0, input.isDefault ? 1 : 0, input.sortOrder, now, id));",
    'update feature presentation'
  );
  source = replaceOnce(
    source,
    "      INSERT INTO dashboard_features(id,slug,name,description,category,feature_type,route,icon_text,audience,default_size,allowed_sizes,default_width,default_height,allowed_dimensions,is_active,is_default,sort_order,created_at,updated_at)\n      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n    `).bind(id, input.slug, input.name, input.description, input.category, input.featureType, input.route, input.iconText, input.audience, legacySize, legacySize, input.defaultDimension.width, input.defaultDimension.height, input.allowedDimensions.join(','), input.isActive ? 1 : 0, input.isDefault ? 1 : 0, input.sortOrder, now, now));",
    "      INSERT INTO dashboard_features(id,slug,name,description,category,feature_type,tile_presentation,route,icon_text,audience,default_size,allowed_sizes,default_width,default_height,allowed_dimensions,is_active,is_default,sort_order,created_at,updated_at)\n      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n    `).bind(id, input.slug, input.name, input.description, input.category, input.featureType, input.presentation, input.route, input.iconText, input.audience, legacySize, legacySize, input.defaultDimension.width, input.defaultDimension.height, input.allowedDimensions.join(','), input.isActive ? 1 : 0, input.isDefault ? 1 : 0, input.sortOrder, now, now));",
    'insert feature presentation'
  );
  source = replaceOnce(
    source,
    "    JSON.stringify({ slug: input.slug, audience: input.audience, groupIds: input.groupIds, defaultDimension: dimensionKey(input.defaultDimension.width, input.defaultDimension.height), allowedDimensions: input.allowedDimensions }), now",
    "    JSON.stringify({ slug: input.slug, presentation: input.presentation, audience: input.audience, groupIds: input.groupIds, defaultDimension: dimensionKey(input.defaultDimension.width, input.defaultDimension.height), allowedDimensions: input.allowedDimensions }), now",
    'audit presentation'
  );
  return source;
});

patch('public/admin-dashboard.html', source => replaceOnce(
  source,
  '<label>Feature type<select id="dashboard-feature-type"><option value="workspace">Workspace</option><option value="link">Internal link</option><option value="system">System feature</option></select></label>\n<label>Audience<select id="dashboard-feature-audience">',
  '<label>Feature type<select id="dashboard-feature-type"><option value="workspace">Workspace</option><option value="link">Internal link</option><option value="system">System feature</option></select></label>\n<label>Tile style<select id="dashboard-feature-presentation"><option value="action">Action button</option><option value="content">Information tile</option></select></label>\n<label>Audience<select id="dashboard-feature-audience">',
  'admin presentation field'
));

patch('public/admin-dashboard.js', source => {
  source = replaceOnce(
    source,
    "    details.textContent = `${feature.category} · ${feature.defaultDimension} · ${feature.audience} · ${feature.isActive ? 'enabled' : 'disabled'}`;",
    "    details.textContent = `${feature.category} · ${feature.presentation === 'content' ? 'information' : 'button'} · ${feature.defaultDimension} · ${feature.audience} · ${feature.isActive ? 'enabled' : 'disabled'}`;",
    'admin list presentation'
  );
  source = replaceOnce(
    source,
    "  adminDashboardElement('#dashboard-feature-type').value = 'workspace';\n  adminDashboardElement('#dashboard-feature-audience').value = 'groups';",
    "  adminDashboardElement('#dashboard-feature-type').value = 'workspace';\n  adminDashboardElement('#dashboard-feature-presentation').value = 'action';\n  adminDashboardElement('#dashboard-feature-audience').value = 'groups';",
    'clear presentation'
  );
  source = replaceOnce(
    source,
    "  adminDashboardElement('#dashboard-feature-type').value = feature.featureType;\n  adminDashboardElement('#dashboard-feature-audience').value = feature.audience;",
    "  adminDashboardElement('#dashboard-feature-type').value = feature.featureType;\n  adminDashboardElement('#dashboard-feature-presentation').value = feature.presentation ?? 'action';\n  adminDashboardElement('#dashboard-feature-audience').value = feature.audience;",
    'fill presentation'
  );
  source = replaceOnce(
    source,
    "    featureType: adminDashboardElement('#dashboard-feature-type').value,\n    audience: adminDashboardElement('#dashboard-feature-audience').value,",
    "    featureType: adminDashboardElement('#dashboard-feature-type').value,\n    presentation: adminDashboardElement('#dashboard-feature-presentation').value,\n    audience: adminDashboardElement('#dashboard-feature-audience').value,",
    'submit presentation'
  );
  return source;
});

patch('public/dashboard.html', source => replaceOnce(
  source,
  'Show descriptions where space allows',
  'Show information-tile descriptions where space allows',
  'description preference wording'
));

patch('public/dashboard.js', source => {
  const replacement = `function tileSurface(feature, editing, className) {
  const route = tileRoute(feature);
  const element = document.createElement(!editing && route ? 'a' : 'div');
  element.className = \`dashboard-tile-content \${className}\`;
  if (!editing && route) {
    element.href = route;
    element.setAttribute('aria-label', \`Open \${feature.name}\`);
  }
  return element;
}

function createActionTileContent(feature, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-action-tile');
  const icon = document.createElement('span');
  icon.className = 'dashboard-action-icon';
  icon.textContent = feature.iconText;
  const title = document.createElement('strong');
  title.className = 'dashboard-action-title';
  title.textContent = feature.name;
  const arrow = document.createElement('span');
  arrow.className = 'dashboard-action-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '→';
  content.append(icon, title, arrow);
  return content;
}

function viewerInitials(viewer) {
  return String(viewer?.displayName ?? viewer?.username ?? 'GD')
    .trim()
    .split(/\\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase() || 'GD';
}

function createProfileTileContent(feature, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-content-tile dashboard-profile-tile');
  const viewer = dashboardState.payload?.viewer ?? {};
  const label = document.createElement('span');
  label.className = 'dashboard-content-label';
  label.textContent = 'YOUR PROFILE';
  const card = document.createElement('div');
  card.className = 'dashboard-profile-card';
  const avatar = document.createElement('span');
  avatar.className = 'dashboard-profile-avatar';
  avatar.textContent = viewerInitials(viewer);
  const identity = document.createElement('div');
  identity.className = 'dashboard-profile-identity';
  const name = document.createElement('strong');
  name.textContent = viewer.displayName ?? feature.name;
  const username = document.createElement('span');
  username.textContent = viewer.username ? \`@\${viewer.username}\` : 'Profile';
  identity.append(name, username);
  const role = document.createElement('span');
  role.className = 'dashboard-profile-role';
  role.textContent = viewer.isOwner ? 'Owner' : viewer.isAdmin ? 'Administrator' : 'Member';
  card.append(avatar, identity, role);
  const action = document.createElement('span');
  action.className = 'dashboard-content-action';
  action.textContent = editing ? 'PROFILE CARD PREVIEW' : 'View profile →';
  content.append(label, card, action);
  return content;
}

function createNewsTileContent(feature, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-content-tile dashboard-news-tile');
  const heading = document.createElement('div');
  heading.className = 'dashboard-content-heading';
  const label = document.createElement('span');
  label.className = 'dashboard-content-label';
  label.textContent = 'LATEST GREV NEWS';
  const icon = document.createElement('span');
  icon.className = 'dashboard-content-icon';
  icon.textContent = feature.iconText;
  heading.append(label, icon);
  const headline = document.createElement('strong');
  headline.className = 'dashboard-news-headline';
  headline.textContent = 'No Grev News has been published yet.';
  const action = document.createElement('span');
  action.className = 'dashboard-content-action';
  action.textContent = editing ? 'NEWS FEED PREVIEW' : 'Open Grev News →';
  content.append(heading, headline, action);
  return content;
}

function createGenericContentTile(feature, preferences, editing = false) {
  const content = tileSurface(feature, editing, 'dashboard-content-tile dashboard-generic-content-tile');
  const heading = document.createElement('div');
  heading.className = 'dashboard-content-heading';
  const label = document.createElement('span');
  label.className = 'dashboard-content-label';
  label.textContent = feature.category;
  const icon = document.createElement('span');
  icon.className = 'dashboard-content-icon';
  icon.textContent = feature.iconText;
  heading.append(label, icon);
  const title = document.createElement('strong');
  title.className = 'dashboard-content-title';
  title.textContent = feature.name;
  content.append(heading, title);
  if (preferences.showDescriptions && feature.description) {
    const description = document.createElement('p');
    description.className = 'dashboard-content-description';
    description.textContent = feature.description;
    content.append(description);
  }
  const action = document.createElement('span');
  action.className = 'dashboard-content-action';
  action.textContent = editing ? 'INFORMATION TILE PREVIEW' : 'Open →';
  content.append(action);
  return content;
}

function createTileContent(feature, preferences, editing = false) {
  if (feature.presentation !== 'content') return createActionTileContent(feature, editing);
  if (feature.slug === 'profile') return createProfileTileContent(feature, editing);
  if (feature.slug === 'grev-news') return createNewsTileContent(feature, editing);
  return createGenericContentTile(feature, preferences, editing);
}

function createDashboardTile`;
  source = replaceRegexOnce(
    source,
    /function createTileContent\(feature, preferences, editing = false\) \{[\s\S]*?\n\}\n\nfunction createDashboardTile/,
    replacement,
    'dashboard tile renderer'
  );
  source = replaceOnce(
    source,
    "  article.dataset.colour = TILE_COLOURS.has(feature.colour ?? feature.tileColour) ? (feature.colour ?? feature.tileColour) : 'default';\n  article.style.gridColumn",
    "  article.dataset.colour = TILE_COLOURS.has(feature.colour ?? feature.tileColour) ? (feature.colour ?? feature.tileColour) : 'default';\n  article.dataset.presentation = feature.presentation === 'content' ? 'content' : 'action';\n  article.style.gridColumn",
    'tile presentation dataset'
  );
  return source;
});

patch('public/dashboard.css', source => `${source.trimEnd()}\n\n/* Action tiles are true dashboard buttons; content tiles reserve space for useful live information. */\n.dashboard-tile[data-presentation="action"]{cursor:pointer}\n.dashboard-action-tile{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:1fr;align-items:center;gap:16px;width:100%;height:100%;padding:18px;color:var(--text);text-decoration:none;box-sizing:border-box}\n.dashboard-action-tile:focus-visible{outline:2px solid var(--tile-accent);outline-offset:-4px}\n.dashboard-action-icon,.dashboard-content-icon{display:grid;place-items:center;width:48px;height:48px;border:1px solid var(--tile-border-strong);background:var(--tile-accent);color:#080b0f;font-weight:950;letter-spacing:-.04em}\n.dashboard-action-title{min-width:0;font-size:clamp(1rem,2.4cqw,1.65rem);line-height:1.05;overflow-wrap:anywhere}\n.dashboard-action-arrow{font-size:1.5rem;font-weight:950;color:var(--tile-accent)}\n.dashboard-tile[data-presentation="action"]:hover .dashboard-action-arrow{transform:translateX(4px)}\n.dashboard-tile[data-presentation="action"]:hover .dashboard-action-title{color:#fff}\n.dashboard-tile[data-presentation="action"][data-width="1"] .dashboard-action-tile{grid-template-columns:1fr;grid-template-rows:auto auto;place-content:center;justify-items:center;gap:9px;padding:10px;text-align:center}\n.dashboard-tile[data-presentation="action"][data-width="1"] .dashboard-action-icon{width:38px;height:38px;font-size:.78rem}\n.dashboard-tile[data-presentation="action"][data-width="1"] .dashboard-action-title{font-size:clamp(.82rem,8cqw,1.05rem)}\n.dashboard-tile[data-presentation="action"][data-width="1"] .dashboard-action-arrow{display:none}\n.dashboard-tile[data-presentation="action"][data-height="1"] .dashboard-action-tile{padding-top:10px;padding-bottom:10px}\n.dashboard-content-tile{display:flex;min-width:0;min-height:0;height:100%;flex-direction:column;gap:14px;padding:18px;color:var(--text);text-decoration:none;box-sizing:border-box}\n.dashboard-content-tile:focus-visible{outline:2px solid var(--tile-accent);outline-offset:-4px}\n.dashboard-content-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}\n.dashboard-content-label{color:var(--tile-accent);font-size:.67rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}\n.dashboard-content-title,.dashboard-news-headline{font-size:clamp(1.15rem,3cqw,2rem);line-height:1.08;overflow-wrap:anywhere}\n.dashboard-content-description{min-height:0;margin:0;color:var(--muted);line-height:1.5;overflow:auto}\n.dashboard-content-action{margin-top:auto;color:var(--tile-accent);font-size:.76rem;font-weight:900;letter-spacing:.06em;text-transform:uppercase}\n.dashboard-profile-card{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;min-width:0;margin:auto 0}\n.dashboard-profile-avatar{display:grid;place-items:center;width:62px;height:62px;border:1px solid var(--tile-border-strong);background:var(--tile-accent);color:#080b0f;font-size:1.15rem;font-weight:950}\n.dashboard-profile-identity{display:grid;min-width:0;gap:5px}\n.dashboard-profile-identity strong{font-size:clamp(1.05rem,3cqw,1.8rem);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.dashboard-profile-identity span{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.dashboard-profile-role{padding:6px 8px;border:1px solid var(--tile-border-strong);color:var(--tile-accent);font-size:.66rem;font-weight:900;text-transform:uppercase}\n.dashboard-tile.editing .dashboard-action-tile,.dashboard-tile.editing .dashboard-content-tile{pointer-events:none}\n.dashboard-tile.editing[data-presentation="action"]{cursor:default}\n@container dashboard-tile (max-width:220px){\n  .dashboard-profile-card{grid-template-columns:1fr;justify-items:start;gap:8px}\n  .dashboard-profile-avatar{width:42px;height:42px;font-size:.8rem}\n  .dashboard-profile-role{display:none}\n  .dashboard-content-tile{padding:12px;gap:9px}\n  .dashboard-content-icon{width:34px;height:34px;font-size:.72rem}\n  .dashboard-content-action{font-size:.62rem}\n}\n@container dashboard-tile (max-height:130px){\n  .dashboard-content-tile{padding:10px 14px;gap:7px}\n  .dashboard-content-label{font-size:.58rem}\n  .dashboard-content-icon{width:32px;height:32px;font-size:.7rem}\n  .dashboard-profile-avatar{width:40px;height:40px;font-size:.75rem}\n  .dashboard-profile-role{display:none}\n  .dashboard-news-headline{font-size:1rem}\n}\n@media(max-width:900px){\n  .dashboard-action-tile{min-height:168px}\n  .dashboard-tile[data-presentation="action"][data-width="1"] .dashboard-action-tile{grid-template-columns:auto minmax(0,1fr) auto;grid-template-rows:1fr;justify-items:stretch;text-align:left;padding:18px}\n  .dashboard-tile[data-presentation="action"][data-width="1"] .dashboard-action-arrow{display:inline}\n  .dashboard-content-tile{min-height:168px}\n}\n`);

console.log('Action and content dashboard tile patch applied.');
