const SESSION_COOKIE = 'session_token';
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 100000;
const SITE_CURRENCY_NAME = 'Grev Coins';
const FALLBACK_STARTING_COINS = 1000;
const FALLBACK_DEFAULT_NEW_USER_ROLE = 'admin';
const ALLOWED_STATUSES = new Set(['active', 'disabled']);
const UNLOCK_TYPES = new Set(['achievement', 'badge', 'trophy', 'minigame', 'cosmetic', 'other']);
const UNLOCK_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']);
const SHOWCASE_SLOT_MIN = 1;
const SHOWCASE_SLOT_MAX = 4;
const SITE_NAME = 'grev.dad';
const SETTING_KEYS = new Set(['registration_enabled', 'default_new_user_role', 'starting_coins', 'maintenance_mode']);
const ROLES = { admin: { label: 'Admin', level: 100 }, operator: { label: 'Operator', level: 80 }, og: { label: 'OG', level: 50 }, member: { label: 'Member', level: 10 } };
const PUBLIC_HTML_PATHS = new Set(['/unregistered.html', '/login.html', '/register.html']);
const PUBLIC_API_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/logout', '/api/auth/me']);
const TILE_MINIMUM_SIZES = { 'profile-snapshot': { minW: 2, minH: 1 }, 'quick-actions': { minW: 2, minH: 1 }, 'grev-dad-tutorial': { minW: 4, minH: 2 }, 'profile-completion': { minW: 2, minH: 1 }, 'members-preview': { minW: 2, minH: 1 }, chat: { minW: 4, minH: 4 }, 'coming-later': { minW: 2, minH: 1 }, status: { minW: 2, minH: 1 }, 'profile-status': { minW: 4, minH: 1 }, 'showcase-preview': { minW: 4, minH: 1 }, 'leaderboard-preview': { minW: 4, minH: 1 }, 'member-spotlight': { minW: 3, minH: 2 }, 'site-notices': { minW: 4, minH: 1 }, 'admin-quick-tools': { minW: 4, minH: 1 }, links: { minW: 2, minH: 1 }, blank: { minW: 1, minH: 1 } };
const HOMEPAGE_TILE_SIZE_OPTIONS = ['1x1','2x1','1x2','2x2','3x2','4x1','2x3','3x3','4x2','2x4','4x3','3x4','4x4','5x3','3x5','5x4','4x5','5x5','6x4','4x6','6x5','5x6','6x6','8x4','4x8','8x6','6x8','8x8','10x6','6x10','10x8','8x10','12x6','12x8','12x12'];
const LEETIFY_CARD_TOGGLE_FIELDS = ['card_show_leetify_rank','card_show_leetify_rating','card_show_leetify_steam_id','card_show_leetify_avatar','card_show_leetify_name','card_show_leetify_aim','card_show_leetify_positioning','card_show_leetify_utility','card_show_leetify_clutch','card_show_leetify_opening','card_show_leetify_recent_matches','card_show_leetify_premier','card_show_leetify_map_ranks','card_show_leetify_updated'];
const LEETIFY_CARD_TILE_KEYS = ['leetify'];
const PROFILE_LINK_CARD_TILE_KEYS = new Set(['links_1','links_2','links_3']);
const CS_CARD_TILE_KEYS = ['cs2_overview','cs2_premier_overview','cs2_competitive_overview','cs2_wingman_overview','cs2_premier_rank','cs2_competitive_rank','cs2_wingman_rank','cs2_premier_recent_form','cs2_competitive_recent_form','cs2_wingman_recent_form','cs2_premier_last_match','cs2_competitive_last_match','cs2_wingman_last_match','cs2_premier_kd','cs2_competitive_kd','cs2_wingman_kd','cs2_premier_win_rate','cs2_competitive_win_rate','cs2_wingman_win_rate','cs2_premier_matches_tracked','cs2_competitive_matches_tracked','cs2_wingman_matches_tracked'];
const CARD_TILE_KEYS = new Set(['name','username','user_id','role','level','rank','xp','status','steam','refrag',...LEETIFY_CARD_TILE_KEYS,...PROFILE_LINK_CARD_TILE_KEYS,...CS_CARD_TILE_KEYS]);
const PROFILE_WIDGET_KEYS = new Set(['profile-card','bio','status','steam','leetify','refrag','showcase','links','progress','achievements']);
const PROFILE_PAGE_SIZE_OPTIONS = new Set(['2x1','2x2','4x1','4x2','4x3','4x4','6x2','6x4']);
const DASHBOARD_BACKGROUND_SIZES = new Set(['cover','contain','repeat','stretch','center']);
const LEETIFY_ATTRIBUTION = 'Data Provided by Leetify';
const CS2_INTEGRATION_COLUMNS = ['leetify_profile_url','leetify_steam_id','refrag_profile_url','manual_refrag_rating','manual_refrag_counter_strafe_pct','manual_refrag_reaction_time','manual_refrag_ttd','manual_refrag_crosshair_drift','manual_refrag_last_updated_at'];
const PROFILE_LINK_VISIBILITY_KEYS = new Set(['website','steam','leetify','refrag','spotify','soundcloud','youtube_music','youtube']);
const PROFILE_LINK_SERVICE_KEYS = new Set(['website','steam','leetify','refrag','spotify','soundcloud','youtube_music','youtube']);
let accountRankCache = null;
let schemaReadyPromise = null;
let schemaReadyAt = 0;
let coreSchemaReadyPromise = null;
let coreSchemaReadyAt = 0;
const SCHEMA_READY_TTL_MS = 5 * 60 * 1000;

export default { async fetch(request, env) { try { const url = new URL(request.url);
  if (url.pathname === '/api/auth/register' && request.method === 'POST') return handleRegister(request, env);
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return handleLogin(request, env);
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') return handleLogout(request, env);
  if (url.pathname === '/api/debug/health' && request.method === 'GET') return safeJsonRoute('debug/health', () => handleDebugHealth(env));
  if (url.pathname === '/api/admin/schema/repair' && request.method === 'POST') return safeJsonRoute('admin/schema/repair', () => handleAdminSchemaRepair(request, env));
  if (url.pathname === '/api/auth/me' && request.method === 'GET') return safeJsonRoute('auth/me', () => handleMe(request, env));
  if (url.pathname === '/api/members' && request.method === 'GET') return safeJsonRoute('members', () => handleMembers(request, env));
  if (url.pathname === '/api/leaderboard/levels' && request.method === 'GET') return safeJsonRoute('leaderboard/levels', () => handleLeaderboardLevels(request, env));
  if (url.pathname === '/api/xp/me' && request.method === 'GET') return handleXpMe(request, env);
  if (url.pathname === '/api/achievements/me' && request.method === 'GET') return handleAchievementsMe(request, env);
  if (url.pathname === '/api/profile/me' && request.method === 'GET') return safeJsonRoute('profile/me', () => handleProfileMe(request, env));
  if (url.pathname === '/api/profile/me' && request.method === 'POST') return handleProfileMeUpdate(request, env);
  if (url.pathname === '/api/profile/me/card' && request.method === 'POST') return handleProfileCardMeUpdate(request, env);
  if (url.pathname === '/api/profile/cs2-connection' && request.method === 'GET') return safeJsonRoute('profile/cs2-connection', () => handleCs2ConnectionGet(request, env));
  if (url.pathname === '/api/profile/cs2-connection' && request.method === 'POST') return handleCs2ConnectionPost(request, env);
  if (url.pathname === '/api/profile/cs2-connection' && request.method === 'DELETE') return handleCs2ConnectionDelete(request, env);
  if (url.pathname === '/api/profile/faceit-connection' && request.method === 'GET') return safeJsonRoute('profile/faceit-connection', () => handleFaceitConnectionGet(request, env));
  if (url.pathname === '/api/profile/faceit-connection' && request.method === 'POST') return handleFaceitConnectionPost(request, env);
  if (url.pathname === '/api/profile/faceit-connection' && request.method === 'DELETE') return handleFaceitConnectionDelete(request, env);
  if (url.pathname === '/api/profile/cs2-sync' && request.method === 'POST') return handleCs2Sync(request, env);
  if (url.pathname === '/api/profile/faceit-sync' && request.method === 'POST') return handleFaceitSync(request, env);
  if (url.pathname === '/api/profile/external-stats' && request.method === 'GET') return safeJsonRoute('profile/external-stats', () => handleExternalStatsLookup(request, env));
  if (url.pathname === '/api/profile/me/rank' && request.method === 'POST') return handleProfileRankUpdate(request, env);
  if (url.pathname === '/api/profile/me/showcase-unlocks' && request.method === 'GET') return handleProfileMyShowcaseUnlocks(request, env);
  if (url.pathname === '/api/profile/me/unlocks' && request.method === 'GET') return handleProfileMyUnlocks(request, env);
  if (url.pathname === '/api/profile/me/showcase' && request.method === 'GET') return handleProfileMyShowcase(request, env);
  if (url.pathname === '/api/profile/me/showcase' && request.method === 'POST') return handleProfileMyShowcaseUpdate(request, env);
  if (url.pathname === '/api/profile' && request.method === 'GET') return safeJsonRoute('profile', () => handleProfileLookup(request, env));
  if (url.pathname === '/api/bootstrap/dashboard' && request.method === 'GET') return safeJsonRoute('bootstrap/dashboard', () => handleBootstrapDashboard(request, env));
  if (url.pathname === '/api/dashboard/background' && request.method === 'POST') return handleDashboardBackgroundUpdate(request, env);
  if (url.pathname === '/api/bootstrap/profile' && request.method === 'GET') return safeJsonRoute('bootstrap/profile', () => handleBootstrapProfile(request, env));
  if (url.pathname === '/api/bootstrap/edit-profile' && request.method === 'GET') return handleBootstrapEditProfile(request, env);
  if (url.pathname === '/api/profile/steam' && request.method === 'GET') return handleSteamProfile(request, env);
  if (url.pathname === '/api/integrations/steam/profile' && request.method === 'GET') return handleSteamProfile(request, env);
  if (url.pathname === '/api/integrations/leetify/profile' && request.method === 'GET') return handleLeetifyProfile(request, env);
  if (url.pathname === '/api/account' && request.method === 'GET') return handleAccount(request, env);
  if (url.pathname === '/api/account/password' && request.method === 'POST') return handleAccountPassword(request, env);
  if (url.pathname === '/api/wallet/me' && request.method === 'GET') return handleWalletMe(request, env);
  if (url.pathname === '/api/wallet/me/transactions' && request.method === 'GET') return handleWalletTransactionsMe(request, env);
  if (url.pathname === '/api/admin/users' && request.method === 'GET') return handleAdminUsers(request, env);
  if (url.pathname.match(/^\/api\/admin\/users\/\d+\/role$/) && request.method === 'POST') return handleAdminUpdateRole(request, env, url.pathname);
  if (url.pathname.match(/^\/api\/admin\/users\/\d+\/status$/) && request.method === 'POST') return handleAdminUpdateStatus(request, env, url.pathname);
  if (url.pathname.match(/^\/api\/admin\/users\/\d+\/wallet-adjust$/) && request.method === 'POST') return handleAdminWalletAdjust(request, env, url.pathname);
  if (url.pathname === '/api/admin/xp/grant' && request.method === 'POST') return handleAdminXpGrant(request, env);
  if (url.pathname === '/api/admin/achievement/grant' && request.method === 'POST') return handleAdminAchievementGrant(request, env);
  if (url.pathname === '/api/achievements/event' && request.method === 'POST') return handleAchievementEvent(request, env);
  if (url.pathname.match(/^\/api\/admin\/users\/\d+\/game-progress$/) && request.method === 'POST') return handleAdminGameProgress(request, env, url.pathname);
  if (url.pathname.match(/^\/api\/admin\/users\/\d+\/unlocks$/) && request.method === 'POST') return handleAdminUserUnlockUpsert(request, env, url.pathname);
  if (url.pathname === '/api/admin/showcase/catalog' && request.method === 'GET') return handleAdminShowcaseCatalog(request, env);
  if (url.pathname === '/api/admin/showcase/catalog' && request.method === 'POST') return handleAdminShowcaseCatalogCreate(request, env);
  if (url.pathname.match(/^\/api\/admin\/showcase\/catalog\/\d+$/) && request.method === 'POST') return handleAdminShowcaseCatalogUpdate(request, env, url.pathname);
  if (url.pathname.match(/^\/api\/admin\/showcase\/catalog\/\d+\/toggle$/) && request.method === 'POST') return handleAdminShowcaseCatalogToggle(request, env, url.pathname);
  if (url.pathname.match(/^\/api\/admin\/users\/\d+\/showcase-unlocks$/) && request.method === 'POST') return handleAdminGrantCatalogUnlock(request, env, url.pathname);
  if (url.pathname === '/api/admin/settings' && request.method === 'GET') return handleAdminGetSettings(request, env);
  if (url.pathname === '/api/admin/settings' && request.method === 'POST') return handleAdminSetSettings(request, env);
  if (url.pathname === '/api/admin/audit' && request.method === 'GET') return handleAdminAudit(request, env);
  if (url.pathname === '/api/admin/homepage-tiles' && request.method === 'GET') return handleAdminHomepageTilesGet(request, env);
  if (url.pathname.match(/^\/api\/admin\/homepage-tiles\/[^/]+$/) && request.method === 'POST') return handleAdminHomepageTilesPost(request, env, url.pathname);
  if (url.pathname === '/api/homepage/tile-config' && request.method === 'GET') return safeJsonRoute('homepage/tile-config', () => handleHomepageTileConfig(request, env));
  if (url.pathname === '/api/debug/db' && request.method === 'GET') return handleDebugDb(env);
  if (url.pathname === '/api/ranks' && request.method === 'GET') return safeJsonRoute('ranks', () => handleRanks(request, env));

  if (url.pathname === '/api/chat/rooms' && request.method === 'GET') return safeJsonRoute('chat/rooms', () => handleChatRooms(request, env));
  if (url.pathname === '/api/chat/messages' && request.method === 'GET') return safeJsonRoute('chat/messages', () => handleChatMessagesGet(request, env));
  if (url.pathname === '/api/chat/messages' && request.method === 'POST') return handleChatMessagesPost(request, env);
  if (url.pathname === '/api/chat/direct' && request.method === 'POST') return handleChatDirect(request, env);
  if (url.pathname === '/api/chat/read' && request.method === 'POST') return handleChatRead(request, env);
  if (url.pathname.match(/^\/api\/admin\/chat\/messages\/\d+\/delete$/) && request.method === 'POST') return handleAdminChatDelete(request, env, url.pathname);
  const authGateResponse = await enforceAuthGate(request, env, url.pathname); if (authGateResponse) return authGateResponse; return env.ASSETS.fetch(request);
} catch (error) {
  console.error('[worker] unhandled route error', { message: error?.message || String(error), stack: error?.stack || '' });
  return json({ ok: false, error: 'Internal server error', detail: friendlyError(error) }, 500);
}}};

async function safeJsonRoute(name, fn) {
  try {
    return await fn();
  } catch (error) {
    console.error(`[api/${name}] failed`, { message: error?.message || String(error), stack: error?.stack || '' });
    return json({ ok: false, error: friendlyError(error) }, 500);
  }
}

async function handleAdminSchemaRepair(request, env) {
  const db = getDatabase(env);
  await ensureCoreSchemaOnce(db);
  const auth = await requireAdmin(request, env);
  if (auth) return auth;
  await ensureSchema(db);
  return json({ ok: true, repaired: true, timestamp: new Date().toISOString() });
}

async function tableExists(db, tableName) {
  const row = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").bind(tableName).first();
  return Boolean(row?.name);
}

const SETTINGS_TABLE_NAMES = new Set(['user_profile_settings', 'user_profile_card_settings', 'user_dashboard_settings', 'user_profile_page_settings']);
const BASE_PROFILE_DEFAULTS = {
  user_id: null,
  display_name: '',
  profile_title: '',
  bio: '',
  location: '',
  avatar_url: '',
  banner_url: '',
  banner_display_size: 'wide',
  website_url: '',
  steam_url: '',
  spotify_url: '',
  soundcloud_url: '',
  youtube_music_url: '',
  youtube_url: '',
  profile_links_visibility_json: '{}',
  leetify_url: '',
  leetify_profile_url: '',
  leetify_steam_id: '',
  refrag_url: '',
  refrag_profile_url: '',
  manual_refrag_rating: '',
  manual_refrag_counter_strafe_pct: '',
  manual_refrag_reaction_time: '',
  manual_refrag_ttd: '',
  manual_refrag_crosshair_drift: '',
  manual_refrag_last_updated_at: '',
  manual_leetify_name: '',
  manual_leetify_steam_id: '',
  manual_leetify_cs_rank: '',
  manual_leetify_premier_rating: '',
  manual_leetify_rating: '',
  manual_leetify_aim_rating: '',
  manual_leetify_positioning_rating: '',
  manual_leetify_utility_rating: '',
  manual_leetify_clutch_rating: '',
  manual_leetify_opening_duel_rating: '',
  manual_leetify_recent_matches_count: '',
  manual_leetify_map_ranks: '',
  manual_leetify_last_updated_at: '',
  status_message: '',
  favourite_colour: '',
  profile_background_url: '',
  profile_background_size: 'cover',
  profile_accent_colour: '',
  profile_background_colour: '',
  profile_layout: 'standard',
  profile_quote: '',
  favourite_game: '',
  profile_visibility: 'public',
  show_level: 1,
  show_rank: 1,
  show_badges: 1,
  show_last_active: 0,
  show_member_card: 1,
  show_profile_showcase: 1,
  show_profile_xp: 1,
  show_profile_user_id: 0,
  show_joined_date: 1,
  show_header_avatar: 1,
  show_header_display_name: 1,
  show_header_username: 1,
  show_header_user_id: 0,
  show_header_level: 1,
  show_header_rank: 1,
  show_header_xp_bar: 1,
  profile_page_background_url: '',
  profile_page_background_colour: '',
  profile_page_background_size: 'cover',
  profile_page_overlay_strength: 20,
  profile_page_tile_layout_json: '',
  profile_page_widget_settings_json: '',
  profile_footer_url: '',
  profile_footer_display_size: 'wide',
  card_background_url: '',
  card_background_colour: '',
  card_accent_colour: '',
  card_border_colour: '',
  card_text_colour: '',
  card_body_text_colour: '',
  card_layout: 'standard',
  card_grid_columns: 4,
  card_tile_settings_json: '',
  card_show_avatar: 1,
  card_show_display_name: 1,
  card_show_username: 1,
  card_show_user_id: 0,
  card_show_role: 1,
  card_show_level: 1,
  card_show_rank: 1,
  card_show_xp: 1,
  card_show_status: 0,
  card_show_steam: 0,
  card_show_refrag: 0,
  card_show_leetify: 0,
  card_show_leetify_rank: 0,
  card_show_leetify_rating: 0,
  card_show_leetify_steam_id: 0,
  card_show_leetify_avatar: 0,
  card_show_leetify_name: 0,
  card_show_leetify_aim: 0,
  card_show_leetify_positioning: 0,
  card_show_leetify_utility: 0,
  card_show_leetify_clutch: 0,
  card_show_leetify_opening: 0,
  card_show_leetify_recent_matches: 0,
  card_show_leetify_premier: 0,
  card_show_leetify_map_ranks: 0,
  card_show_leetify_updated: 0,
  dashboard_background_colour: '',
  dashboard_background_url: '',
  dashboard_background_size: 'cover',
  dashboard_background_overlay_strength: 0,
  selected_rank_id: null,
  updated_at: '',
  account_xp: 0
};
const LEGACY_PROFILE_FIELDS = ['display_name','profile_title','bio','location','avatar_url','banner_url','banner_display_size','website_url','steam_url','spotify_url','soundcloud_url','youtube_music_url','profile_links_visibility_json','leetify_url','refrag_url','status_message','favourite_colour','profile_background_url','profile_background_size','profile_accent_colour','profile_background_colour','profile_layout','show_level','show_rank','show_badges','show_last_active'];
const EXTENSIBLE_PROFILE_FIELDS = ['youtube_url','leetify_profile_url','leetify_steam_id','refrag_profile_url','manual_refrag_rating','manual_refrag_counter_strafe_pct','manual_refrag_reaction_time','manual_refrag_ttd','manual_refrag_crosshair_drift','manual_refrag_last_updated_at','manual_leetify_name','manual_leetify_steam_id','manual_leetify_cs_rank','manual_leetify_premier_rating','manual_leetify_rating','manual_leetify_aim_rating','manual_leetify_positioning_rating','manual_leetify_utility_rating','manual_leetify_clutch_rating','manual_leetify_opening_duel_rating','manual_leetify_recent_matches_count','manual_leetify_map_ranks','manual_leetify_last_updated_at'];
const PROFILE_PAGE_SETTING_FIELDS = ['profile_page_background_url','profile_page_background_colour','profile_page_background_size','profile_page_overlay_strength','profile_page_tile_layout_json','profile_page_widget_settings_json','profile_footer_url','profile_footer_display_size'];
const PROFILE_CARD_SETTING_FIELDS = ['card_background_url','card_background_colour','card_accent_colour','card_border_colour','card_text_colour','card_body_text_colour','card_layout','card_grid_columns','card_tile_settings_json','card_show_avatar','card_show_display_name','card_show_username','card_show_user_id','card_show_role','card_show_level','card_show_rank','card_show_xp','card_show_status','card_show_steam','card_show_refrag','card_show_leetify',...LEETIFY_CARD_TOGGLE_FIELDS];
const DASHBOARD_SETTING_FIELDS = ['dashboard_background_colour','dashboard_background_url','dashboard_background_size','dashboard_background_overlay_strength','tileStyles'];

function safeJsonParse(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function pickFields(source, names) {
  const out = {};
  for (const name of names) if (Object.prototype.hasOwnProperty.call(source || {}, name)) out[name] = source[name];
  return out;
}

async function getUserProfileColumnSet(db) {
  const rows = await db.prepare('PRAGMA table_info(user_profiles)').all();
  return new Set((rows.results || []).map((r) => r.name));
}

async function readUserProfileBase(db, userId) {
  await db.prepare(`
    INSERT INTO user_profiles (user_id)
    VALUES (?)
    ON CONFLICT(user_id) DO NOTHING
  `).bind(userId).run();

  const existing = await getUserProfileColumnSet(db);
  const wanted = Object.keys(BASE_PROFILE_DEFAULTS).filter((name) => existing.has(name));
  const selectList = wanted.length ? wanted.map((name) => `"${name}"`).join(', ') : 'user_id';
  const row = await db.prepare(`SELECT ${selectList} FROM user_profiles WHERE user_id = ?`).bind(userId).first();
  return { ...BASE_PROFILE_DEFAULTS, ...(row || {}), user_id: userId };
}

async function readSettingsJson(db, tableName, userId) {
  if (!SETTINGS_TABLE_NAMES.has(tableName)) throw new Error('Invalid settings table');
  try {
    const row = await db.prepare(`SELECT settings_json FROM ${tableName} WHERE user_id = ?`).bind(userId).first();
    return safeJsonParse(row?.settings_json, {});
  } catch (error) {
    console.warn('[settings] failed reading settings table', tableName, error?.message || error);
    return {};
  }
}

async function writeSettingsJson(db, tableName, userId, settings) {
  if (!SETTINGS_TABLE_NAMES.has(tableName)) throw new Error('Invalid settings table');
  await db.prepare(`
    INSERT INTO ${tableName} (user_id, settings_json, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      settings_json = excluded.settings_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(userId, JSON.stringify(settings || {})).run();
}

async function mergeSettingsJson(db, tableName, userId, patch) {
  const existing = await readSettingsJson(db, tableName, userId);
  const merged = { ...existing, ...(patch || {}) };
  await writeSettingsJson(db, tableName, userId, merged);
  return merged;
}

async function updateExistingProfileColumns(db, userId, values) {
  const existing = await getUserProfileColumnSet(db);
  const entries = Object.entries(values || {}).filter(([key]) => existing.has(key));
  if (!entries.length) return;
  const setSql = entries.map(([key]) => `"${key}" = ?`).join(', ');
  const binds = entries.map(([, value]) => value);
  await db.prepare(`UPDATE user_profiles SET ${setSql} WHERE user_id = ?`).bind(...binds, userId).run();
}

async function getSafeProfileSettings(db, userId) {
  const base = await readUserProfileBase(db, userId);
  const extraProfile = await readSettingsJson(db, 'user_profile_settings', userId);
  const cardSettings = await readSettingsJson(db, 'user_profile_card_settings', userId);
  const dashboardSettings = await readSettingsJson(db, 'user_dashboard_settings', userId);
  const profilePageSettings = await readSettingsJson(db, 'user_profile_page_settings', userId);
  const profile = { ...base, ...extraProfile, ...cardSettings, ...dashboardSettings, ...profilePageSettings };
  profile.leetify_profile_url = profile.leetify_profile_url || profile.leetify_url || '';
  profile.leetify_url = profile.leetify_url || profile.leetify_profile_url || '';
  profile.refrag_profile_url = profile.refrag_profile_url || profile.refrag_url || '';
  profile.refrag_url = profile.refrag_url || profile.refrag_profile_url || '';
  profile.card_tile_settings_json = profile.card_tile_settings_json || (profile.cardTileSettings ? JSON.stringify(profile.cardTileSettings) : '');
  profile.cardTileSettings = normalizeCardTileSettings(profile.card_tile_settings_json || profile.cardTileSettings || '');
  return profile;
}

async function ensureSettingsTables(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS user_profile_settings (user_id INTEGER PRIMARY KEY, settings_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS user_profile_card_settings (user_id INTEGER PRIMARY KEY, settings_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS user_dashboard_settings (user_id INTEGER PRIMARY KEY, settings_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS user_profile_page_settings (user_id INTEGER PRIMARY KEY, settings_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
}

async function ensureExternalCsStatsTables(db) {
  // TODO: add encryption-at-rest for cs2_auth_code and latest_known_share_code when the repo has a shared secret helper.
  await db.prepare("CREATE TABLE IF NOT EXISTS cs2_match_connections (user_id TEXT PRIMARY KEY, steam_id64 TEXT, steam_profile_url TEXT, cs2_auth_code TEXT, latest_known_share_code TEXT, is_enabled INTEGER DEFAULT 1, public_stats_enabled INTEGER DEFAULT 1, last_checked_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS faceit_connections (user_id TEXT PRIMARY KEY, faceit_username TEXT, faceit_profile_url TEXT, faceit_player_id TEXT, is_enabled INTEGER DEFAULT 1, public_stats_enabled INTEGER DEFAULT 1, last_checked_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS cs2_public_stats (user_id TEXT PRIMARY KEY, premier_rating TEXT, premier_rank TEXT, last_match_map TEXT, last_match_result TEXT, last_match_score TEXT, recent_form TEXT, matches_tracked INTEGER, kd TEXT, win_rate TEXT, last_synced_at TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS cs2_mode_public_stats (user_id TEXT NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('premier', 'competitive', 'wingman')), rank_label TEXT, rating TEXT, map_group TEXT, last_match_map TEXT, last_match_result TEXT, last_match_score TEXT, recent_form TEXT, matches_tracked INTEGER DEFAULT 0, wins INTEGER, losses INTEGER, win_rate TEXT, kills INTEGER, deaths INTEGER, assists INTEGER, kd TEXT, last_synced_at TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, mode))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS cs2_match_history (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, mode TEXT NOT NULL CHECK (mode IN ('premier', 'competitive', 'wingman', 'unknown')), safe_match_ref TEXT, map TEXT, match_date TEXT, team_score INTEGER, enemy_score INTEGER, result TEXT, kills INTEGER, deaths INTEGER, assists INTEGER, kd TEXT, rank_at_time TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_cs2_match_history_user_mode_date ON cs2_match_history(user_id, mode, match_date)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS faceit_public_stats (user_id TEXT PRIMARY KEY, faceit_username TEXT, faceit_player_id TEXT, faceit_level INTEGER, faceit_elo INTEGER, last_match_map TEXT, last_match_result TEXT, last_match_score TEXT, recent_form TEXT, matches_tracked INTEGER, kd TEXT, win_rate TEXT, last_synced_at TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS external_cs_matches (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, source TEXT CHECK (source IN ('premier', 'faceit')), external_match_id TEXT, safe_match_ref TEXT, map TEXT, match_date TEXT, team_score INTEGER, enemy_score INTEGER, result TEXT, kills INTEGER, deaths INTEGER, assists INTEGER, kd TEXT, rank_at_time TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_external_cs_matches_user_source ON external_cs_matches(user_id, source, match_date)").run();
  for (const sql of ["ALTER TABLE cs2_public_stats ADD COLUMN kd TEXT","ALTER TABLE cs2_public_stats ADD COLUMN win_rate TEXT","ALTER TABLE faceit_public_stats ADD COLUMN kd TEXT"]) { try { await db.prepare(sql).run(); } catch {} }
}

async function handleDebugHealth(env) {
  const db = getDatabase(env);
  const coreTables = {};
  for (const table of ['users', 'sessions', 'user_profiles', 'homepage_tile_config']) {
    try { coreTables[table] = await tableExists(db, table); } catch { coreTables[table] = false; }
  }
  const settingsTables = {};
  for (const table of SETTINGS_TABLE_NAMES) {
    try { settingsTables[table] = await tableExists(db, table); } catch { settingsTables[table] = false; }
  }
  let userProfilesColumnCount = 0;
  try {
    if (coreTables.user_profiles) {
      const rows = await db.prepare('PRAGMA table_info(user_profiles)').all();
      userProfilesColumnCount = (rows.results || []).length;
    }
  } catch {}
  return json({
    ok: true,
    userProfilesColumnCount,
    warning: userProfilesColumnCount > 1800 ? 'user_profiles near/over practical column limit; using JSON settings tables' : '',
    settingsTables
  }, 200, { 'Cache-Control': 'no-store' });
}

async function handleRegister(request, env) { try { const body = await readJsonBody(request); const username = (body?.username ?? '').trim(); const password = body?.password ?? ''; if (!username || !password) return json({ ok: false, error: 'Username and password are required' }, 400); const db = getDatabase(env); await ensureSchemaOnce(db); if (!isTruthy(await getSetting(db, 'registration_enabled', 'true'))) return json({ ok: false, error: 'Registration is disabled' }, 403); const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first(); if (existing) return json({ ok: false, error: 'Username is already taken' }, 409); const defaultRole = normalizeRole(await getSetting(db, 'default_new_user_role', FALLBACK_DEFAULT_NEW_USER_ROLE)); const passwordHash = await hashPassword(password); const result = await db.prepare('INSERT INTO users (username, password_hash, role, is_admin, status) VALUES (?, ?, ?, ?, ?)').bind(username, passwordHash, defaultRole, defaultRole === 'admin' ? 1 : 0, 'active').run(); const userId = result.meta.last_row_id; await getOrCreateWallet(db, userId); await ensureStarterUnlocks(db, userId); await logAudit(db, userId, userId, 'user_registered', { username, role: defaultRole }); const user = await db.prepare('SELECT id, username, role, is_admin, status FROM users WHERE id = ?').bind(userId).first(); return json({ ok: true, user: serializeUser(user) }, 201); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleLogin(request, env) { try { const body = await readJsonBody(request); const username = (body?.username ?? '').trim(); const password = body?.password ?? ''; if (!username || !password) return json({ ok: false, error: 'Username and password are required' }, 400); const db = getDatabase(env); await ensureSchemaOnce(db); const user = await db.prepare('SELECT id, username, role, is_admin, password_hash, status FROM users WHERE username = ?').bind(username).first(); if (!user) return json({ ok: false, error: 'Invalid username or password' }, 401); if (normalizeStatus(user.status) === 'disabled') return json({ ok: false, error: 'Account disabled' }, 403); const valid = await verifyPassword(password, user.password_hash); if (!valid) return json({ ok: false, error: 'Invalid username or password' }, 401); const { token, expiresAt } = makeSessionToken(); await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expiresAt).run(); await logAudit(db, user.id, user.id, 'user_login', { username: user.username }); return withSessionCookie(json({ ok: true, user: serializeUser(user) }), token, expiresAt); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleLogout(request, env) { try { const token = getSessionToken(request); if (token) { const db = getDatabase(env); await ensureSchemaOnce(db); await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run(); } const response = json({ ok: true }); response.headers.append('Set-Cookie', clearSessionCookie()); return response; } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleMe(request, env) { try { const u = await getCurrentUserFast(request, env); if (!u) return json({ ok: false, user: null, error: 'Not logged in' }, 401); return json({ ok: true, user: { id: u.id, username: u.username, role: u.role, roleLabel: getRoleLabel(u.role), roleLevel: getRoleLevel(u.role), is_admin: u.is_admin } }, 200, {'Cache-Control':'private, max-age=15'}); } catch (error) { console.warn('[auth/me] failed', friendlyError(error)); return json({ ok: false, user: null, error: 'Not logged in' }, 401); } }

function publicProfileCardFields(row = {}) { const out = { display_name: row.display_name || null, profile_title: row.profile_title || null, avatar_url: row.avatar_url || null, status_message: row.status_message || '', website_url: row.website_url || '', steam_url: row.steam_url || '', spotify_url: row.spotify_url || '', soundcloud_url: row.soundcloud_url || '', youtube_music_url: row.youtube_music_url || '', youtube_url: row.youtube_url || '', profile_links_visibility_json: row.profile_links_visibility_json || '{}', leetify_url: row.leetify_url || row.leetify_profile_url || '', leetify_profile_url: row.leetify_profile_url || row.leetify_url || '', leetify_steam_id: row.leetify_steam_id || '', refrag_url: row.refrag_url || row.refrag_profile_url || '', refrag_profile_url: row.refrag_profile_url || row.refrag_url || '', manual_refrag_rating: row.manual_refrag_rating || '', manual_refrag_counter_strafe_pct: row.manual_refrag_counter_strafe_pct || '', manual_refrag_reaction_time: row.manual_refrag_reaction_time || '', manual_refrag_ttd: row.manual_refrag_ttd || '', manual_refrag_crosshair_drift: row.manual_refrag_crosshair_drift || '', manual_refrag_last_updated_at: row.manual_refrag_last_updated_at || '', card_background_url: row.card_background_url || '', card_background_colour: row.card_background_colour || '', card_accent_colour: row.card_accent_colour || '', card_border_colour: row.card_border_colour || '', card_text_colour: row.card_text_colour || '', card_body_text_colour: row.card_body_text_colour || '', card_layout: row.card_layout || 'standard', card_grid_columns: Number(row.card_grid_columns) || 4, card_show_avatar: row.card_show_avatar == null ? 1 : Number(row.card_show_avatar), card_show_display_name: row.card_show_display_name == null ? 1 : Number(row.card_show_display_name), card_show_username: row.card_show_username == null ? 1 : Number(row.card_show_username), card_show_user_id: row.card_show_user_id == null ? 0 : Number(row.card_show_user_id), card_show_role: row.card_show_role == null ? 1 : Number(row.card_show_role), card_show_level: row.card_show_level == null ? 1 : Number(row.card_show_level), card_show_rank: row.card_show_rank == null ? 1 : Number(row.card_show_rank), card_show_xp: row.card_show_xp == null ? 1 : Number(row.card_show_xp), card_show_status: row.card_show_status == null ? 0 : Number(row.card_show_status), card_show_steam: row.card_show_steam == null ? 0 : Number(row.card_show_steam), card_show_leetify: row.card_show_leetify == null ? 0 : Number(row.card_show_leetify), card_show_leetify_rank: row.card_show_leetify_rank == null ? 0 : Number(row.card_show_leetify_rank), card_show_leetify_rating: row.card_show_leetify_rating == null ? 0 : Number(row.card_show_leetify_rating), card_show_leetify_steam_id: row.card_show_leetify_steam_id == null ? 0 : Number(row.card_show_leetify_steam_id), card_show_leetify_avatar: row.card_show_leetify_avatar == null ? 0 : Number(row.card_show_leetify_avatar), card_show_leetify_name: row.card_show_leetify_name == null ? 0 : Number(row.card_show_leetify_name), card_show_leetify_aim: row.card_show_leetify_aim == null ? 0 : Number(row.card_show_leetify_aim), card_show_leetify_positioning: row.card_show_leetify_positioning == null ? 0 : Number(row.card_show_leetify_positioning), card_show_leetify_utility: row.card_show_leetify_utility == null ? 0 : Number(row.card_show_leetify_utility), card_show_leetify_clutch: row.card_show_leetify_clutch == null ? 0 : Number(row.card_show_leetify_clutch), card_show_leetify_opening: row.card_show_leetify_opening == null ? 0 : Number(row.card_show_leetify_opening), card_show_leetify_recent_matches: row.card_show_leetify_recent_matches == null ? 0 : Number(row.card_show_leetify_recent_matches), card_show_leetify_premier: row.card_show_leetify_premier == null ? 0 : Number(row.card_show_leetify_premier), card_show_leetify_map_ranks: row.card_show_leetify_map_ranks == null ? 0 : Number(row.card_show_leetify_map_ranks), card_show_leetify_updated: row.card_show_leetify_updated == null ? 0 : Number(row.card_show_leetify_updated), card_show_refrag: row.card_show_refrag == null ? 0 : Number(row.card_show_refrag), card_tile_settings_json: row.card_tile_settings_json || '' }; out.cardTileSettings = normalizeCardTileSettings(out.card_tile_settings_json); return out; }
async function handleMembers(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ ok: false, error: 'Not logged in' }, 401);
  const db = getDatabase(env);
  await ensureCoreSchemaOnce(db);
  const rows = await db.prepare('SELECT id, username, role, is_admin, created_at, status FROM users ORDER BY created_at DESC, id DESC').all();
  const ranks = await loadAccountRanks(request, env);
  if (!ranks.ok) return json(ranks, 500);
  const members=[];
  for (const r of (rows.results||[])) {
    const profile = await getSafeProfileSettings(db, r.id);
    if (!profile.display_name) profile.display_name = r.username;
    const progress=await getUserAccountProgress(db, r.id);
    const rank=getDisplayedRank(progress.accountLevel, profile.selected_rank_id, ranks.ranks);
    members.push({ ...serializeUser(r), created_at:r.created_at||null, ...publicProfileCardFields(profile), ...progress, rank });
  }
  return json({ ok: true, siteName: SITE_NAME, members }, 200, {'Cache-Control':'private, max-age=60'});
}
async function handleProfileMe(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ ok: false, error: 'Not logged in' }, 401);
    const bundle = await getUserProfileBundle(request, env, Number(user.id), { includeUnlockedRanks: true });
    if (!bundle) return json({ ok: false, error: 'User not found' }, 404);
    return json({ ok: true, user: serializeUser(bundle.profile), profile: bundle.profile, ranks: bundle.ranks?.ok ? bundle.ranks.ranks : [], rankLoadError: !bundle.ranks?.ok }, 200, { 'Cache-Control': 'private, max-age=15' });
  } catch (error) {
    return json({ ok: false, error: friendlyError(error) }, 500);
  }
}
async function handleProfileLookup(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ ok: false, error: 'Not logged in' }, 401);
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const usernameParam = (url.searchParams.get('user') || '').trim();
    let targetId = Number(user.id);
    if (idParam) {
      targetId = Number(idParam);
      if (!Number.isInteger(targetId) || targetId < 1) return json({ ok: false, error: 'Invalid user id' }, 400);
    } else if (usernameParam) {
      const db = getDatabase(env);
      await ensureCoreSchemaOnce(db);
      const row = await db.prepare('SELECT id FROM users WHERE username = ?').bind(usernameParam).first();
      if (!row) return json({ ok: false, error: 'User not found' }, 404);
      targetId = Number(row.id);
    } else {
      return handleProfileMe(request, env);
    }
    const bundle = await getUserProfileBundle(request, env, targetId, { includeUnlockedRanks: Number(user.id) === targetId });
    if (!bundle) return json({ ok: false, error: 'User not found' }, 404);
    return json({ ok: true, profile: bundle.profile, isOwner: String(user.id) === String(targetId), ...(bundle.ranks?.ok ? {} : { rankLoadError: bundle.ranks?.error || 'Unable to load ranks' }) });
  } catch (error) {
    console.error('[profile/lookup] failed', { message: error?.message || String(error), stack: error?.stack || '' });
    return json({ ok: false, error: friendlyError(error) }, 500);
  }
}
async function handleProfileMeUpdate(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ ok: false, error: 'Not logged in' }, 401);
    const body = await readJsonBody(request);
    const db = getDatabase(env);
    await ensureCoreSchemaOnce(db);
    const existingAppearance = await getSafeProfileSettings(db, user.id);
    const profile = normalizeProfileInput(body, existingAppearance);
    if (profile.error) return json({ ok: false, error: profile.error }, 400);
    const savedStatus = normalizeNullableString(body?.status_message, 140);
    const legacyValues = { ...pickFields(profile, LEGACY_PROFILE_FIELDS), status_message: savedStatus };
    const extraProfile = pickFields(profile, EXTENSIBLE_PROFILE_FIELDS);
    for (const field of EXTENSIBLE_PROFILE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body || {}, field) && !Object.prototype.hasOwnProperty.call(extraProfile, field)) {
        extraProfile[field] = normalizeShortTextField(body?.[field], field === 'manual_leetify_map_ranks' ? 2000 : 120, field);
      }
    }
    const profilePageSettings = pickFields(profile, PROFILE_PAGE_SETTING_FIELDS);
    await updateExistingProfileColumns(db, user.id, legacyValues);
    await updateExistingProfileColumns(db, user.id, extraProfile);
    await updateExistingProfileColumns(db, user.id, profilePageSettings);
    await mergeSettingsJson(db, 'user_profile_settings', user.id, extraProfile);
    await mergeSettingsJson(db, 'user_profile_page_settings', user.id, profilePageSettings);
    const achievementsAwarded = await awardProfileSaveAchievements(db, user.id, { ...profile, status_message: savedStatus });
    const profileLayoutAward = profile.profile_page_tile_layout_json ? await grantAchievement(db, user.id, 'profile_page.custom_layout', { source:'profile_save' }) : null;
    if (profileLayoutAward?.awarded) achievementsAwarded.push({ ...profileLayoutAward.achievement, xp: profileLayoutAward.xp });
    if (hasMeaningfulWidgetStyle(profile.profile_page_widget_settings_json)) {
      const styleAward = await grantAchievement(db, user.id, 'profile_page.widget_style', { source:'profile_save' });
      if (styleAward.awarded) achievementsAwarded.push({ ...styleAward.achievement, xp: styleAward.xp });
    }
    const response = await handleProfileMe(request, env);
    const payload = await response.json();
    payload.achievementsAwarded = achievementsAwarded;
    payload.xp = await readRecentXpSummary(db, user.id);
    return json(payload, response.status);
  } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); }
}
async function handleProfileCardMeUpdate(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ ok: false, error: 'Not logged in' }, 401);
    const body = await readJsonBody(request);
    const card_layout = ['compact', 'standard', 'showcase'].includes(String(body?.card_layout || 'standard')) ? String(body?.card_layout || 'standard') : null;
    if (!card_layout) return json({ ok: false, error: 'Invalid card_layout' }, 400);
    const cardTileSettings = normalizeCardTileSettings(body?.card_tile_settings ?? body?.cardTileSettings);
    const cardGridColumns = [2,3,4].includes(Number(body?.card_grid_columns)) ? Number(body?.card_grid_columns) : 4;
    const cardTileSettingsJson = JSON.stringify(cardTileSettings);
    if (cardTileSettingsJson.length > 8000) return json({ ok: false, error: 'cardTileSettings too large' }, 400);
    const db = getDatabase(env);
    await ensureCoreSchemaOnce(db);
    const existing = await getSafeProfileSettings(db, user.id);
    const hasField = (k) => Object.prototype.hasOwnProperty.call(body || {}, k);
    const mergeImageField = (k) => { if (!hasField(k)) return String(existing?.[k] || ''); const normalized = normalizeImageUrl(body?.[k]); if (normalized === null) throw new Error('Invalid card image URL'); return normalized || ''; };
    const mergeColourField = (k) => { if (!hasField(k)) return String(existing?.[k] || ''); const incoming = String(body?.[k] ?? '').trim(); if (!incoming) return ''; const normalized = normalizeHexColour(incoming); if (!normalized) throw new Error(`Invalid ${k}`); return normalized; };
    const cardState = {
      card_background_url: mergeImageField('card_background_url'),
      card_background_colour: mergeColourField('card_background_colour'),
      card_accent_colour: mergeColourField('card_accent_colour'),
      card_text_colour: mergeColourField('card_text_colour'),
      card_body_text_colour: mergeColourField('card_body_text_colour'),
      card_border_colour: mergeColourField('card_border_colour'),
      card_layout,
      card_show_avatar: normalizeBool01(body?.card_show_avatar, 1),
      card_show_display_name: normalizeBool01(body?.card_show_display_name, 1),
      card_show_username: normalizeBool01(body?.card_show_username, 1),
      card_show_user_id: normalizeBool01(body?.card_show_user_id, 0),
      card_show_role: normalizeBool01(body?.card_show_role, 1),
      card_show_level: normalizeBool01(body?.card_show_level, 1),
      card_show_rank: normalizeBool01(body?.card_show_rank, 1),
      card_show_xp: normalizeBool01(body?.card_show_xp, 1),
      card_show_status: normalizeBool01(body?.card_show_status, 0),
      card_show_steam: normalizeBool01(body?.card_show_steam, 0),
      card_show_leetify: normalizeBool01(body?.card_show_leetify, 0),
      card_show_leetify_rank: normalizeBool01(body?.card_show_leetify_rank, 0),
      card_show_leetify_rating: normalizeBool01(body?.card_show_leetify_rating, 0),
      card_show_leetify_steam_id: normalizeBool01(body?.card_show_leetify_steam_id, 0),
      card_show_leetify_avatar: normalizeBool01(body?.card_show_leetify_avatar, 0),
      card_show_leetify_name: normalizeBool01(body?.card_show_leetify_name, 0),
      card_show_leetify_aim: normalizeBool01(body?.card_show_leetify_aim, 0),
      card_show_leetify_positioning: normalizeBool01(body?.card_show_leetify_positioning, 0),
      card_show_leetify_utility: normalizeBool01(body?.card_show_leetify_utility, 0),
      card_show_leetify_clutch: normalizeBool01(body?.card_show_leetify_clutch, 0),
      card_show_leetify_opening: normalizeBool01(body?.card_show_leetify_opening, 0),
      card_show_leetify_recent_matches: normalizeBool01(body?.card_show_leetify_recent_matches, 0),
      card_show_leetify_premier: normalizeBool01(body?.card_show_leetify_premier, 0),
      card_show_leetify_map_ranks: normalizeBool01(body?.card_show_leetify_map_ranks, 0),
      card_show_leetify_updated: normalizeBool01(body?.card_show_leetify_updated, 0),
      card_show_refrag: normalizeBool01(body?.card_show_refrag, 0),
      card_grid_columns: cardGridColumns,
      card_tile_settings_json: cardTileSettingsJson,
      cardTileSettings
    };
    await updateExistingProfileColumns(db, user.id, cardState);
    await mergeSettingsJson(db, 'user_profile_card_settings', user.id, cardState);
    const achievementsAwarded = await awardProfileCardAchievements(db, user.id, cardState);
    const response = await handleProfileMe(request, env);
    const payload = await response.json();
    payload.achievementsAwarded = achievementsAwarded;
    payload.xp = await readRecentXpSummary(db, user.id);
    return json(payload, response.status);
  } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); }
}


async function handleProfileRankUpdate(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ ok: false, error: 'Not logged in' }, 401);
    const body = await readJsonBody(request);
    const incoming = body?.selected_rank_id;
    const selected = incoming == null ? null : String(incoming).trim();
    const db = getDatabase(env);
    await ensureCoreSchemaOnce(db);
    const ranks = await loadAccountRanks(request, env);
    if (!ranks.ok) return json(ranks, 500);
    const progress = await getUserAccountProgress(db, user.id);
    let selectedRankId = null;
    if (selected && selected.toLowerCase() !== 'default') {
      const rank = getRankById(selected, ranks.ranks);
      if (!rank) return json({ ok: false, error: 'Unknown rank' }, 400);
      if (rank.level > progress.accountLevel) return json({ ok: false, error: 'You have not unlocked that rank yet' }, 400);
      selectedRankId = rank.id;
    }
    await updateExistingProfileColumns(db, user.id, { selected_rank_id: selectedRankId, updated_at: new Date().toISOString() });
    await mergeSettingsJson(db, 'user_profile_settings', user.id, { selected_rank_id: selectedRankId });
    return handleProfileMe(request, env);
  } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); }
}

function normalizeTextLimit(value, max, label) {
  const text = String(value ?? '').trim();
  if (text.length > max) return { error: `${label} must be ${max} characters or fewer` };
  return { value: text };
}
function normalizeSteamIdentifier(value) {
  const text = String(value ?? '').trim();
  if (!text) return { steam_id64:'', steam_profile_url:'' };
  if (text.length > 500) return { error:'Steam profile URL or SteamID64 must be 500 characters or fewer' };
  if (/^\d{17}$/.test(text)) return { steam_id64:text, steam_profile_url:'' };
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    if ((url.protocol === 'https:' || url.protocol === 'http:') && (host === 'steamcommunity.com' || host.endsWith('.steamcommunity.com'))) return { steam_id64:'', steam_profile_url:url.toString() };
  } catch {}
  return { error:'Enter a valid SteamID64 or Steam Community profile URL' };
}
function safeExternalInt(value) { const n=Number(value); return Number.isFinite(n) ? Math.round(n) : null; }
function publicCs2StatsFromRow(row) { if (!row) return null; return { premier_rating:row.premier_rating||'', premier_rank:row.premier_rank||'', last_match_map:row.last_match_map||'', last_match_result:row.last_match_result||'', last_match_score:row.last_match_score||'', recent_form:row.recent_form||'', matches_tracked:row.matches_tracked==null?null:Number(row.matches_tracked), kd:row.kd||'', win_rate:row.win_rate||'', last_synced_at:row.last_synced_at||'', updated_at:row.updated_at||'' }; }
function publicCs2ModeStatsFromRow(row) { if (!row) return null; return { mode:row.mode||'', rank_label:row.rank_label||'', rating:row.rating||'', map_group:row.map_group||'', last_match_map:row.last_match_map||'', last_match_result:row.last_match_result||'', last_match_score:row.last_match_score||'', recent_form:row.recent_form||'', matches_tracked:row.matches_tracked==null?null:Number(row.matches_tracked), wins:row.wins==null?null:Number(row.wins), losses:row.losses==null?null:Number(row.losses), win_rate:row.win_rate||'', kills:row.kills==null?null:Number(row.kills), deaths:row.deaths==null?null:Number(row.deaths), assists:row.assists==null?null:Number(row.assists), kd:row.kd||'', last_synced_at:row.last_synced_at||'', updated_at:row.updated_at||'' }; }
function emptyCs2Modes() { return { premier:null, competitive:null, wingman:null }; }
async function getPublicExternalStats(db, userId) {
  await ensureExternalCsStatsTables(db);
  const conn = await db.prepare("SELECT user_id, is_enabled, public_stats_enabled, last_checked_at FROM cs2_match_connections WHERE user_id=?").bind(String(userId)).first().catch(()=>null);
  const connected=!!conn && Number(conn.is_enabled)!==0;
  const publicStatsEnabled=!!conn && Number(conn.public_stats_enabled)!==0;
  const out={ cs2Connection:{ connected, publicStatsEnabled, lastCheckedAt:conn?.last_checked_at||'' }, cs2Modes:emptyCs2Modes() };
  if (connected && publicStatsEnabled) {
    const modeRows=await db.prepare("SELECT mode, rank_label, rating, map_group, last_match_map, last_match_result, last_match_score, recent_form, matches_tracked, wins, losses, win_rate, kills, deaths, assists, kd, last_synced_at, updated_at FROM cs2_mode_public_stats WHERE user_id=? AND mode IN ('premier','competitive','wingman')").bind(String(userId)).all().catch(()=>({results:[]}));
    for (const row of (modeRows?.results||[])) if (out.cs2Modes[row.mode] !== undefined) out.cs2Modes[row.mode]=publicCs2ModeStatsFromRow(row);
    if (!Object.values(out.cs2Modes).some(Boolean)) {
      const legacy=await db.prepare("SELECT s.* FROM cs2_public_stats s WHERE s.user_id=?").bind(String(userId)).first().catch(()=>null);
      const legacyStats=publicCs2StatsFromRow(legacy);
      if (legacyStats) out.cs2Modes.premier={ mode:'premier', rank_label:legacyStats.premier_rank||'', rating:legacyStats.premier_rating||'', map_group:'', last_match_map:legacyStats.last_match_map||'', last_match_result:legacyStats.last_match_result||'', last_match_score:legacyStats.last_match_score||'', recent_form:legacyStats.recent_form||'', matches_tracked:legacyStats.matches_tracked, wins:null, losses:null, win_rate:legacyStats.win_rate||'', kills:null, deaths:null, assists:null, kd:legacyStats.kd||'', last_synced_at:legacyStats.last_synced_at||'', updated_at:legacyStats.updated_at||'' };
    }
  }
  return out;
}
function serializeCs2Connection(row) { return { connected:!!row, steam_id64:row?.steam_id64||'', steam_profile_url:row?.steam_profile_url||'', public_stats_enabled:row?Number(row.public_stats_enabled)!==0:1, is_enabled:row?Number(row.is_enabled)!==0:1, last_checked_at:row?.last_checked_at||'', created_at:row?.created_at||'', updated_at:row?.updated_at||'', has_auth_code:!!row?.cs2_auth_code, has_latest_share_code:!!row?.latest_known_share_code, masked_auth_code_present:!!row?.cs2_auth_code, masked_latest_share_code_present:!!row?.latest_known_share_code }; }
async function getOwnerConnectionUser(request, env) { const user=await getCurrentUser(request, env); if(!user) return { error:json({ok:false,error:'Not logged in'},401) }; const db=getDatabase(env); await ensureCoreSchemaOnce(db); await ensureExternalCsStatsTables(db); return { user, db }; }
async function getOwnerCs2ModeStats(db, userId) { const rows=await db.prepare("SELECT mode, rank_label, rating, map_group, last_match_map, last_match_result, last_match_score, recent_form, matches_tracked, wins, losses, win_rate, kills, deaths, assists, kd, last_synced_at, updated_at FROM cs2_mode_public_stats WHERE user_id=? AND mode IN ('premier','competitive','wingman')").bind(String(userId)).all().catch(()=>({results:[]})); const modes=emptyCs2Modes(); for (const row of (rows?.results||[])) modes[row.mode]=publicCs2ModeStatsFromRow(row); return modes; }
async function handleCs2ConnectionGet(request, env) { const ctx=await getOwnerConnectionUser(request, env); if(ctx.error) return ctx.error; const userId=String(ctx.user.id); const row=await ctx.db.prepare('SELECT * FROM cs2_match_connections WHERE user_id=?').bind(userId).first(); return json({ ok:true, connection:serializeCs2Connection(row), externalStats:{ cs2Connection:{ connected:!!row && Number(row.is_enabled)!==0, publicStatsEnabled:row?Number(row.public_stats_enabled)!==0:false, lastCheckedAt:row?.last_checked_at||'' }, cs2Modes:await getOwnerCs2ModeStats(ctx.db,userId) } }, 200, { 'Cache-Control':'no-store' }); }
async function handleCs2ConnectionPost(request, env) { try { const ctx=await getOwnerConnectionUser(request, env); if(ctx.error) return ctx.error; const body=await readJsonBody(request); const steamIdInput=String(body?.steam_id64 || '').trim(); const steamUrlInput=String(body?.steam_profile_url || '').trim(); const steamFallback=body?.steam_identifier || steamIdInput || steamUrlInput; const steam=normalizeSteamIdentifier(steamFallback); if(steam.error) return json({ok:false,error:steam.error},400); let steam_id64=steam.steam_id64; let steam_profile_url=steam.steam_profile_url; if(steamIdInput){ if(!/^\d{17}$/.test(steamIdInput)) return json({ok:false,error:'SteamID64 must be 17 digits'},400); steam_id64=steamIdInput; } if(steamUrlInput){ const steamUrl=normalizeSteamIdentifier(steamUrlInput); if(steamUrl.error || !steamUrl.steam_profile_url) return json({ok:false,error:'Enter a valid Steam Community profile URL'},400); steam_profile_url=steamUrl.steam_profile_url; } const auth=normalizeTextLimit(body?.cs2_auth_code, 128, 'CS2 authentication code'); if(auth.error) return json({ok:false,error:auth.error},400); const share=normalizeTextLimit(body?.latest_known_share_code, 250, 'Latest match token / sharing code'); if(share.error) return json({ok:false,error:share.error},400); if(!steam_id64&&!steam_profile_url) return json({ok:false,error:'SteamID64 or Steam profile URL is required'},400); const userId=String(ctx.user.id); await ctx.db.prepare('INSERT INTO cs2_match_connections (user_id, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING').bind(userId).run(); const existing=await ctx.db.prepare('SELECT cs2_auth_code, latest_known_share_code FROM cs2_match_connections WHERE user_id=?').bind(userId).first(); const authValue=auth.value || existing?.cs2_auth_code || ''; const shareValue=share.value || existing?.latest_known_share_code || ''; await ctx.db.prepare("UPDATE cs2_match_connections SET steam_id64=?, steam_profile_url=?, cs2_auth_code=?, latest_known_share_code=?, is_enabled=?, public_stats_enabled=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(steam_id64, steam_profile_url, authValue, shareValue, normalizeBool01(body?.is_enabled,1), normalizeBool01(body?.public_stats_enabled,1), userId).run(); const row=await ctx.db.prepare('SELECT * FROM cs2_match_connections WHERE user_id=?').bind(userId).first(); return json({ok:true,connection:serializeCs2Connection(row), externalStats:{ cs2Connection:{ connected:true, publicStatsEnabled:Number(row.public_stats_enabled)!==0, lastCheckedAt:row.last_checked_at||'' }, cs2Modes:await getOwnerCs2ModeStats(ctx.db,userId) }},200,{'Cache-Control':'no-store'}); } catch(error){ return json({ok:false,error:friendlyError(error)},500); } }
async function handleCs2ConnectionDelete(request, env) { try { const ctx=await getOwnerConnectionUser(request, env); if(ctx.error) return ctx.error; const userId=String(ctx.user.id); await ctx.db.prepare("UPDATE cs2_match_connections SET cs2_auth_code='', latest_known_share_code='', is_enabled=0, public_stats_enabled=0, updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(userId).run(); return json({ok:true,connection:serializeCs2Connection(null)},200,{'Cache-Control':'no-store'}); } catch(error){ return json({ok:false,error:friendlyError(error)},500); } }
function faceitRemovedResponse() { return json({ok:false,error:'FACEIT integration has been removed'},410,{'Cache-Control':'no-store'}); }
async function handleFaceitConnectionGet() { return faceitRemovedResponse(); }
async function handleFaceitConnectionPost() { return faceitRemovedResponse(); }
async function handleFaceitConnectionDelete() { return faceitRemovedResponse(); }
async function handleCs2Sync(request, env) { try { const ctx=await getOwnerConnectionUser(request, env); if(ctx.error) return ctx.error; const row=await ctx.db.prepare('SELECT user_id, steam_id64, steam_profile_url, cs2_auth_code, latest_known_share_code FROM cs2_match_connections WHERE user_id=? AND is_enabled=1').bind(String(ctx.user.id)).first(); if(!row) return json({ok:false,error:'CS2 Match History connection is not saved yet'},400); if(!row.cs2_auth_code || !row.latest_known_share_code) return json({ok:false,error:'CS2 authentication code and latest match token are required before sync'},400); await ctx.db.prepare("UPDATE cs2_match_connections SET last_checked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(String(ctx.user.id)).run(); return json({ok:true,checked:true,statsUpdated:false,message:'CS2 connection checked. Match parsing for Premier, Competitive, and Wingman is not implemented yet.'},200,{'Cache-Control':'no-store'}); } catch(error){ return json({ok:false,error:friendlyError(error)},500); } }
async function handleFaceitSync() { return faceitRemovedResponse(); }
async function handleExternalStatsLookup(request, env) { const user=await getCurrentUser(request, env); if(!user) return json({ok:false,error:'Not logged in'},401); const db=getDatabase(env); await ensureCoreSchemaOnce(db); const url=new URL(request.url); let targetId=Number(url.searchParams.get('id') || user.id); const username=String(url.searchParams.get('user')||'').trim(); if(username){const row=await db.prepare('SELECT id FROM users WHERE username=?').bind(username).first(); if(!row) return json({ok:false,error:'User not found'},404); targetId=Number(row.id);} if(!Number.isInteger(targetId)||targetId<1) return json({ok:false,error:'Invalid user id'},400); return json({ok:true,externalStats:await getPublicExternalStats(db,targetId)},200,{'Cache-Control':'private, max-age=60'}); }

async function handleAccount(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchemaOnce(db); await ensureStarterUnlocks(db, user.id); const row = await db.prepare('SELECT id, username, role, is_admin, status, created_at FROM users WHERE id = ?').bind(user.id).first(); if (!row) return json({ ok: false, error: 'User not found' }, 404); return json({ ok: true, user: { ...serializeUser(row), created_at: row.created_at || null } }); }
async function handleAccountPassword(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const body = await readJsonBody(request); const currentPassword = body?.currentPassword ?? ''; const newPassword = body?.newPassword ?? ''; const confirmPassword = body?.confirmPassword ?? ''; if (!currentPassword) return json({ ok: false, error: 'Current password is required' }, 400); if (!newPassword) return json({ ok: false, error: 'New password is required' }, 400); if (!confirmPassword) return json({ ok: false, error: 'Confirm password is required' }, 400); if (newPassword !== confirmPassword) return json({ ok: false, error: 'New passwords do not match' }, 400); const db = getDatabase(env); await ensureSchemaOnce(db); await ensureStarterUnlocks(db, user.id); const row = await db.prepare('SELECT id, password_hash FROM users WHERE id = ?').bind(user.id).first(); if (!row) return json({ ok: false, error: 'User not found' }, 404); const valid = await verifyPassword(currentPassword, row.password_hash); if (!valid) return json({ ok: false, error: 'Current password is incorrect' }, 400); const passwordHash = await hashPassword(newPassword); await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, user.id).run(); await logAudit(db, user.id, user.id, 'password_changed', {}); return json({ ok: true }); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleWalletMe(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchemaOnce(db); const wallet = await getOrCreateWallet(db, user.id); return json({ ok: true, currency: SITE_CURRENCY_NAME, coins: wallet.coins }); }
async function handleWalletTransactionsMe(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchemaOnce(db); await getOrCreateWallet(db, user.id); const rows = await db.prepare('SELECT id, amount, balance_after, type, reason, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50').bind(user.id).all(); return json({ ok: true, currency: SITE_CURRENCY_NAME, transactions: rows?.results || [] }); }
async function handleAdminUsers(request, env) { const auth = await requireAdmin(request, env); if (auth) return auth; const db = getDatabase(env); await ensureSchemaOnce(db); const rows = await db.prepare(`SELECT u.id, u.username, u.role, u.is_admin, u.created_at, u.status, w.coins FROM users u LEFT JOIN wallets w ON w.user_id = u.id ORDER BY u.created_at DESC`).all(); return json({ ok: true, users: (rows.results || []).map((r) => ({ ...serializeUser(r), created_at: r.created_at || null, coins: r.coins == null ? null : Number(r.coins) })), roles: ROLES }); }
async function handleAdminUpdateRole(request, env, path) { const auth = await requireAdmin(request, env); if (auth) return auth; const actor = await getCurrentUser(request, env); const userId = Number(path.split('/')[4]); const role = normalizeRole(String((await readJsonBody(request))?.role || '').trim().toLowerCase()); if (!ROLES[role]) return json({ ok: false, error: 'Invalid role' }, 400); const db = getDatabase(env); const result = await db.prepare('UPDATE users SET role = ?, is_admin = ? WHERE id = ?').bind(role, role === 'admin' ? 1 : 0, userId).run(); if (!result.meta.changes) return json({ ok: false, error: 'User not found' }, 404); await logAudit(db, actor?.id || null, userId, 'role_changed', { role }); const updated = await db.prepare('SELECT id, username, role, is_admin, status, created_at FROM users WHERE id = ?').bind(userId).first(); return json({ ok: true, user: { ...serializeUser(updated), created_at: updated.created_at || null } }); }
async function handleAdminUpdateStatus(request, env, path) { const auth = await requireAdmin(request, env); if (auth) return auth; const actor = await getCurrentUser(request, env); const userId = Number(path.split('/')[4]); const status = normalizeStatus((await readJsonBody(request))?.status); if (!ALLOWED_STATUSES.has(status)) return json({ ok: false, error: 'Invalid status' }, 400); const db = getDatabase(env); const result = await db.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run(); if (!result.meta.changes) return json({ ok: false, error: 'User not found' }, 404); await logAudit(db, actor?.id || null, userId, 'status_changed', { status }); const updated = await db.prepare('SELECT id, username, role, is_admin, status, created_at FROM users WHERE id = ?').bind(userId).first(); return json({ ok: true, user: { ...serializeUser(updated), created_at: updated.created_at || null } }); }
async function handleAdminWalletAdjust(request, env, path) { const auth = await requireAdmin(request, env); if (auth) return auth; const actor = await getCurrentUser(request, env); const db = getDatabase(env); const userId = Number(path.split('/')[4]); const body = await readJsonBody(request); const amount = body?.amount; const reason = String(body?.reason || '').trim(); if (!Number.isInteger(amount)) return json({ ok: false, error: 'amount must be an integer' }, 400); if (!reason) return json({ ok: false, error: 'reason is required' }, 400); const target = await db.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first(); if (!target) return json({ ok: false, error: 'User not found' }, 404); const wallet = await getOrCreateWallet(db, userId); const coins = wallet.coins + amount; await db.prepare("UPDATE wallets SET coins = ?, updated_at = datetime('now') WHERE user_id = ?").bind(coins, userId).run(); await db.prepare("INSERT INTO wallet_transactions (user_id, actor_user_id, amount, balance_after, type, reason) VALUES (?, ?, ?, ?, 'admin_adjustment', ?)").bind(userId, actor?.id || null, amount, coins, reason).run(); await logAudit(db, actor?.id || null, userId, 'wallet_adjusted', { amount, reason, balance_after: coins }); return json({ ok: true, currency: SITE_CURRENCY_NAME, user_id: userId, coins }); }
async function handleAdminGameProgress(request, env, path) { const auth = await requireAdmin(request, env); if (auth) return auth; const userId = Number(path.split('/')[4]); const body = await readJsonBody(request); const game_key = String(body?.game_key || '').trim(); const game_name = String(body?.game_name || '').trim(); const level = Number(body?.level); const xp = Number(body?.xp); if (!game_key || !game_name) return json({ ok: false, error: 'game_key and game_name are required' }, 400); if (!Number.isInteger(level) || level < 1) return json({ ok: false, error: 'level must be integer >= 1' }, 400); if (!Number.isInteger(xp) || xp < 0) return json({ ok: false, error: 'xp must be integer >= 0' }, 400); const db = getDatabase(env); await db.prepare("INSERT INTO game_progress (user_id, game_key, game_name, level, xp, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(user_id, game_key) DO UPDATE SET game_name=excluded.game_name, level=excluded.level, xp=excluded.xp, updated_at=datetime('now')").bind(userId, game_key, game_name, level, xp).run(); const progress = await getUserAccountProgress(db, userId); return json({ ok: true, user_id: userId, progress }); }

async function handleAdminGetSettings(request, env) { const auth = await requireAdmin(request, env); if (auth) return auth; const db = getDatabase(env); await ensureSchemaOnce(db); return json({ ok: true, settings: await getAllSettings(db) }); }
async function handleAdminSetSettings(request, env) { const auth = await requireAdmin(request, env); if (auth) return auth; const actor = await getCurrentUser(request, env); const db = getDatabase(env); const updates = (await readJsonBody(request)) || {}; for (const [k, v] of Object.entries(updates)) { if (!SETTING_KEYS.has(k)) return json({ ok: false, error: `Unknown setting: ${k}` }, 400); if (k === 'default_new_user_role' && !ROLES[normalizeRole(v)]) return json({ ok: false, error: 'Invalid default_new_user_role' }, 400); if (k === 'starting_coins' && !Number.isInteger(Number(v))) return json({ ok: false, error: 'Invalid starting_coins' }, 400); await setSetting(db, k, String(v)); await logAudit(db, actor?.id || null, null, 'setting_changed', { key: k, value: String(v) }); }
  return json({ ok: true, settings: await getAllSettings(db) }); }
async function handleAdminAudit(request, env) { const auth = await requireAdmin(request, env); if (auth) return auth; const db = getDatabase(env); const rows = await db.prepare('SELECT id, actor_user_id, target_user_id, action, details_json, created_at FROM audit_logs ORDER BY id DESC LIMIT 100').all(); return json({ ok: true, logs: rows?.results || [] }); }

async function enforceAuthGate(request, env, pathname) { if (isPublicPath(pathname)) { if (pathname === '/unregistered.html') { const user = await getCurrentUserFast(request, env); if (user) return Response.redirect(new URL('/', request.url), 302); } return null; } const user = await getCurrentUserFast(request, env); if (user) return null; if (pathname.startsWith('/api/')) return json({ ok: false, error: 'Not logged in' }, 401); return Response.redirect(new URL('/unregistered.html', request.url), 302); }
function isPublicPath(pathname) { return PUBLIC_HTML_PATHS.has(pathname) || PUBLIC_API_PATHS.has(pathname) || pathname === '/favicon.ico' || pathname.startsWith('/styles') || pathname.startsWith('/scripts/') || pathname.startsWith('/data/'); }
async function getCurrentUserFast(request, env) { const token = getSessionToken(request); if (!token) return null; const db = getDatabase(env); const record = await db.prepare("SELECT u.id, u.username, u.role, u.is_admin, u.status FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')").bind(token).first(); return record ? normalizeUser(record) : null; }
async function getCurrentUser(request, env) { return getCurrentUserFast(request, env); }
async function requireAdmin(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); if (!isUserAdmin(user)) return json({ ok: false, error: 'Admin access required' }, 403); return null; }

const normalizeRole = (role) => (typeof role === 'string' && ROLES[role] ? role : 'member');
const normalizeStatus = (status) => (status === 'disabled' ? 'disabled' : 'active');
const normalizeUser = (user) => ({ ...user, role: normalizeRole(user?.role), status: normalizeStatus(user?.status) });
const serializeUser = (user) => ({ id: user.id, username: user.username, role: normalizeRole(user.role), roleLabel: getRoleLabel(user.role), is_admin: Number(user.is_admin) === 1 ? 1 : 0, status: normalizeStatus(user.status) });
const getRoleLabel = (role) => ROLES[normalizeRole(role)]?.label || ROLES.member.label;
const getRoleLevel = (role) => ROLES[normalizeRole(role)]?.level || ROLES.member.level;
const isUserAdmin = (u) => normalizeRole(u?.role) === 'admin' || Number(u?.is_admin) === 1 || u?.is_admin === true;
const getDatabase = (env) => { if (!env?.DB) throw new Error('Database binding DB is not configured'); return env.DB; };
function handleDebugDb(env) { try { getDatabase(env); return json({ ok: true, hasDb: true }); } catch (error) { return json({ ok: false, hasDb: false, error: friendlyError(error) }, 500); } }

async function handleRanks(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const ranks = await loadAccountRanks(request, env); if (!ranks.ok) return json(ranks, 500); return json({ ok: true, ranks: ranks.ranks }, 200, {'Cache-Control':'private, max-age=60'}); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function readJsonBody(request) { const text = await request.text(); if (!text) return {}; try { return JSON.parse(text); } catch { throw new Error('Invalid JSON body'); } }
const json = (data, status = 200, extraHeaders = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders } });
function makeSessionToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(); return { token, expiresAt }; }
function withSessionCookie(response, token, expiresAt) { response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${new Date(expiresAt).toUTCString()}`); return response; }
const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
function getSessionToken(request) { const header = request.headers.get('Cookie') || ''; for (const part of header.split(';').map((p) => p.trim())) if (part.startsWith(`${SESSION_COOKIE}=`)) return part.slice(SESSION_COOKIE.length + 1); return null; }
async function hashPassword(password) { const salt = crypto.getRandomValues(new Uint8Array(16)); const enc = new TextEncoder(); const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256); return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`; }
async function verifyPassword(password, stored) { const [algo, roundsStr, saltB64, hashB64] = (stored || '').split('$'); if (algo !== 'pbkdf2') return false; const rounds = Number(roundsStr); if (!Number.isFinite(rounds) || rounds < 1 || rounds > PBKDF2_ITERATIONS) return false; const salt = fromBase64(saltB64); const expected = fromBase64(hashB64); const enc = new TextEncoder(); const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' }, keyMaterial, expected.length * 8); return timingSafeEqual(expected, new Uint8Array(bits)); }
const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes)); const fromBase64 = (b64) => Uint8Array.from(atob(b64 || ''), (c) => c.charCodeAt(0)); const timingSafeEqual = (a, b) => a.length === b.length && a.reduce((d, v, i) => d | (v ^ b[i]), 0) === 0;
function sanitizeTotalXp(totalXp) { const xp = Math.floor(Number(totalXp) || 0); return Number.isFinite(xp) && xp > 0 ? xp : 0; }
function xpRequiredForNextLevel(level) { const safeLevel = Math.max(1, Math.floor(Number(level) || 1)); return Math.floor(100 + (safeLevel * 35) + Math.pow(safeLevel, 1.65) * 18); }
function levelXpRequirement(level) { return xpRequiredForNextLevel(level); }
function totalXpForLevel(level) { const target = Math.max(1, Math.min(500, Math.floor(Number(level) || 1))); let total = 0; for (let l = 1; l < target; l += 1) total += xpRequiredForNextLevel(l); return total; }
function levelFromXp(totalXp) { const xp = sanitizeTotalXp(totalXp); let level = 1; let remaining = xp; while (level < 500) { const needed = xpRequiredForNextLevel(level); if (remaining < needed) break; remaining -= needed; level += 1; } return level; }
function xpProgressForLevel(totalXp) { const safeTotalXp = sanitizeTotalXp(totalXp); const level = levelFromXp(safeTotalXp); const currentLevelXp = totalXpForLevel(level); const nextLevelXp = xpRequiredForNextLevel(level); const xpIntoLevel = Math.max(0, safeTotalXp - currentLevelXp); const xpPercent = nextLevelXp > 0 ? Math.max(0, Math.min(100, Math.floor((xpIntoLevel / nextLevelXp) * 100))) : 0; return { level, totalXp: safeTotalXp, currentLevelXp, nextLevelXp, xpIntoLevel, xpPercent }; }
function getXpForNextLevel(accountLevel) { return xpRequiredForNextLevel(accountLevel); }
function getAccountLevelFromGameProgress(rows) { const totalXp = (rows || []).reduce((acc, r) => acc + (Number(r.xp) || 0), 0); return levelFromXp(totalXp); }
function toAccountProgress(totalXp) { const progress = xpProgressForLevel(totalXp); return { accountLevel: progress.level, accountXp: progress.totalXp, accountXpCurrent: progress.xpIntoLevel, accountXpRequired: progress.nextLevelXp, accountXpPercent: progress.xpPercent, xpProgress: progress, totalXp: progress.totalXp, grevDadLevel: progress.level }; }
async function getUserAccountProgress(db, userId) { try { const row = await db.prepare('SELECT account_xp, account_level FROM users WHERE id = ?').bind(userId).first(); let totalXp = sanitizeTotalXp(row?.account_xp); if (!totalXp) { const legacy = await db.prepare('SELECT COALESCE(SUM(xp),0) as xp FROM game_progress WHERE user_id = ?').bind(userId).first(); totalXp = sanitizeTotalXp(legacy?.xp); } const progress = toAccountProgress(totalXp); if (row && Number(row.account_level) !== progress.accountLevel) { try { await db.prepare('UPDATE users SET account_level = ? WHERE id = ?').bind(progress.accountLevel, userId).run(); } catch {} } return progress; } catch { return { accountLevel: 1, accountXp: 0, accountXpCurrent: 0, accountXpRequired: xpRequiredForNextLevel(1), accountXpPercent: 0, xpProgress: xpProgressForLevel(0), totalXp: 0, grevDadLevel: 1, progressLoadError: true }; } }
function normalizeImageUrl(value) { const raw = String(value ?? '').trim(); if (!raw) return ''; if (raw.length > 500) return null; const lower = raw.toLowerCase(); if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:') || lower.startsWith('vbscript:')) return null; if (!(lower.startsWith('https://') || lower.startsWith('http://'))) return null; try { const u = new URL(raw); const p = u.pathname.toLowerCase(); const allowed = ['.png','.jpg','.jpeg','.webp','.gif']; if (allowed.some((ext)=>p.endsWith(ext))) return raw; if (p.endsWith('.svg')) return null; return raw; } catch { return null; } }
function normalizeBool01(value, fallback=0) { return Number(value) === 1 ? 1 : Number(value) === 0 ? 0 : fallback; }
function isSafeHttpUrl(value) { const raw = String(value ?? '').trim(); if (!raw) return true; const lower = raw.toLowerCase(); if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('file:') || lower.startsWith('vbscript:')) return false; try { const u = new URL(raw); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } }


function normaliseExternalUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length > 500) throw new Error('URL must be 500 characters or fewer');
  if (/[\u0000-\u001F\u007F]/.test(raw)) throw new Error('URL contains invalid control characters');
  if (/^\s*(javascript|data|file|vbscript):/i.test(raw)) throw new Error('URL scheme is not allowed');
  let u;
  try { u = new URL(raw); } catch { throw new Error('URL must be valid'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('URL must start with http:// or https://');
  return u.toString();
}
function urlHostIs(url, allowedHosts) {
  try { return allowedHosts.includes(new URL(url).hostname.toLowerCase()); } catch { return false; }
}
function normalizeWebsiteUrl(value) {
  try { return normaliseExternalUrl(value); } catch (error) { throw new Error(`website_url ${error.message}`); }
}
function normalizeSteamUrl(value) {
  let url;
  try { url = normaliseExternalUrl(value); } catch (error) { throw new Error(`steam_url ${error.message}`); }
  if (!url) return '';
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host !== 'steamcommunity.com' && host !== 'www.steamcommunity.com') throw new Error('steam_url must be a valid Steam Community URL');
    if (!u.pathname.startsWith('/id/') && !u.pathname.startsWith('/profiles/')) throw new Error('steam_url must be a valid Steam Community URL');
    return url;
  } catch (error) { throw new Error(error.message || 'steam_url must be a valid Steam Community URL'); }
}
function normalizeServiceUrl(value, fieldName, allowedHosts) {
  let url;
  try { url = normaliseExternalUrl(value); } catch (error) { throw new Error(`${fieldName} ${error.message}`); }
  if (!url) return '';
  if (!urlHostIs(url, allowedHosts)) throw new Error(`${fieldName} host is not allowed`);
  return url;
}
function normalizeProfileLinksVisibilityJson(input, fallback = '{}') {
  const source = input === undefined ? fallback : input;
  if (source == null || source === '') return { value: '{}' };
  if (typeof source === 'object' && !Array.isArray(source)) {
    const out = {};
    for (const [key, value] of Object.entries(source)) if (PROFILE_LINK_VISIBILITY_KEYS.has(key) && typeof value === 'boolean') out[key] = value;
    return { value: JSON.stringify(out) };
  }
  const raw = String(source);
  if (raw.length > 5000) return { error: 'profile_links_visibility_json exceeds 5000 characters' };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { error: 'profile_links_visibility_json must be valid JSON' }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'profile_links_visibility_json must be a JSON object' };
  const out = {};
  for (const [key, value] of Object.entries(parsed)) if (PROFILE_LINK_VISIBILITY_KEYS.has(key) && typeof value === 'boolean') out[key] = value;
  return { value: JSON.stringify(out) };
}
function isAllowedLeetifyProfileUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);
    if (['leetify.com','www.leetify.com','app.leetify.com'].includes(host)) {
      const profileIndex = parts.indexOf('profile');
      return profileIndex >= 0 && !!parts[profileIndex + 1];
    }
    if (host === 'steamcommunity.gg' || host === 'www.steamcommunity.gg') {
      return parts[0] === 'profiles' && !!parts[1];
    }
    return false;
  } catch { return false; }
}
function isAllowedRefragProfileUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);
    if (!['refrag.gg','www.refrag.gg','app.refrag.gg','play.refrag.gg'].includes(host)) return false;
    if (host === 'play.refrag.gg') return parts[0] === 'user' && !!parts[1];
    return parts.length === 0 || (parts[0] === 'user' && !!parts[1]);
  } catch { return false; }
}
function parseLeetifyProfileIdentifier(value) {
  const profileUrl = normaliseExternalUrl(value);
  if (!profileUrl) return { profileUrl:'', steamId64:'', identifier:'', slugOrIdentifier:'', sourcePath:'' };
  if (!isAllowedLeetifyProfileUrl(profileUrl)) throw new Error('leetify_profile_url must be a valid Leetify profile URL');
  const u = new URL(profileUrl);
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);
  let identifier = '';
  let sourcePath = '';
  if (host === 'steamcommunity.gg' || host === 'www.steamcommunity.gg') {
    if (parts[0] === 'profiles') {
      identifier = parts[1] || '';
      sourcePath = 'profiles';
    }
  } else {
    const profileIndex = parts.indexOf('profile');
    identifier = parts[profileIndex + 1] || '';
    sourcePath = parts.slice(Math.max(0, profileIndex - 1), profileIndex + 1).join('/');
  }
  const steamCandidate = [identifier, u.searchParams.get('steamid'), u.searchParams.get('steam64'), ...parts].find((part) => /^7656119\d{10}$/.test(String(part || '')));
  return { profileUrl, steamId64: steamCandidate || '', identifier, slugOrIdentifier: identifier, sourcePath };
}
function parseRefragProfileUrl(value) {
  const profileUrl = normaliseExternalUrl(value);
  if (!profileUrl) return { profileUrl:'', slug:'' };
  if (!isAllowedRefragProfileUrl(profileUrl)) throw new Error('refrag_profile_url must be a valid Refrag URL');
  const u = new URL(profileUrl);
  const slug = u.pathname.split('/').filter(Boolean).pop() || '';
  return { profileUrl, slug };
}
function normalizeShortTextField(value, maxLen, fieldName) {
  const raw = String(value ?? '').trim();
  if (raw.length > maxLen) throw new Error(`${fieldName} max length is ${maxLen}`);
  if (/[\u0000-\u001F\u007F]/.test(raw)) throw new Error(`${fieldName} contains invalid control characters`);
  return raw;
}

function normalizeHexColour(value) { const raw = String(value ?? '').trim(); if (!raw) return null; return /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : null; }
function normalizeNullableString(value, maxLen=500) { const raw = String(value ?? '').trim(); if (!raw) return null; return raw.length > maxLen ? raw.slice(0, maxLen) : raw; }
function normalizeCardTileSettings(input) {
  let raw = input;
  if (typeof raw === 'string') { try { raw = raw ? JSON.parse(raw) : {}; } catch { raw = {}; } }
  if (!raw || typeof raw !== 'object') raw = {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!CARD_TILE_KEYS.has(key) || !value || typeof value !== 'object') continue;
    const item = {};
    if (['1x1', '2x1', '1x2', '2x2'].includes(value.span)) item.span = value.span;
    if (['normal', 'bold', 'italic', 'bold_italic', 'mono'].includes(value.fontStyle)) item.fontStyle = value.fontStyle;
    if (['default', 'system', 'serif', 'mono', 'condensed', 'wide', 'display'].includes(value.fontFamily)) item.fontFamily = value.fontFamily;
    if (['xs', 'sm', 'md', 'lg', 'xl'].includes(value.size)) item.size = value.size;
    if (['left', 'center', 'right'].includes(value.align)) item.align = value.align;
    const order = Number(value.order);
    if (Number.isInteger(order) && order >= 1 && order <= 999) item.order = order;
    const colour = String(value.colour ?? '').trim();
    if (!colour || /^#[0-9a-fA-F]{6}$/.test(colour)) item.colour = colour;
    if (PROFILE_LINK_CARD_TILE_KEYS.has(key)) {
      if (typeof value.enabled === 'boolean') item.enabled = value.enabled;
      const maxIcons = Number(value.maxIcons);
      if (Number.isInteger(maxIcons)) item.maxIcons = Math.max(1, Math.min(8, maxIcons));
      if (Array.isArray(value.linkKeys)) item.linkKeys = value.linkKeys.filter((linkKey) => PROFILE_LINK_SERVICE_KEYS.has(linkKey)).slice(0, 8);
    } else if (CS_CARD_TILE_KEYS.includes(key)) {
      if (typeof value.enabled === 'boolean') item.enabled = value.enabled;
    }
    out[key] = item;
  }
  return out;
}
function normalizeProfileInput(body, existingProfile = {}) {
  const clean = (v) => String(v ?? '').trim();
  const nullable = (v) => { const x = clean(v); return x || null; };
  const asBoolInt = (v, fallback = 1) => (v === undefined || v === null || v === '' ? fallback : (Number(v) ? 1 : 0));
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  const allowedLayouts = new Set(['compact', 'standard', 'showcase']);

  const display_name = nullable(body?.display_name);
  const profile_title = nullable(body?.profile_title);
  const bio = nullable(body?.bio);
  const location = nullable(body?.location);
  let website_url, steam_url, spotify_url, soundcloud_url, youtube_music_url, youtube_url;
  try { website_url = normalizeWebsiteUrl(body?.website_url) || null; } catch (error) { return { error: error.message || 'Invalid website_url' }; }
  try { steam_url = normalizeSteamUrl(body?.steam_url) || null; } catch (error) { return { error: error.message || 'Invalid steam_url' }; }
  try { spotify_url = normalizeServiceUrl(body?.spotify_url, 'spotify_url', ['spotify.com','open.spotify.com','www.spotify.com']); } catch (error) { return { error: error.message || 'Invalid spotify_url' }; }
  try { soundcloud_url = normalizeServiceUrl(body?.soundcloud_url, 'soundcloud_url', ['soundcloud.com','www.soundcloud.com']); } catch (error) { return { error: error.message || 'Invalid soundcloud_url' }; }
  try { youtube_music_url = normalizeServiceUrl(body?.youtube_music_url, 'youtube_music_url', ['music.youtube.com','youtube.com','www.youtube.com','youtu.be']); } catch (error) { return { error: error.message || 'Invalid youtube_music_url' }; }
  try { youtube_url = normalizeServiceUrl(body?.youtube_url, 'youtube_url', ['youtube.com','www.youtube.com','m.youtube.com','youtu.be']); } catch (error) { return { error: error.message || 'Invalid youtube_url' }; }
  const leetifyRaw = Object.prototype.hasOwnProperty.call(body || {}, 'leetify_profile_url') ? body?.leetify_profile_url : body?.leetify_url;
  const refragRaw = Object.prototype.hasOwnProperty.call(body || {}, 'refrag_profile_url') ? body?.refrag_profile_url : body?.refrag_url;
  let leetifyParsed, refragParsed;
  try { leetifyParsed = parseLeetifyProfileIdentifier(leetifyRaw); } catch (error) { return { error: error.message || 'Invalid Leetify profile URL' }; }
  try { refragParsed = parseRefragProfileUrl(refragRaw); } catch (error) { return { error: error.message || 'Invalid Refrag profile URL' }; }
  const leetify_url = leetifyParsed.profileUrl || null;
  const leetify_profile_url = leetifyParsed.profileUrl || '';
  const leetify_steam_id = leetifyParsed.steamId64 || '';
  const refrag_url = refragParsed.profileUrl || null;
  const refrag_profile_url = refragParsed.profileUrl || '';
  let manual_refrag_rating, manual_refrag_counter_strafe_pct, manual_refrag_reaction_time, manual_refrag_ttd, manual_refrag_crosshair_drift, manual_refrag_last_updated_at;
  try {
    manual_refrag_rating = normalizeShortTextField(body?.manual_refrag_rating, 50, 'manual_refrag_rating');
    manual_refrag_counter_strafe_pct = normalizeShortTextField(body?.manual_refrag_counter_strafe_pct, 50, 'manual_refrag_counter_strafe_pct');
    manual_refrag_reaction_time = normalizeShortTextField(body?.manual_refrag_reaction_time, 50, 'manual_refrag_reaction_time');
    manual_refrag_ttd = normalizeShortTextField(body?.manual_refrag_ttd, 50, 'manual_refrag_ttd');
    manual_refrag_crosshair_drift = normalizeShortTextField(body?.manual_refrag_crosshair_drift, 50, 'manual_refrag_crosshair_drift');
    manual_refrag_last_updated_at = normalizeShortTextField(body?.manual_refrag_last_updated_at, 40, 'manual_refrag_last_updated_at');
  } catch (error) { return { error: error.message || 'Invalid manual Refrag stats' }; }
  const avatar_url = normalizeImageUrl(body?.avatar_url);
  const bannerUrlInput = Object.prototype.hasOwnProperty.call(body || {}, 'banner_url') ? body?.banner_url : existingProfile.banner_url;
  const banner_url = normalizeImageUrl(bannerUrlInput);
  const profile_background_url = normalizeImageUrl(body?.profile_background_url);
  const bannerDisplaySizeInput = Object.prototype.hasOwnProperty.call(body || {}, 'banner_display_size') ? body?.banner_display_size : (existingProfile.banner_display_size ?? 'wide');
  const banner_display_size = ['compact','wide','tall','full'].includes(String(bannerDisplaySizeInput||'wide')) ? String(bannerDisplaySizeInput||'wide') : null;
  const profile_background_size = ['cover','contain','repeat','stretch','center'].includes(String(body?.profile_background_size||'cover')) ? String(body?.profile_background_size||'cover') : null;
  const profileFooterUrlInput = Object.prototype.hasOwnProperty.call(body || {}, 'profile_footer_url') ? body?.profile_footer_url : existingProfile.profile_footer_url;
  const profile_footer_url = normalizeImageUrl(profileFooterUrlInput);
  const profileFooterDisplaySizeInput = Object.prototype.hasOwnProperty.call(body || {}, 'profile_footer_display_size') ? body?.profile_footer_display_size : (existingProfile.profile_footer_display_size ?? 'wide');
  const profile_footer_display_size = ['compact','wide','tall','full'].includes(String(profileFooterDisplaySizeInput||'wide')) ? String(profileFooterDisplaySizeInput||'wide') : null;
  const favourite_colour = nullable(body?.favourite_colour);
  const profile_accent_colour = nullable(body?.profile_accent_colour);
  const profile_background_colour = nullable(body?.profile_background_colour);
  const profile_layout = nullable(body?.profile_layout) || 'standard';
  const show_level = asBoolInt(body?.show_level, 1);
  const show_rank = asBoolInt(body?.show_rank, 1);
  const show_badges = asBoolInt(body?.show_badges, 1);
  const show_last_active = asBoolInt(body?.show_last_active, 0);

  if (display_name && display_name.length > 40) return { error: 'display_name max length is 40' };
  if (profile_title && profile_title.length > 80) return { error: 'profile_title max length is 80' };
  if (bio && bio.length > 500) return { error: 'bio max length is 500' };
  if (location && location.length > 80) return { error: 'location max length is 80' };
  if (website_url && website_url.length > 500) return { error: 'website_url max length is 500' };
  if (steam_url && steam_url.length > 500) return { error: 'steam_url max length is 500' };
  if (avatar_url === null) return { error: 'Invalid avatar_url' };
  if (banner_url === null) return { error: 'Invalid banner_url' };
  if (profile_background_url === null) return { error: 'Invalid profile_background_url' };
  if (!banner_display_size) return { error: 'Invalid banner_display_size' };
  if (!profile_background_size) return { error: 'Invalid profile_background_size' };
  if (profile_footer_url === null) return { error: 'Invalid profile_footer_url' };
  if (!profile_footer_display_size) return { error: 'Invalid profile_footer_display_size' };
  for (const [name, value] of [['favourite_colour', favourite_colour], ['profile_accent_colour', profile_accent_colour], ['profile_background_colour', profile_background_colour]]) {
    if (value && !hexRe.test(value)) return { error: `${name} must be blank or a hex colour like #00ff66` };
  }
  if (!allowedLayouts.has(profile_layout)) return { error: 'profile_layout must be compact, standard, or showcase' };

  const profilePageBackgroundUrlInput = Object.prototype.hasOwnProperty.call(body || {}, 'profile_page_background_url') ? body?.profile_page_background_url : existingProfile.profile_page_background_url;
  const profile_page_background_url = normalizeImageUrl(profilePageBackgroundUrlInput);
  if (profile_page_background_url === null) return { error: 'Invalid profile_page_background_url' };
  const profilePageBackgroundColourInput = Object.prototype.hasOwnProperty.call(body || {}, 'profile_page_background_colour') ? body?.profile_page_background_colour : existingProfile.profile_page_background_colour;
  const profile_page_background_colour = clean(profilePageBackgroundColourInput);
  if (profile_page_background_colour && !hexRe.test(profile_page_background_colour)) return { error: 'profile_page_background_colour must be blank or a hex colour like #00ff66' };
  const profilePageBackgroundSizeInput = Object.prototype.hasOwnProperty.call(body || {}, 'profile_page_background_size') ? body?.profile_page_background_size : (existingProfile.profile_page_background_size ?? 'cover');
  const profile_page_background_size = ['cover','contain','repeat','stretch','center'].includes(String(profilePageBackgroundSizeInput||'cover')) ? String(profilePageBackgroundSizeInput||'cover') : null;
  if (!profile_page_background_size) return { error: 'Invalid profile_page_background_size' };
  const profilePageOverlayInput = Object.prototype.hasOwnProperty.call(body || {}, 'profile_page_overlay_strength') ? body?.profile_page_overlay_strength : (existingProfile.profile_page_overlay_strength ?? 20);
  const profile_page_overlay_strength = Number(profilePageOverlayInput ?? 20);
  if (!Number.isInteger(profile_page_overlay_strength) || profile_page_overlay_strength < 0 || profile_page_overlay_strength > 80) return { error: 'profile_page_overlay_strength must be an integer from 0 to 80' };
  const profile_page_tile_layout_json = normalizeProfileLayoutJson(body?.profile_page_tile_layout_json);
  if (profile_page_tile_layout_json?.error) return profile_page_tile_layout_json;
  const profile_page_widget_settings_json = normalizeProfileWidgetSettingsJson(body?.profile_page_widget_settings_json);
  if (profile_page_widget_settings_json?.error) return profile_page_widget_settings_json;
  const profile_links_visibility_json = normalizeProfileLinksVisibilityJson(body?.profile_links_visibility_json, existingProfile.profile_links_visibility_json || '{}');
  if (profile_links_visibility_json?.error) return profile_links_visibility_json;

  return { display_name, profile_title, bio, location, website_url, steam_url, spotify_url, soundcloud_url, youtube_music_url, youtube_url, profile_links_visibility_json: profile_links_visibility_json.value, leetify_url, leetify_profile_url, leetify_steam_id, refrag_url, refrag_profile_url, manual_refrag_rating, manual_refrag_counter_strafe_pct, manual_refrag_reaction_time, manual_refrag_ttd, manual_refrag_crosshair_drift, manual_refrag_last_updated_at, avatar_url, banner_url, banner_display_size, profile_background_url, profile_background_size, favourite_colour, profile_accent_colour, profile_background_colour, profile_layout, show_level, show_rank, show_badges, show_last_active, profile_page_background_url, profile_page_background_colour, profile_page_background_size, profile_page_overlay_strength, profile_page_tile_layout_json: profile_page_tile_layout_json.value, profile_page_widget_settings_json: profile_page_widget_settings_json.value, profile_footer_url, profile_footer_display_size };
}



function normalizeProfileLayoutJson(input) {
  if (input == null || input === '') return { value: '' };
  const raw = String(input);
  if (raw.length > 20000) return { error: 'profile_page_tile_layout_json exceeds 20000 characters' };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { error: 'profile_page_tile_layout_json must be valid JSON' }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'profile_page_tile_layout_json must be a JSON object' };
  const widgetsIn = parsed.widgets && typeof parsed.widgets === 'object' ? parsed.widgets : {};
  const widgets = {};
  for (const [key, value] of Object.entries(widgetsIn)) {
    if (!PROFILE_WIDGET_KEYS.has(key) || !value || typeof value !== 'object') continue;
    const col = Number(value.col); const row = Number(value.row); const size = String(value.size || '4x2'); const enabled = value.enabled;
    if (!Number.isInteger(col) || col < 1 || !Number.isInteger(row) || row < 1) continue;
    if (!PROFILE_PAGE_SIZE_OPTIONS.has(size) || typeof enabled !== 'boolean') continue;
    widgets[key] = { col, row, size, enabled };
  }
  return { value: JSON.stringify({ widgets }) };
}
function normalizeProfileWidgetSettingsJson(input) {
  if (input == null || input === '') return { value: '' };
  const raw = String(input);
  if (raw.length > 20000) return { error: 'profile_page_widget_settings_json exceeds 20000 characters' };
  let parsed;
  try { parsed = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'profile_page_widget_settings_json must be a JSON object' }; } catch { return { error: 'profile_page_widget_settings_json must be valid JSON' }; }
  const out = {}; const hexRe = /^#[0-9a-fA-F]{6}$/;
  for (const [key, value] of Object.entries(parsed)) {
    if (!PROFILE_WIDGET_KEYS.has(key) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
    const entry = {};
    for (const c of ['backgroundColour','textColour','borderColour','accentColour']) { const v = String(value[c] || '').trim(); entry[c] = v && hexRe.test(v) ? v : ''; }
    const opacity = Number(value.opacity); const blur = Number(value.blur);
    entry.opacity = Number.isInteger(opacity) ? Math.max(0, Math.min(100, opacity)) : 0;
    entry.blur = Number.isInteger(blur) ? Math.max(0, Math.min(20, blur)) : 0;
    out[key] = entry;
  }
  return { value: JSON.stringify(out) };
}
async function getOrCreateWallet(db, userId) { const startCoins = Number(await getSetting(db, 'starting_coins', String(FALLBACK_STARTING_COINS))); const initialCoins = Number.isInteger(startCoins) ? startCoins : FALLBACK_STARTING_COINS; await db.prepare('INSERT OR IGNORE INTO wallets (user_id, coins) VALUES (?, ?)').bind(userId, initialCoins).run(); const existingTx = await db.prepare("SELECT id FROM wallet_transactions WHERE user_id = ? AND type = 'initial_grant' LIMIT 1").bind(userId).first(); if (!existingTx) await db.prepare("INSERT INTO wallet_transactions (user_id, amount, balance_after, type, reason) VALUES (?, ?, ?, 'initial_grant', 'Starting Grev Coins')").bind(userId, initialCoins, initialCoins).run(); const wallet = await db.prepare('SELECT coins FROM wallets WHERE user_id = ?').bind(userId).first(); return { coins: Number(wallet?.coins ?? initialCoins) }; }
async function ensureSchema(db) { await createSchemaTables(db); return true; }
async function ensureSchemaOnce(db, { force = false } = {}) {
  const now = Date.now();
  if (!force && schemaReadyPromise && now - schemaReadyAt < SCHEMA_READY_TTL_MS) return schemaReadyPromise;
  schemaReadyPromise = ensureSchema(db)
    .then((value) => { schemaReadyAt = Date.now(); return value; })
    .catch((error) => { schemaReadyPromise = null; schemaReadyAt = 0; throw error; });
  return schemaReadyPromise;
}

async function ensureCoreSchemaOnce(db, { force = false } = {}) {
  const now = Date.now();
  if (!force && coreSchemaReadyPromise && now - coreSchemaReadyAt < SCHEMA_READY_TTL_MS) return coreSchemaReadyPromise;
  coreSchemaReadyPromise = ensureCoreSchema(db)
    .then((value) => { coreSchemaReadyAt = Date.now(); return value; })
    .catch((error) => { coreSchemaReadyPromise = null; coreSchemaReadyAt = 0; throw error; });
  return coreSchemaReadyPromise;
}

async function ensureCoreSchema(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', is_admin INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  for (const sql of [
    "ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE users ADD COLUMN account_xp INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN account_level INTEGER NOT NULL DEFAULT 1"
  ]) { try { await db.prepare(sql).run(); } catch {} }
  await db.prepare("CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS user_profiles (user_id INTEGER PRIMARY KEY, display_name TEXT, bio TEXT, location TEXT, favourite_colour TEXT, profile_title TEXT, avatar_url TEXT, banner_url TEXT, banner_display_size TEXT NOT NULL DEFAULT 'wide', profile_background_url TEXT, profile_background_size TEXT NOT NULL DEFAULT 'cover', selected_rank_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await ensureProfileColumnsLite(db);
  await ensureExternalCsStatsTables(db);
  await db.prepare("CREATE TABLE IF NOT EXISTS homepage_tile_config (tile_id TEXT PRIMARY KEY, label TEXT NOT NULL, default_size TEXT NOT NULL, allowed_sizes_json TEXT NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await ensureHomepageTileConfigLite(db);
  try { await db.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)").run(); } catch {}
  try { await db.prepare("CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id)").run(); } catch {}
  return true;
}

const USER_PROFILE_CORE_COLUMN_DEFINITIONS = {
  display_name: "TEXT",
  bio: "TEXT",
  location: "TEXT",
  favourite_colour: "TEXT",
  profile_title: "TEXT",
  avatar_url: "TEXT",
  banner_url: "TEXT",
  created_at: "TEXT DEFAULT ''",
  updated_at: "TEXT DEFAULT ''"
};

async function ensureProfileColumnsLite(db) {
  // user_profiles is at/near column limit; new settings must go into JSON/settings tables.
  return ensureUserProfileColumns(db);
}

async function ensureProfileRowLite(db, userId) {
  await db.prepare('INSERT INTO user_profiles (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING').bind(userId).run();
}

async function ensureHomepageTileConfigLite(db) {
  for (const tile of getHomepageTileSeedConfigs()) {
    await db.prepare("INSERT OR IGNORE INTO homepage_tile_config (tile_id, label, default_size, allowed_sizes_json, is_enabled, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").bind(tile.tile_id, tile.label, tile.default_size, JSON.stringify(tile.allowed_sizes), tile.is_enabled, tile.sort_order).run();
  }
}

const USER_PROFILE_COLUMN_DEFINITIONS = {
  selected_rank_id: "TEXT",
  website_url: "TEXT DEFAULT ''",
  steam_url: "TEXT DEFAULT ''",
  spotify_url: "TEXT DEFAULT ''",
  soundcloud_url: "TEXT DEFAULT ''",
  youtube_music_url: "TEXT DEFAULT ''",
  profile_links_visibility_json: "TEXT DEFAULT '{}'",
  leetify_url: "TEXT DEFAULT ''",
  leetify_profile_url: "TEXT DEFAULT ''",
  leetify_steam_id: "TEXT DEFAULT ''",
  refrag_url: "TEXT DEFAULT ''",
  refrag_profile_url: "TEXT DEFAULT ''",
  manual_refrag_rating: "TEXT DEFAULT ''",
  manual_refrag_counter_strafe_pct: "TEXT DEFAULT ''",
  manual_refrag_reaction_time: "TEXT DEFAULT ''",
  manual_refrag_ttd: "TEXT DEFAULT ''",
  manual_refrag_crosshair_drift: "TEXT DEFAULT ''",
  manual_refrag_last_updated_at: "TEXT DEFAULT ''",

  banner_display_size: "TEXT NOT NULL DEFAULT 'wide'",
  profile_background_url: "TEXT DEFAULT ''",
  profile_background_size: "TEXT NOT NULL DEFAULT 'cover'",
  profile_accent_colour: "TEXT DEFAULT ''",
  profile_background_colour: "TEXT DEFAULT ''",
  profile_layout: "TEXT DEFAULT 'standard'",
  status_message: "TEXT DEFAULT ''",
  profile_quote: "TEXT DEFAULT ''",
  favourite_game: "TEXT DEFAULT ''",
  profile_visibility: "TEXT DEFAULT 'public'",

  show_level: "INTEGER NOT NULL DEFAULT 1",
  show_rank: "INTEGER NOT NULL DEFAULT 1",
  show_badges: "INTEGER NOT NULL DEFAULT 1",
  show_last_active: "INTEGER NOT NULL DEFAULT 0",
  show_member_card: "INTEGER NOT NULL DEFAULT 1",
  show_profile_showcase: "INTEGER NOT NULL DEFAULT 1",
  show_profile_xp: "INTEGER NOT NULL DEFAULT 1",
  show_profile_user_id: "INTEGER NOT NULL DEFAULT 0",
  show_joined_date: "INTEGER NOT NULL DEFAULT 1",
  show_header_avatar: "INTEGER NOT NULL DEFAULT 1",
  show_header_display_name: "INTEGER NOT NULL DEFAULT 1",
  show_header_username: "INTEGER NOT NULL DEFAULT 1",
  show_header_user_id: "INTEGER NOT NULL DEFAULT 0",
  show_header_level: "INTEGER NOT NULL DEFAULT 1",
  show_header_rank: "INTEGER NOT NULL DEFAULT 1",
  show_header_xp_bar: "INTEGER NOT NULL DEFAULT 1",

  card_background_url: "TEXT DEFAULT ''",
  card_background_colour: "TEXT DEFAULT ''",
  card_accent_colour: "TEXT DEFAULT ''",
  card_border_colour: "TEXT DEFAULT ''",
  card_text_colour: "TEXT DEFAULT ''",
  card_body_text_colour: "TEXT DEFAULT ''",
  card_layout: "TEXT DEFAULT 'standard'",
  card_grid_columns: "INTEGER NOT NULL DEFAULT 4",
  card_tile_settings_json: "TEXT DEFAULT ''",

  card_show_avatar: "INTEGER NOT NULL DEFAULT 1",
  card_show_display_name: "INTEGER NOT NULL DEFAULT 1",
  card_show_username: "INTEGER NOT NULL DEFAULT 1",
  card_show_user_id: "INTEGER NOT NULL DEFAULT 0",
  card_show_role: "INTEGER NOT NULL DEFAULT 1",
  card_show_level: "INTEGER NOT NULL DEFAULT 1",
  card_show_rank: "INTEGER NOT NULL DEFAULT 1",
  card_show_xp: "INTEGER NOT NULL DEFAULT 1",
  card_show_status: "INTEGER NOT NULL DEFAULT 0",
  card_show_steam: "INTEGER NOT NULL DEFAULT 0",
  card_show_refrag: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_rank: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_rating: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_steam_id: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_avatar: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_name: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_aim: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_positioning: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_utility: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_clutch: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_opening: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_recent_matches: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_premier: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_map_ranks: "INTEGER NOT NULL DEFAULT 0",
  card_show_leetify_updated: "INTEGER NOT NULL DEFAULT 0",

  dashboard_background_colour: "TEXT DEFAULT ''",
  dashboard_background_url: "TEXT DEFAULT ''",
  dashboard_background_size: "TEXT DEFAULT 'cover'",
  dashboard_background_overlay_strength: "INTEGER DEFAULT 0",

  profile_page_background_url: "TEXT DEFAULT ''",
  profile_page_background_colour: "TEXT DEFAULT ''",
  profile_page_background_size: "TEXT DEFAULT 'cover'",
  profile_page_overlay_strength: "INTEGER DEFAULT 20",
  profile_page_tile_layout_json: "TEXT DEFAULT ''",
  profile_page_widget_settings_json: "TEXT DEFAULT ''",
  profile_footer_url: "TEXT DEFAULT ''",
  profile_footer_display_size: "TEXT DEFAULT 'wide'"
};
async function ensureUserProfileColumns(db) {
  // user_profiles is at/near column limit; new settings must go into JSON/settings tables.
  const rows = await db.prepare('PRAGMA table_info(user_profiles)').all();
  const names = new Set((rows.results || []).map((r) => r.name));
  console.warn('[schema] user_profiles column count', names.size);
  return names;
}

async function createSchemaTables(db) { await db.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', is_admin INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))" ).run(); try { await db.prepare("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'").run(); } catch {}
  try { await db.prepare("ALTER TABLE users ADD COLUMN account_xp INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE users ADD COLUMN account_level INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  await db.prepare("CREATE TABLE IF NOT EXISTS user_profiles (user_id INTEGER PRIMARY KEY, display_name TEXT, bio TEXT, location TEXT, favourite_colour TEXT, profile_title TEXT, avatar_url TEXT, banner_url TEXT, banner_display_size TEXT NOT NULL DEFAULT 'wide', profile_background_url TEXT, profile_background_size TEXT NOT NULL DEFAULT 'cover', selected_rank_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  // user_profiles is at/near column limit; new settings must go into JSON/settings tables.
  await ensureUserProfileColumns(db);
  await db.prepare("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS wallets (user_id INTEGER PRIMARY KEY, coins INTEGER NOT NULL DEFAULT 1000, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS wallet_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, actor_user_id INTEGER, amount INTEGER NOT NULL, balance_after INTEGER NOT NULL, type TEXT NOT NULL, reason TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS game_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, game_key TEXT NOT NULL, game_name TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id, game_key), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS xp_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, amount INTEGER NOT NULL, source_type TEXT NOT NULL, source_key TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, source_type, source_key), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS achievement_definitions (achievement_key TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'general', xp_reward INTEGER NOT NULL DEFAULT 0, icon TEXT NOT NULL DEFAULT '', rarity TEXT NOT NULL DEFAULT 'common', is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS user_achievements (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, achievement_key TEXT NOT NULL, xp_awarded INTEGER NOT NULL DEFAULT 0, earned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, source TEXT NOT NULL DEFAULT '', metadata_json TEXT NOT NULL DEFAULT '{}', UNIQUE(user_id, achievement_key), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await seedAchievementDefinitions(db);
  await syncLegacyAccountXp(db);
  await db.prepare("CREATE TABLE IF NOT EXISTS user_unlocks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, unlock_key TEXT NOT NULL, unlock_type TEXT NOT NULL, name TEXT NOT NULL, description TEXT, icon_url TEXT, source TEXT, rarity TEXT NOT NULL DEFAULT 'common', metadata_json TEXT, unlocked_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id, unlock_key), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS showcase_catalog (id INTEGER PRIMARY KEY AUTOINCREMENT, item_key TEXT NOT NULL UNIQUE, item_type TEXT NOT NULL, name TEXT NOT NULL, description TEXT, rarity TEXT NOT NULL DEFAULT 'common', icon_url TEXT, image_url TEXT, source TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  try { await db.prepare("ALTER TABLE showcase_catalog ADD COLUMN image_url TEXT").run(); } catch {}
  await db.prepare("CREATE TABLE IF NOT EXISTS user_showcase_unlocks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, catalog_item_id INTEGER NOT NULL, unlocked_at TEXT NOT NULL DEFAULT (datetime('now')), unlock_source TEXT, metadata_json TEXT, UNIQUE(user_id, catalog_item_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (catalog_item_id) REFERENCES showcase_catalog(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS profile_showcase_slots (user_id INTEGER NOT NULL, slot INTEGER NOT NULL, unlock_id INTEGER, custom_label TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, slot), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (unlock_id) REFERENCES user_unlocks(id) ON DELETE SET NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER, target_user_id INTEGER, action TEXT NOT NULL, details_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS homepage_tile_config (tile_id TEXT PRIMARY KEY, label TEXT NOT NULL, default_size TEXT NOT NULL, allowed_sizes_json TEXT NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await ensureSettingsTables(db);
  await ensureExternalCsStatsTables(db);

  await db.prepare("CREATE TABLE IF NOT EXISTS chat_rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, room_key TEXT NOT NULL UNIQUE, room_type TEXT NOT NULL, name TEXT NOT NULL, created_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS chat_room_members (room_id INTEGER NOT NULL, user_id INTEGER NOT NULL, joined_at TEXT NOT NULL DEFAULT (datetime('now')), last_read_message_id INTEGER, PRIMARY KEY (room_id, user_id), FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER NOT NULL, sender_user_id INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), edited_at TEXT, deleted_at TEXT, FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE, FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_homepage_tile_config_tile_id ON homepage_tile_config(tile_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created ON chat_messages(room_id, created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_showcase_items_id ON showcase_catalog(id)").run();
  await db.prepare("INSERT OR IGNORE INTO chat_rooms (room_key, room_type, name) VALUES ('global','global','Global Chat')").run();
  await db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_name',?),('registration_enabled','true'),('default_new_user_role','admin'),('starting_coins','1000'),('maintenance_mode','false')").bind(SITE_NAME).run();
  for (const tile of getHomepageTileSeedConfigs()) {
    await db.prepare("INSERT OR IGNORE INTO homepage_tile_config (tile_id, label, default_size, allowed_sizes_json, is_enabled, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").bind(tile.tile_id, tile.label, tile.default_size, JSON.stringify(tile.allowed_sizes), tile.is_enabled, tile.sort_order).run();
  }
  await migrateHomepageTileConfigs(db);
  await db.prepare("UPDATE users SET role = 'admin' WHERE role IS NULL OR role = '' OR role = 'user'").run(); await db.prepare('UPDATE users SET is_admin = 1 WHERE is_admin IS NULL').run(); await db.prepare("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''").run();
}
async function getSetting(db, key, fallback) { const row = await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(key).first(); return row?.value ?? fallback; }
async function setSetting(db, key, value) { await db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").bind(key, value).run(); }
async function getAllSettings(db) { const rows = await db.prepare('SELECT key, value, updated_at FROM site_settings ORDER BY key').all(); const settings = {}; (rows.results || []).forEach((r) => { settings[r.key] = r.value; }); return settings; }
async function logAudit(db, actorUserId, targetUserId, action, details) { await db.prepare('INSERT INTO audit_logs (actor_user_id, target_user_id, action, details_json) VALUES (?, ?, ?, ?)').bind(actorUserId, targetUserId, action, JSON.stringify(details || {})).run(); }
const isTruthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
const friendlyError = (error) => (error instanceof Error ? error.message : 'Unexpected error');




async function handleProfileMyUnlocks(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchemaOnce(db); await ensureStarterUnlocks(db, user.id); const rows = await db.prepare("SELECT id, unlock_key, unlock_type, name, description, icon_url, source, rarity, unlocked_at FROM user_unlocks WHERE user_id = ? ORDER BY unlocked_at DESC, id DESC").bind(user.id).all(); return json({ ok: true, unlocks: rows.results || [] }); }
async function handleProfileMyShowcase(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchemaOnce(db); return json({ ok: true, slots: await getPublicShowcaseSlots(db, user.id) }); }
async function handleProfileMyShowcaseUpdate(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const body = await readJsonBody(request); const slots = Array.isArray(body?.slots) ? body.slots : null; if (!slots) return json({ ok: false, error: 'slots array is required' }, 400); const db = getDatabase(env); await ensureSchemaOnce(db); for (const entry of slots) { const slot = Number(entry?.slot); if (!Number.isInteger(slot) || slot < SHOWCASE_SLOT_MIN || slot > SHOWCASE_SLOT_MAX) return json({ ok: false, error: 'slot must be 1 to 4' }, 400); const unlockId = entry?.unlock_id; if (unlockId !== null && unlockId !== undefined) { const unlock = await db.prepare('SELECT id FROM user_unlocks WHERE id = ? AND user_id = ?').bind(Number(unlockId), user.id).first(); if (!unlock) return json({ ok: false, error: `unlock_id ${unlockId} does not belong to your account` }, 400); } await db.prepare("INSERT INTO profile_showcase_slots (user_id, slot, unlock_id, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id, slot) DO UPDATE SET unlock_id=excluded.unlock_id, updated_at=datetime('now')").bind(user.id, slot, unlockId == null ? null : Number(unlockId)).run(); } return json({ ok: true, slots: await getPublicShowcaseSlots(db, user.id) }); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function getPublicShowcaseSlots(db, userId) { const rows = await db.prepare(`SELECT s.slot, u.id as unlock_id, u.unlock_key, u.unlock_type, u.name, u.description, u.icon_url, u.source, u.rarity, u.unlocked_at FROM profile_showcase_slots s LEFT JOIN user_unlocks u ON u.id = s.unlock_id AND u.user_id = s.user_id WHERE s.user_id = ? AND s.slot BETWEEN ? AND ? ORDER BY s.slot ASC`).bind(userId, SHOWCASE_SLOT_MIN, SHOWCASE_SLOT_MAX).all(); const bySlot = new Map((rows.results || []).map((r) => [Number(r.slot), r])); const slots = []; for (let i = SHOWCASE_SLOT_MIN; i <= SHOWCASE_SLOT_MAX; i += 1) { const row = bySlot.get(i); slots.push({ slot: i, unlock: row && row.unlock_id ? { id: row.unlock_id, unlock_key: row.unlock_key, unlock_type: row.unlock_type, name: row.name, description: row.description || '', icon_url: row.icon_url || '', source: row.source || '', rarity: row.rarity, unlocked_at: row.unlocked_at } : null }); } return slots; }
async function getUserProfileBundle(request, env, userId, { includeUnlockedRanks = false } = {}) {
  try {
    const db = getDatabase(env);
    await ensureCoreSchemaOnce(db);
    const row = await db.prepare('SELECT id, username, role, is_admin, created_at, status FROM users WHERE id = ?').bind(userId).first();
    if (!row) return null;
    const safeProfile = await getSafeProfileSettings(db, row.id);
    if (!safeProfile.display_name) safeProfile.display_name = row.username;
    const progress = await getUserAccountProgress(db, row.id);
    const ranks = await loadAccountRanks(request, env);
    const rankList = ranks.ok ? ranks.ranks : [];
    const defaultRank = getDefaultRankForLevel(progress.accountLevel, rankList);
    const rank = getDisplayedRank(progress.accountLevel, safeProfile?.selected_rank_id, rankList);
    const unlockedRanks = includeUnlockedRanks ? getUnlockedRanks(progress.accountLevel, rankList) : undefined;
    const showcase = await getPublicShowcaseSlots(db, row.id).catch(() => []);
    const achievements = await getPublicAchievementSummary(db, row.id).catch(() => ({ count: 0, xpFromAchievements: 0, latest: [] }));
    const externalStats = await getPublicExternalStats(db, row.id).catch(() => ({}));
    return { profile: { ...serializeUser(row), created_at: row.created_at || null, ...safeProfile, ...progress, selected_rank_id: safeProfile?.selected_rank_id || null, rank, defaultRank, showcase, achievements, externalStats, ...(unlockedRanks ? { unlockedRanks } : {}) }, ranks };
  } catch (error) { console.error('[profile/bundle] failed', { message: error?.message || String(error), stack: error?.stack || '' }); throw error; }
}
function normalizeDashboardBackgroundPayload(body = {}) {
  const colour = String(body.dashboard_background_colour || '').trim();
  if (colour && !/^#[0-9a-f]{6}$/i.test(colour)) return { error: 'Background colour must be blank or #RRGGBB' };
  const url = String(body.dashboard_background_url || '').trim();
  if (url) {
    if (url.length > 1000) return { error: 'Background URL must be 1000 characters or fewer' };
    if (/^(javascript|data|file|vbscript):/i.test(url)) return { error: 'Background URL scheme is not allowed' };
    try { const parsed = new URL(url); if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { error: 'Background URL must start with http:// or https://' }; } catch { return { error: 'Background URL must be valid' }; }
  }
  const size = String(body.dashboard_background_size || 'cover').trim();
  if (!DASHBOARD_BACKGROUND_SIZES.has(size)) return { error: 'Invalid background size' };
  const overlay = Math.max(0, Math.min(80, Math.round(Number(body.dashboard_background_overlay_strength) || 0)));
  return { dashboard_background_colour: colour, dashboard_background_url: url, dashboard_background_size: size, dashboard_background_overlay_strength: overlay };
}
async function handleDashboardBackgroundUpdate(request, env) {
  try {
    const user = await getCurrentUser(request, env);
    if (!user) return json({ ok: false, error: 'Not logged in' }, 401);
    const body = await readJsonBody(request);
    const normalized = normalizeDashboardBackgroundPayload(body);
    if (normalized.error) return json({ ok: false, error: normalized.error }, 400);
    const db = getDatabase(env);
    await ensureCoreSchemaOnce(db);
    await updateExistingProfileColumns(db, user.id, normalized);
    await mergeSettingsJson(db, 'user_dashboard_settings', user.id, pickFields({ ...normalized, tileStyles: body?.tileStyles }, DASHBOARD_SETTING_FIELDS));
    return json({ ok: true, profile: normalized });
  } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); }
}
async function handleBootstrapDashboard(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok:false, error:'Not logged in' }, 401); const db = getDatabase(env); await ensureCoreSchemaOnce(db); const bundlePromise = getUserProfileBundle(request, env, Number(user.id), { includeUnlockedRanks: true }); let tileRes; try { tileRes = await db.prepare('SELECT tile_id, label, default_size, allowed_sizes_json, is_enabled, sort_order FROM homepage_tile_config ORDER BY sort_order ASC, tile_id ASC').all(); } catch (error) { console.warn('[bootstrap/dashboard] tile config fallback', friendlyError(error)); tileRes = { results: defaultHomepageTileConfigs() }; } const bundle = await bundlePromise; if (!bundle) return json({ ok:false, error:'User not found' }, 404); const rankList = bundle.ranks?.ok ? bundle.ranks.ranks : []; const homepageTileConfig = (tileRes?.results || defaultHomepageTileConfigs()).map((row) => ({ tile_id: row.tile_id, label: row.label, default_size: row.default_size, allowed_sizes: Array.isArray(row.allowed_sizes) ? row.allowed_sizes : parseAllowedSizes(row.allowed_sizes_json), is_enabled: Number(row.is_enabled) === 1 ? 1 : 0, sort_order: Number(row.sort_order) || 0 })); return json({ ok:true, user: serializeUser(user), profile: bundle.profile, homepageTileConfig, ranks: rankList, serverTime: new Date().toISOString() }, 200, { 'Cache-Control':'private, max-age=15' }); } catch (error) { return json({ ok:false, error:friendlyError(error) }, 500); } }

async function handleBootstrapProfile(request, env) { try { const viewer = await getCurrentUser(request, env); if (!viewer) return json({ ok:false, error:'Not logged in' }, 401); const url = new URL(request.url); const idParam = url.searchParams.get('id'); const targetId = idParam ? Number(idParam) : Number(viewer.id); if (!Number.isInteger(targetId) || targetId < 1) return json({ ok:false, error:'Invalid user id' }, 400); const bundle = await getUserProfileBundle(request, env, targetId, { includeUnlockedRanks: Number(viewer.id) === targetId }); if (!bundle) return json({ ok:false, error:'User not found' }, 404); return json({ ok:true, viewer: serializeUser(viewer), profile: bundle.profile, isOwner: Number(viewer.id) === targetId }, 200, { 'Cache-Control':'private, max-age=15' }); } catch (error) { return json({ ok:false, error:friendlyError(error) }, 500); } }
async function handleBootstrapEditProfile(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok:false, error:'Not logged in' }, 401); const bundle = await getUserProfileBundle(request, env, Number(user.id), { includeUnlockedRanks: true }); if (!bundle) return json({ ok:false, error:'User not found' }, 404); return json({ ok:true, user: serializeUser(user), profile: bundle.profile, ranks: bundle.ranks?.ok ? bundle.ranks.ranks : [] }, 200, { 'Cache-Control':'private, max-age=15' }); } catch (error) { return json({ ok:false, error:friendlyError(error) }, 500); } }
const CORE_ACHIEVEMENTS = [
  ['profile.field.display_name','Name Dropper','Fill in display name','profile',50,'','common',10], ['profile.field.profile_title','Title Holder','Add profile title','profile',50,'','common',20], ['profile.field.bio','Lore Submitted','Add bio','profile',75,'','common',30], ['profile.field.location','Put Yourself On The Map','Add location','profile',40,'','common',40], ['profile.field.status_message','Status Symbol','Add status message','profile',50,'','common',50], ['profile.field.avatar_url','Face Reveal-ish','Add avatar image/GIF','profile',75,'','common',60], ['profile.field.banner_url','Banner Merchant','Add profile banner','profile',75,'','common',70], ['profile.field.profile_footer_url','Footer Fetish','Add profile footer image/GIF','profile',75,'','uncommon',80], ['profile.field.profile_page_background_url','Background Character','Add profile page background','profile',100,'','uncommon',90], ['profile.field.website_url','Link Goblin','Add website link','profile',50,'','common',100], ['profile.field.steam_url','Steam Powered','Add Steam profile link','integrations',75,'','common',110], ['profile.field.leetify_url','Stat Rat','Add Leetify link','integrations',75,'','common',120], ['profile.field.refrag_url','Refrag Rat','Add Refrag link','integrations',75,'','common',130],
  ['profile_card.background_url','Card Backed','Add Profile Card background image/GIF','profile_card',100,'','uncommon',210], ['profile_card.background_colour','Painted Cardboard','Set Profile Card background colour','profile_card',50,'','common',220], ['profile_card.accent_colour','Accent Addict','Set Profile Card accent colour','profile_card',50,'','common',230], ['profile_card.border_colour','Border Control','Set Profile Card border colour','profile_card',50,'','common',240], ['profile_card.text_colour','Readable, Somehow','Set Profile Card name/text colour','profile_card',50,'','common',250], ['profile_card.body_text_colour','Body Language','Set Profile Card body text colour','profile_card',50,'','common',260], ['profile_card.grid_columns','Column Commander','Change Profile Card columns','profile_card',75,'','common',270], ['profile_card.tile_settings','Tiny Tile Goblin','Customise Profile Card display tiles','profile_card',150,'','rare',280], ['profile_card.show_status','Oversharing','Enable status on Profile Card','profile_card',50,'','common',290], ['profile_card.show_steam','Steam Badge Enjoyer','Enable Steam on Profile Card','profile_card',50,'','common',300], ['profile_card.show_leetify','Numbers Gremlin','Enable Leetify on Profile Card','profile_card',50,'','common',310], ['profile_card.show_refrag','Practice Arc','Enable Refrag on Profile Card','profile_card',50,'','common',320],
  ['dashboard.add_member_profile_card','Card Collector','Add another user’s Profile Card to dashboard','dashboard',100,'','uncommon',410], ['dashboard.custom_layout','Interior Designer','Move or resize dashboard tiles','dashboard',100,'','uncommon',420], ['profile_page.custom_layout','Profile Architect','Move or resize profile page widgets','profile',100,'','uncommon',430], ['profile_page.widget_style','Widget Wrangler','Style a profile page widget','profile',100,'','uncommon',440]
];
async function seedAchievementDefinitions(db) { for (const a of CORE_ACHIEVEMENTS) await db.prepare('INSERT OR IGNORE INTO achievement_definitions (achievement_key,title,description,category,xp_reward,icon,rarity,sort_order) VALUES (?,?,?,?,?,?,?,?)').bind(...a).run(); }
async function syncLegacyAccountXp(db) { try { await db.prepare('UPDATE users SET account_xp = COALESCE((SELECT SUM(xp) FROM game_progress WHERE game_progress.user_id = users.id),0) WHERE COALESCE(account_xp,0)=0 AND EXISTS (SELECT 1 FROM game_progress WHERE game_progress.user_id = users.id)').run(); await db.prepare('UPDATE users SET account_level = 1 WHERE account_level IS NULL OR account_level < 1').run(); } catch {} }
function safeMetadataJson(metadata) { try { return JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {}); } catch { return '{}'; } }
function sqliteWasChanged(result) { return Number(result?.meta?.changes ?? result?.changes ?? 0) > 0; }
async function grantXp(db, userId, amount, sourceType, sourceKey, description = '', metadata = {}) { const xpAmount = Math.floor(Number(amount)); const uid = Number(userId); const type = String(sourceType || '').trim(); const key = String(sourceKey || '').trim(); if (!Number.isInteger(uid) || uid < 1 || !Number.isInteger(xpAmount) || xpAmount < 1 || !type || !key) return { awarded:false, amount:0, totalXp:0, level:1, xpProgress:xpProgressForLevel(0) }; const inserted = await db.prepare('INSERT OR IGNORE INTO xp_ledger (user_id, amount, source_type, source_key, description, metadata_json) VALUES (?, ?, ?, ?, ?, ?)').bind(uid, xpAmount, type, key, String(description || '').slice(0, 300), safeMetadataJson(metadata)).run(); const awarded = sqliteWasChanged(inserted); if (awarded) { await db.prepare('UPDATE users SET account_xp = COALESCE(account_xp,0) + ? WHERE id = ?').bind(xpAmount, uid).run(); } const progress = await getUserAccountProgress(db, uid); try { await db.prepare('UPDATE users SET account_level = ? WHERE id = ?').bind(progress.accountLevel, uid).run(); } catch {} return { awarded, amount: awarded ? xpAmount : 0, totalXp: progress.accountXp, level: progress.accountLevel, xpProgress: progress.xpProgress }; }
async function grantAchievement(db, userId, achievementKey, metadata = {}) { const key = String(achievementKey || '').trim(); if (!key) return { awarded:false, achievement:null, xp:null }; const definition = await db.prepare('SELECT achievement_key,title,description,category,xp_reward,icon,rarity,is_active,sort_order FROM achievement_definitions WHERE achievement_key = ?').bind(key).first(); if (!definition || Number(definition.is_active) !== 1) return { awarded:false, achievement:null, xp:null }; const inserted = await db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_key, xp_awarded, source, metadata_json) VALUES (?, ?, ?, ?, ?)').bind(userId, key, Number(definition.xp_reward) || 0, String(metadata?.source || 'site').slice(0, 100), safeMetadataJson(metadata)).run(); if (!sqliteWasChanged(inserted)) return { awarded:false, achievement:definition, xp:null }; const xp = Number(definition.xp_reward) > 0 ? await grantXp(db, userId, Number(definition.xp_reward), 'achievement', key, definition.title, metadata) : { awarded:false, amount:0, totalXp:(await getUserAccountProgress(db,userId)).accountXp, level:(await getUserAccountProgress(db,userId)).accountLevel, xpProgress:(await getUserAccountProgress(db,userId)).xpProgress }; return { awarded:true, achievement:{ ...definition, xp_awarded:Number(definition.xp_reward)||0 }, xp }; }
async function grantAchievementsForFilledFields(db, userId, pairs, metadata = {}) { const out = []; for (const [field, key] of pairs) { if (String(field ?? '').trim()) { const award = await grantAchievement(db, userId, key, metadata); if (award.awarded) out.push({ ...award.achievement, xp: award.xp }); } } return out; }
async function readRecentXpSummary(db, userId) { const progress = await getUserAccountProgress(db, userId); const ledger = await db.prepare('SELECT amount, source_type, source_key, description, created_at FROM xp_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 10').bind(userId).all(); const achievements = await db.prepare('SELECT ua.achievement_key, ua.xp_awarded, ua.earned_at, ad.title, ad.description, ad.category, ad.icon, ad.rarity FROM user_achievements ua JOIN achievement_definitions ad ON ad.achievement_key=ua.achievement_key WHERE ua.user_id = ? ORDER BY ua.earned_at DESC, ua.id DESC LIMIT 10').bind(userId).all(); return { ...progress.xpProgress, totalXp: progress.accountXp, level: progress.accountLevel, recentLedger: ledger.results || [], recentAchievements: achievements.results || [] }; }
async function getPublicAchievementSummary(db, userId) { const latest = await db.prepare('SELECT ua.achievement_key, ua.xp_awarded, ua.earned_at, ad.title, ad.description, ad.category, ad.icon, ad.rarity FROM user_achievements ua JOIN achievement_definitions ad ON ad.achievement_key=ua.achievement_key WHERE ua.user_id = ? ORDER BY ua.earned_at DESC, ua.id DESC LIMIT 5').bind(userId).all(); const totals = await db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(xp_awarded),0) as xp FROM user_achievements WHERE user_id = ?').bind(userId).first(); return { count:Number(totals?.count)||0, xpFromAchievements:Number(totals?.xp)||0, latest: latest.results || [] }; }
async function awardProfileSaveAchievements(db, userId, profile) { return grantAchievementsForFilledFields(db, userId, [['display_name','profile.field.display_name'], ['profile_title','profile.field.profile_title'], ['bio','profile.field.bio'], ['location','profile.field.location'], ['status_message','profile.field.status_message'], ['avatar_url','profile.field.avatar_url'], ['banner_url','profile.field.banner_url'], ['profile_footer_url','profile.field.profile_footer_url'], ['profile_page_background_url','profile.field.profile_page_background_url'], ['website_url','profile.field.website_url'], ['steam_url','profile.field.steam_url'], ['leetify_url','profile.field.leetify_url'], ['refrag_url','profile.field.refrag_url']].map(([field,key])=>[profile?.[field], key]), { source:'profile_save' }); }
function hasMeaningfulWidgetStyle(raw) { let parsed; try { parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {}); } catch { return false; } if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false; return Object.values(parsed).some((v) => v && typeof v === 'object' && (String(v.backgroundColour || v.textColour || v.borderColour || v.accentColour || '').trim() || Number(v.opacity) > 0 || Number(v.blur) > 0)); }
function hasMeaningfulCardTileSettings(settings) { if (!settings || typeof settings !== 'object') return false; const defaults = { name:{span:'2x1',fontStyle:'bold',fontFamily:'default',size:'lg',align:'left',colour:'',order:10}, username:{span:'1x1',fontStyle:'normal',fontFamily:'default',size:'sm',align:'left',colour:'',order:20}, role:{span:'1x1',fontStyle:'normal',fontFamily:'default',size:'sm',align:'left',colour:'',order:30}, level:{span:'1x1',fontStyle:'normal',fontFamily:'default',size:'md',align:'center',colour:'',order:40}, rank:{span:'1x1',fontStyle:'bold',fontFamily:'default',size:'sm',align:'left',colour:'',order:50}, xp:{span:'2x1',fontStyle:'normal',fontFamily:'default',size:'sm',align:'left',colour:'',order:60}, status:{span:'2x1',fontStyle:'italic',fontFamily:'default',size:'sm',align:'left',colour:'',order:70}, steam:{span:'1x1',fontStyle:'bold',fontFamily:'default',size:'sm',align:'center',colour:'',order:80}, leetify:{span:'1x1',fontStyle:'bold',fontFamily:'default',size:'sm',align:'center',colour:'',order:90}, leetify_rank:{span:'1x1',fontStyle:'bold',fontFamily:'default',size:'sm',align:'left',colour:'',order:100}, leetify_rating:{span:'1x1',fontStyle:'bold',fontFamily:'default',size:'sm',align:'left',colour:'',order:110}, refrag:{span:'1x1',fontStyle:'bold',fontFamily:'default',size:'sm',align:'center',colour:'',order:120} }; return Object.entries(settings).some(([key, value]) => { if (!value || typeof value !== 'object') return false; const d = defaults[key] || {}; return ['span','fontStyle','fontFamily','size','align','colour'].some((prop)=>String(value[prop] ?? '') !== String(d[prop] ?? '')) || (Number(value.order) || 0) !== (Number(d.order) || 0); }); }
async function awardProfileCardAchievements(db, userId, card) { const pairs = [[card.card_background_url,'profile_card.background_url'], [card.card_background_colour,'profile_card.background_colour'], [card.card_accent_colour,'profile_card.accent_colour'], [card.card_border_colour,'profile_card.border_colour'], [card.card_text_colour,'profile_card.text_colour'], [card.card_body_text_colour,'profile_card.body_text_colour'], [Number(card.card_grid_columns) && Number(card.card_grid_columns) !== 4 ? 'set' : '', 'profile_card.grid_columns'], [hasMeaningfulCardTileSettings(card.cardTileSettings) ? 'set' : '', 'profile_card.tile_settings'], [Number(card.card_show_status) === 1 ? 'set' : '', 'profile_card.show_status'], [Number(card.card_show_steam) === 1 ? 'set' : '', 'profile_card.show_steam'], [Number(card.card_show_leetify) === 1 ? 'set' : '', 'profile_card.show_leetify'], [Number(card.card_show_refrag) === 1 ? 'set' : '', 'profile_card.show_refrag']]; return grantAchievementsForFilledFields(db, userId, pairs, { source:'profile_card_save' }); }


async function ensureStarterUnlocks(db, userId) { await db.prepare("INSERT OR IGNORE INTO user_unlocks (user_id, unlock_key, unlock_type, name, description, source, rarity) VALUES (?, 'founding_account', 'achievement', 'Founding Account', 'Created an account during the foundation build.', 'site', 'common')").bind(userId).run(); }
async function handleXpMe(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok:false, error:'Not logged in' }, 401); const db = getDatabase(env); await ensureSchemaOnce(db); const xp = await readRecentXpSummary(db, user.id); return json({ ok:true, xp }); } catch (error) { return json({ ok:false, error:friendlyError(error) }, 500); } }
async function handleAchievementsMe(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok:false, error:'Not logged in' }, 401); const db = getDatabase(env); await ensureSchemaOnce(db); const defs = await db.prepare('SELECT achievement_key,title,description,category,xp_reward,icon,rarity,sort_order FROM achievement_definitions WHERE is_active = 1 ORDER BY sort_order ASC, achievement_key ASC').all(); const earned = await db.prepare('SELECT ua.achievement_key, ua.xp_awarded, ua.earned_at, ad.title, ad.description, ad.category, ad.icon, ad.rarity FROM user_achievements ua JOIN achievement_definitions ad ON ad.achievement_key=ua.achievement_key WHERE ua.user_id = ? ORDER BY ua.earned_at DESC, ua.id DESC').bind(user.id).all(); return json({ ok:true, definitions:defs.results || [], earnedKeys:(earned.results || []).map((r)=>r.achievement_key), earnedAchievements:earned.results || [] }); } catch (error) { return json({ ok:false, error:friendlyError(error) }, 500); } }
async function handleAdminXpGrant(request, env) { try { const auth = await requireAdmin(request, env); if (auth) return auth; const admin = await getCurrentUser(request, env); const body = await readJsonBody(request); const userId = Number(body?.user_id); const amount = Math.floor(Number(body?.amount)); const reason = String(body?.reason || 'Manual XP grant').trim().slice(0,300); if (!Number.isInteger(userId) || userId < 1) return json({ ok:false, error:'Invalid user_id' }, 400); if (!Number.isInteger(amount) || amount < 1 || amount > 100000) return json({ ok:false, error:'amount must be 1 to 100000' }, 400); const db = getDatabase(env); await ensureSchemaOnce(db); const sourceKey = String(body?.source_key || `admin.${new Date().toISOString().slice(0,10)}.${admin?.id || 'system'}.${userId}.${slugifySourceKey(reason)}.${amount}`).trim(); if (!sourceKey) return json({ ok:false, error:'source_key required' }, 400); const xp = await grantXp(db, userId, amount, 'manual', sourceKey, reason, { adminUserId: admin?.id || null, reason }); let achievement = null; if (body?.achievement_key) achievement = await grantAchievement(db, userId, String(body.achievement_key), { source:'manual', adminUserId: admin?.id || null }); return json({ ok:true, xp, achievement }); } catch (error) { return json({ ok:false, error:friendlyError(error) }, 500); } }
async function handleAdminAchievementGrant(request, env) { try { const auth = await requireAdmin(request, env); if (auth) return auth; const admin = await getCurrentUser(request, env); const body = await readJsonBody(request); const userId = Number(body?.user_id); const key = String(body?.achievement_key || '').trim(); if (!Number.isInteger(userId) || userId < 1 || !key) return json({ ok:false, error:'user_id and achievement_key are required' }, 400); const db = getDatabase(env); await ensureSchemaOnce(db); const achievement = await grantAchievement(db, userId, key, { source:'manual', adminUserId: admin?.id || null }); return json({ ok:true, achievement }); } catch (error) { return json({ ok:false, error:friendlyError(error) }, 500); } }
async function handleAchievementEvent(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok:false, error:'Not logged in' }, 401); const body = await readJsonBody(request); const key = String(body?.achievement_key || '').trim(); const allowed = new Set(['dashboard.custom_layout','dashboard.add_member_profile_card']); if (!allowed.has(key)) return json({ ok:false, error:'Unsupported achievement event' }, 400); const db = getDatabase(env); await ensureSchemaOnce(db); const achievement = await grantAchievement(db, user.id, key, { source:'client_event' }); return json({ ok:true, achievement, achievementsAwarded: achievement.awarded ? [{ ...achievement.achievement, xp: achievement.xp }] : [], xp: await readRecentXpSummary(db, user.id) }); } catch (error) { return json({ ok:false, error:friendlyError(error) }, 500); } }
function slugifySourceKey(value) { return String(value || 'manual').toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'').slice(0,80) || 'manual'; }

async function handleAdminUserUnlockUpsert(request, env, path) { try { const auth = await requireAdmin(request, env); if (auth) return auth; const userId = Number(path.split('/')[4]); const body = await readJsonBody(request); const unlock_key = String(body?.unlock_key || '').trim(); const unlock_type = String(body?.unlock_type || '').trim(); const name = String(body?.name || '').trim(); const description = String(body?.description || '').trim() || null; const rarity = String(body?.rarity || 'common').trim(); const source = String(body?.source || 'admin').trim() || 'admin'; const icon_url = String(body?.icon_url || '').trim() || null; if (!unlock_key || !name) return json({ ok: false, error: 'unlock_key and name are required' }, 400); if (!UNLOCK_TYPES.has(unlock_type)) return json({ ok: false, error: 'Invalid unlock_type' }, 400); if (!UNLOCK_RARITIES.has(rarity)) return json({ ok: false, error: 'Invalid rarity' }, 400); const db = getDatabase(env); await ensureSchemaOnce(db); await db.prepare("INSERT INTO user_unlocks (user_id, unlock_key, unlock_type, name, description, icon_url, source, rarity, unlocked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(user_id, unlock_key) DO UPDATE SET unlock_type=excluded.unlock_type, name=excluded.name, description=excluded.description, icon_url=excluded.icon_url, source=excluded.source, rarity=excluded.rarity").bind(userId, unlock_key, unlock_type, name, description, icon_url, source, rarity).run(); return json({ ok: true }); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }


async function handleLeaderboardLevels(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ ok:false, error:'Not logged in' },401);
  const db=getDatabase(env);
  await ensureCoreSchemaOnce(db);
  const rows=await db.prepare('SELECT id, username, role, is_admin, created_at, status FROM users ORDER BY username ASC').all();
  const ranks=await loadAccountRanks(request, env);
  const rankList=ranks.ranks||[];
  const list=[];
  for (const r of (rows.results||[])) {
    const profile = await getSafeProfileSettings(db, r.id);
    if (!profile.display_name) profile.display_name = r.username;
    const pr=await getUserAccountProgress(db,r.id);
    list.push({ ...serializeUser(r), created_at:r.created_at||null, ...publicProfileCardFields(profile), ...pr, rank:getDisplayedRank(pr.accountLevel,profile.selected_rank_id,rankList), displayedRank:getDisplayedRank(pr.accountLevel,profile.selected_rank_id,rankList) });
  }
  list.sort((a,b)=>b.accountXp-a.accountXp||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.username||'').localeCompare(String(b.username||'')));
  return json({ok:true,leaderboard:list.slice(0,100).map((x,i)=>({rankPosition:i+1,...x}))}, 200, {'Cache-Control':'private, max-age=60'});
}
function getHomepageTileSeedConfigs() { return [
  { tile_id: 'profile-snapshot', label: 'Profile Spotlight', default_size: '4x1', allowed_sizes: ['2x1','4x1','4x2','4x3','4x4','6x4','8x4'], is_enabled: 1, sort_order: 10 },
  { tile_id: 'quick-actions', label: 'Quick Actions', default_size: '2x2', allowed_sizes: ['1x1','2x1','1x2','2x2','3x2','4x1','4x2'], is_enabled: 1, sort_order: 20 },
  { tile_id: 'grev-dad-tutorial', label: 'grev.dad Tutorial', default_size: '4x2', allowed_sizes: ['4x2','4x3','4x4','6x4','8x4'], is_enabled: 1, sort_order: 25 },
  { tile_id: 'profile-completion', label: 'Profile Completion', default_size: '2x2', allowed_sizes: ['1x1','2x1','1x2','2x2','3x2','4x1','4x2'], is_enabled: 1, sort_order: 30 },
  { tile_id: 'members-preview', label: 'Members Preview', default_size: '4x2', allowed_sizes: ['2x1','4x1','4x2','4x3','4x4','6x4','8x4'], is_enabled: 1, sort_order: 40 },
  { tile_id: 'chat', label: 'Global Chat', default_size: '4x4', allowed_sizes: ['2x1','2x2','4x2','2x4','4x4','6x4','4x6','6x6','8x4','8x6','8x8','10x6','10x8','12x6','12x8','12x12'], is_enabled: 1, sort_order: 50 },
  { tile_id: 'coming-later', label: 'Status', default_size: '2x2', allowed_sizes: ['1x1','2x1','1x2','2x2','3x2','4x1','4x2'], is_enabled: 1, sort_order: 60 },
  { tile_id: 'status', label: 'Status', default_size: '2x2', allowed_sizes: ['1x1','2x1','1x2','2x2','3x2','4x1','4x2'], is_enabled: 1, sort_order: 61 },
  { tile_id: 'profile-status', label: 'Profile Status', default_size: '4x2', allowed_sizes: ['2x1','4x1','4x2','4x3','4x4','6x4'], is_enabled: 0, sort_order: 70 },
  { tile_id: 'showcase-preview', label: 'Showcase Preview', default_size: '4x2', allowed_sizes: ['2x1','4x1','4x2','4x3','4x4','6x4','8x4'], is_enabled: 0, sort_order: 80 },
  { tile_id: 'leaderboard-preview', label: 'Leaderboard Preview', default_size: '4x2', allowed_sizes: ['2x1','4x1','4x2','4x3','4x4','6x4'], is_enabled: 0, sort_order: 90 },
  { tile_id: 'member-spotlight', label: 'Member Spotlight', default_size: '3x2', allowed_sizes: ['3x2','4x2','4x3'], is_enabled: 0, sort_order: 100 },
  { tile_id: 'site-notices', label: 'Site Notices', default_size: '4x2', allowed_sizes: ['2x1','4x1','4x2','4x3','6x4'], is_enabled: 0, sort_order: 110 },
  { tile_id: 'links', label: 'Links', default_size: '2x2', allowed_sizes: ['2x1','2x2','3x2','4x1','4x2'], is_enabled: 1, sort_order: 115 },
  { tile_id: 'admin-quick-tools', label: 'Admin Quick Tools', default_size: '4x2', allowed_sizes: ['2x1','4x1','4x2','4x3','6x4'], is_enabled: 0, sort_order: 120 }
]; }
function parseAllowedSizes(value) { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

async function migrateHomepageTileConfigs(db) {
  const add4x1Tiles = new Set(['profile-snapshot','quick-actions','grev-dad-tutorial','profile-completion','members-preview','coming-later','status','profile-status','showcase-preview','leaderboard-preview','site-notices','links','admin-quick-tools']);
  const rows = await db.prepare('SELECT tile_id, allowed_sizes_json, default_size FROM homepage_tile_config').all();
  for (const row of (rows.results || [])) {
    const allowed = parseAllowedSizes(row.allowed_sizes_json);
    const nextAllowed = Array.from(new Set(allowed));
    let changed = false;
    if (nextAllowed.includes('2x2') && !nextAllowed.includes('2x1')) { nextAllowed.push('2x1'); changed = true; }
    if (add4x1Tiles.has(row.tile_id) && !nextAllowed.includes('4x1')) { nextAllowed.push('4x1'); changed = true; }
    const shouldDefaultProfileSpotlightTo4x1 = row.tile_id === 'profile-snapshot' && row.default_size !== '4x1' && nextAllowed.includes('4x1');
    if (!changed && !shouldDefaultProfileSpotlightTo4x1) continue;
    const nextDefault = shouldDefaultProfileSpotlightTo4x1 ? '4x1' : (nextAllowed.includes(row.default_size) ? row.default_size : (nextAllowed[0] || '1x1'));
    await db.prepare("UPDATE homepage_tile_config SET allowed_sizes_json = ?, default_size = ?, updated_at = datetime('now') WHERE tile_id = ?")
      .bind(JSON.stringify(nextAllowed), nextDefault, row.tile_id).run();
  }
}

function normalizeHomepageTilePayload(tileId, body) { const allowed = Array.isArray(body?.allowed_sizes) ? body.allowed_sizes.map((s) => String(s || '').trim()).filter(Boolean) : []; const invalid = allowed.filter((size) => !HOMEPAGE_TILE_SIZE_OPTIONS.includes(size)); if (!allowed.length) return { error: 'allowed_sizes must contain at least one size' }; if (invalid.length) return { error: `Unsupported size(s): ${invalid.join(', ')}` }; const minSize=TILE_MINIMUM_SIZES[tileId]||TILE_MINIMUM_SIZES.blank; const tooSmall=allowed.some((size)=>{const m=String(size).match(/^(\d+)x(\d+)$/); return m && (Number(m[1])<minSize.minW||Number(m[2])<minSize.minH);}); if(tooSmall) return { error: 'Size is too small for this tile.' }; const defaultSize = String(body?.default_size || '').trim(); if (!allowed.includes(defaultSize)) return { error: 'default_size must be one of allowed_sizes' }; const dm=String(defaultSize).match(/^(\d+)x(\d+)$/); if(dm && (Number(dm[1])<minSize.minW||Number(dm[2])<minSize.minH)) return { error: 'Size is too small for this tile.' }; const isEnabled = Number(body?.is_enabled); if (!(isEnabled === 0 || isEnabled === 1)) return { error: 'is_enabled must be 0 or 1' }; return { tile_id: tileId, label: String(body?.label || '').trim() || tileId, default_size: defaultSize, allowed_sizes: allowed, is_enabled: isEnabled, sort_order: Number(body?.sort_order) || 0 }; }
function defaultHomepageTileConfigs() { return getHomepageTileSeedConfigs().map((tile) => ({ ...tile, allowed_sizes_json: JSON.stringify(tile.allowed_sizes) })); }
async function readHomepageTileConfigs(db, enabledOnly = false) { try { const rows = await db.prepare(`SELECT tile_id, label, default_size, allowed_sizes_json, is_enabled, sort_order FROM homepage_tile_config ${enabledOnly ? 'WHERE is_enabled = 1' : ''} ORDER BY sort_order ASC, tile_id ASC`).all(); return (rows.results || []).map((row) => ({ tile_id: row.tile_id, label: row.label, default_size: row.default_size, allowed_sizes: parseAllowedSizes(row.allowed_sizes_json), is_enabled: Number(row.is_enabled) === 1 ? 1 : 0, sort_order: Number(row.sort_order) || 0 })); } catch (error) { console.warn('[homepage/tile-config] default tile config fallback', friendlyError(error)); return defaultHomepageTileConfigs().filter((tile) => !enabledOnly || Number(tile.is_enabled) === 1); } }
async function handleAdminHomepageTilesGet(request, env) { const auth = await requireAdmin(request, env); if (auth) return auth; const db = getDatabase(env); await ensureSchemaOnce(db); return json({ ok: true, tiles: await readHomepageTileConfigs(db, false) }); }
async function handleAdminHomepageTilesPost(request, env, path) { try { const auth = await requireAdmin(request, env); if (auth) return auth; const tileId = decodeURIComponent(path.split('/').pop() || '').trim(); const db = getDatabase(env); await ensureSchemaOnce(db); const exists = await db.prepare('SELECT tile_id FROM homepage_tile_config WHERE tile_id = ?').bind(tileId).first(); if (!exists) return json({ ok: false, error: 'Unknown tile_id' }, 400); const body = await readJsonBody(request); const normalized = normalizeHomepageTilePayload(tileId, body); if (normalized.error) return json({ ok: false, error: normalized.error }, 400); await db.prepare("UPDATE homepage_tile_config SET label = ?, default_size = ?, allowed_sizes_json = ?, is_enabled = ?, sort_order = ?, updated_at = datetime('now') WHERE tile_id = ?").bind(normalized.label, normalized.default_size, JSON.stringify(normalized.allowed_sizes), normalized.is_enabled, normalized.sort_order, tileId).run(); return json({ ok: true, tile: normalized }); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleHomepageTileConfig(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureCoreSchemaOnce(db); const isAdmin = user.is_admin === 1 || user.is_admin === true || user.role === 'admin'; const tiles = (await readHomepageTileConfigs(db, true)).filter((tile) => isAdmin || tile.tile_id !== 'admin-quick-tools').map((tile)=>({ ...tile, adminOnly: tile.tile_id === 'admin-quick-tools' ? 1 : 0 })); return json({ ok: true, tiles }); }

async function handleProfileMyShowcaseUnlocks(request, env){ const user=await getCurrentUser(request, env); if(!user) return json({ok:false,error:'Not logged in'},401); const db=getDatabase(env); await ensureSchemaOnce(db); const rows=await db.prepare("SELECT u.catalog_item_id as id,c.item_key,c.item_type,c.name,c.description,c.icon_url,c.rarity FROM user_showcase_unlocks u JOIN showcase_catalog c ON c.id=u.catalog_item_id WHERE u.user_id=? ORDER BY c.name").bind(user.id).all(); return json({ok:true,unlocks:rows.results||[]}); }
function parseRankCsv(csvText) {
  const lines = String(csvText || "").replace(new RegExp("\r", "g"), "").split("\n");
  if (!lines.length) return [];

  const header = parseCsvLine(lines.shift() || "").map((value) => value.trim().toLowerCase());
  const levelIndex = header.indexOf("level");
  const rankNameIndex = header.indexOf("rank_name");
  const rankIdIndex = header.indexOf("rank_id");

  if (levelIndex === -1 || rankNameIndex === -1) return [];

  const ranks = [];

  for (const line of lines) {
    if (!line || !line.trim()) continue;

    const cells = parseCsvLine(line);
    const level = Number.parseInt(String(cells[levelIndex] || "").trim(), 10);
    const name = String(cells[rankNameIndex] || "").trim();
    const explicitId = rankIdIndex >= 0 ? String(cells[rankIdIndex] || "").trim() : "";

    if (!Number.isFinite(level) || level < 0 || !name) continue;

    const id = explicitId ? getRankIdFromName(explicitId) : getRankIdFromName(name);

    ranks.push({
      id,
      name,
      level
    });
  }

  return ranks.sort((a, b) => a.level - b.level);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function getRankIdFromName(rankName) {
  return String(rankName || "")
    .trim()
    .toLowerCase()
    .replace(new RegExp("[^a-z0-9]+", "g"), "_")
    .replace(new RegExp("_+", "g"), "_")
    .replace(new RegExp("^_+|_+$", "g"), "");
}

function getUnlockedRanks(accountLevel, ranks) {
  const level = Number(accountLevel) || 1;
  return ranks.filter((rank) => rank.level <= level);
}

function getDefaultRankForLevel(accountLevel, ranks) {
  const unlocked = getUnlockedRanks(accountLevel, ranks);
  return unlocked.length ? unlocked[unlocked.length - 1] : null;
}

function getRankById(rankId, ranks) {
  const id = String(rankId || "").trim();
  if (!id) return null;
  return ranks.find((rank) => rank.id === id) || null;
}

function getDisplayedRank(accountLevel, selectedRankId, ranks) {
  const unlocked = getUnlockedRanks(accountLevel, ranks);
  const selected = getRankById(selectedRankId, ranks);

  if (selected && unlocked.some((rank) => rank.id === selected.id)) {
    return selected;
  }

  return getDefaultRankForLevel(accountLevel, ranks);
}

async function loadAccountRanks(request, env) {
  if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') {
    return {
      ok: false,
      error: "Static assets binding ASSETS is not configured. Add assets.binding = 'ASSETS' in wrangler.jsonc."
    };
  }

  try {
    if (accountRankCache && Array.isArray(accountRankCache.ranks) && accountRankCache.ranks.length) {
      return { ok: true, ranks: accountRankCache.ranks };
    }

    const assetUrl = new URL('/data/grev_dad_account_ranks.csv', request.url);
    const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }));

    if (!response.ok) {
      return { ok: false, error: `Could not load account rank CSV from /data/grev_dad_account_ranks.csv (HTTP ${response.status})` };
    }

    const ranks = parseRankCsv(await response.text());
    if (!ranks.length) {
      return { ok: false, error: 'Account rank CSV loaded but no valid ranks were found' };
    }

    accountRankCache = { ranks };
    return { ok: true, ranks };
  } catch (error) {
    return { ok: false, error: `Could not load account rank CSV from /data/grev_dad_account_ranks.csv (${friendlyError(error)})` };
  }
}


function normalizeShowcaseCatalogInput(body) { const name=String(body?.name||'').trim(); const description=String(body?.description||'').trim(); const rarity=String(body?.rarity||'common').trim().toLowerCase(); const image_url=String(body?.image_url ?? body?.icon_url ?? '').trim(); const is_active=Number(body?.is_active); if(!name) return { error:'name is required' }; if(description.length>500) return { error:'description must be 500 characters or fewer' }; if(image_url.length>500) return { error:'image_url must be 500 characters or fewer' }; if(!UNLOCK_RARITIES.has(rarity)) return { error:'Invalid rarity' }; if(!(is_active===0 || is_active===1 || Number.isNaN(is_active))) return { error:'is_active must be 0 or 1' }; return { name, description:description||null, rarity, image_url:image_url||null, is_active:is_active===0?0:1 }; }
function makeSlug(value){ return String(value||'').trim().toLowerCase().replace(new RegExp('[^a-z0-9]+','g'),'_').replace(new RegExp('_+','g'),'_').replace(new RegExp('^_+|_+$','g'),'') || 'item'; }
async function generateUniqueShowcaseKey(db, preferred){ const base=makeSlug(preferred); let key=base; let n=2; while(await db.prepare('SELECT id FROM showcase_catalog WHERE item_key=?').bind(key).first()){ key=`${base}_${n}`; n+=1; } return key; }
async function handleAdminShowcaseCatalog(request, env){const auth=await requireAdmin(request, env); if(auth) return auth; const db=getDatabase(env); await ensureSchemaOnce(db); const rows=await db.prepare("SELECT id,item_key,name,description,rarity,COALESCE(image_url,icon_url,'') as image_url,is_active,created_at,updated_at FROM showcase_catalog ORDER BY id DESC").all(); return json({ok:true,items:rows.results||[]});}
async function handleAdminShowcaseCatalogCreate(request, env){try{const auth=await requireAdmin(request, env); if(auth) return auth; const b=await readJsonBody(request); const v=normalizeShowcaseCatalogInput(b); if(v.error) return json({ok:false,error:v.error},400); const db=getDatabase(env); await ensureSchemaOnce(db); const itemKey=await generateUniqueShowcaseKey(db, String(b?.item_key||v.name)); await db.prepare("INSERT INTO showcase_catalog (item_key,item_type,name,description,icon_url,image_url,source,rarity,is_active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))").bind(itemKey,'other',v.name,v.description,v.image_url,v.image_url,'admin',v.rarity,v.is_active).run(); return json({ok:true,item_key:itemKey});}catch(error){return json({ok:false,error:friendlyError(error)},500);}}
async function handleAdminShowcaseCatalogUpdate(request, env, path){try{const auth=await requireAdmin(request, env); if(auth) return auth; const id=Number(path.split('/').pop()); if(!Number.isInteger(id)||id<1) return json({ok:false,error:'Invalid id'},400); const b=await readJsonBody(request); const v=normalizeShowcaseCatalogInput(b); if(v.error) return json({ok:false,error:v.error},400); const db=getDatabase(env); await ensureSchemaOnce(db); const existing=await db.prepare('SELECT id FROM showcase_catalog WHERE id=?').bind(id).first(); if(!existing) return json({ok:false,error:'Item not found'},404); await db.prepare("UPDATE showcase_catalog SET name=?,description=?,icon_url=?,image_url=?,rarity=?,is_active=?,updated_at=datetime('now') WHERE id=?").bind(v.name,v.description,v.image_url,v.image_url,v.rarity,v.is_active,id).run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);}}
async function handleAdminShowcaseCatalogToggle(request, env, path){try{const auth=await requireAdmin(request, env); if(auth) return auth; const id=Number(path.split('/')[5]); if(!Number.isInteger(id)||id<1) return json({ok:false,error:'Invalid id'},400); const db=getDatabase(env); await ensureSchemaOnce(db); const ex=await db.prepare('SELECT id FROM showcase_catalog WHERE id=?').bind(id).first(); if(!ex) return json({ok:false,error:'Item not found'},404); await db.prepare("UPDATE showcase_catalog SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END, updated_at=datetime('now') WHERE id=?").bind(id).run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);}}
async function handleAdminGrantCatalogUnlock(request, env, path){try{const auth=await requireAdmin(request, env); if(auth) return auth; const userId=Number(path.split('/')[4]); const b=await readJsonBody(request); const itemId=Number(b.catalog_item_id); if(!Number.isInteger(userId)||userId<1) return json({ok:false,error:'Invalid user id'},400); if(!Number.isInteger(itemId)||itemId<1) return json({ok:false,error:'catalog_item_id required'},400); const db=getDatabase(env); await ensureSchemaOnce(db); const user=await db.prepare('SELECT id FROM users WHERE id=?').bind(userId).first(); if(!user) return json({ok:false,error:'User not found'},404); const item=await db.prepare('SELECT id FROM showcase_catalog WHERE id=?').bind(itemId).first(); if(!item) return json({ok:false,error:'Catalogue item not found'},404); await db.prepare("INSERT OR IGNORE INTO user_showcase_unlocks (user_id,catalog_item_id,unlock_source) VALUES (?,?,?)").bind(userId,itemId,String(b.unlock_source||'admin').trim()||'admin').run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);}}


async function requireChatUser(request, env) { const user = await getCurrentUser(request, env); if (!user) return { error: json({ ok: false, error: 'Not logged in' }, 401) }; return { user }; }
async function getChatRoomForUser(db, userId, roomId) { return db.prepare(`SELECT r.id, r.room_key, r.room_type, r.name FROM chat_rooms r LEFT JOIN chat_room_members m ON m.room_id = r.id AND m.user_id = ? WHERE r.id = ? AND (r.room_type = 'global' OR m.user_id IS NOT NULL)`).bind(userId, roomId).first(); }
async function handleChatRooms(request, env) { const auth = await requireChatUser(request, env); if (auth.error) return auth.error; const db=getDatabase(env); await ensureCoreSchemaOnce(db); const rows=await db.prepare(`SELECT r.id, r.room_key, r.room_type, r.name, COALESCE((SELECT COUNT(1) FROM chat_messages cm WHERE cm.room_id=r.id AND cm.deleted_at IS NULL AND cm.id > COALESCE(m.last_read_message_id,0)),0) as unread_count FROM chat_rooms r LEFT JOIN chat_room_members m ON m.room_id=r.id AND m.user_id=? WHERE r.room_type='global' OR m.user_id IS NOT NULL ORDER BY r.room_type='global' DESC, r.updated_at DESC`).bind(auth.user.id).all(); return json({ok:true,rooms:(rows.results||[]).map(r=>({...r,unread_count:Number(r.unread_count||0)}))}); }
async function handleChatMessagesGet(request, env){ const auth=await requireChatUser(request, env); if(auth.error) return auth.error; const db=getDatabase(env); await ensureCoreSchemaOnce(db); const url=new URL(request.url); const roomId=Number(url.searchParams.get('room_id')); const afterId=Number(url.searchParams.get('after_id')||0); if(!Number.isInteger(roomId)||roomId<1) return json({ok:false,error:'Invalid room_id'},400); const room=await getChatRoomForUser(db,auth.user.id,roomId); if(!room) return json({ok:false,error:'Room not found'},404); let q='SELECT m.id,m.room_id,m.sender_user_id,u.username as sender_username,COALESCE(p.display_name,u.username) as sender_display_name,COALESCE(p.avatar_url,"") as sender_avatar_url,CASE WHEN m.deleted_at IS NULL THEN m.body ELSE "[deleted]" END as body,m.created_at FROM chat_messages m JOIN users u ON u.id=m.sender_user_id LEFT JOIN user_profiles p ON p.user_id=u.id WHERE m.room_id=?'; const binds=[roomId]; if(Number.isInteger(afterId)&&afterId>0){q+=' AND m.id>?'; binds.push(afterId);} q+=' ORDER BY m.id DESC LIMIT 50'; const rows=await db.prepare(q).bind(...binds).all(); const ranks = await loadAccountRanks(request, env); const rankList = ranks.ok ? ranks.ranks : []; const messages=[]; for (const row of ((rows.results||[]).reverse())) { const progress = await getUserAccountProgress(db, row.sender_user_id); const rank = getDisplayedRank(progress.accountLevel, null, rankList) || null; messages.push({ ...row, sender_accountLevel: progress.accountLevel || 1, sender_rank: rank ? { id: rank.id, name: rank.name, level: rank.level } : null }); } return json({ok:true,messages}); }

async function handleChatMessagesPost(request, env){ try{const auth=await requireChatUser(request, env); if(auth.error) return auth.error; const body=await readJsonBody(request); const roomId=Number(body?.room_id); const text=String(body?.body??'').trim(); if(!Number.isInteger(roomId)||roomId<1) return json({ok:false,error:'Invalid room_id'},400); if(!text) return json({ok:false,error:'Message body required'},400); if(text.length>1000) return json({ok:false,error:'Message too long'},400); const db=getDatabase(env); await ensureSchemaOnce(db); const room=await getChatRoomForUser(db,auth.user.id,roomId); if(!room) return json({ok:false,error:'Room not found'},404); const r=await db.prepare('INSERT INTO chat_messages (room_id, sender_user_id, body) VALUES (?,?,?)').bind(roomId,auth.user.id,text).run(); await db.prepare("UPDATE chat_rooms SET updated_at=datetime('now') WHERE id=?").bind(roomId).run(); const msg=await db.prepare(`SELECT m.id,m.room_id,m.sender_user_id,u.username as sender_username,COALESCE(p.display_name,u.username) as sender_display_name,COALESCE(p.avatar_url,"") as sender_avatar_url,m.body,m.created_at FROM chat_messages m JOIN users u ON u.id=m.sender_user_id LEFT JOIN user_profiles p ON p.user_id=u.id WHERE m.id=?`).bind(r.meta.last_row_id).first(); const ranks=await loadAccountRanks(request, env); const rankList=ranks.ok?ranks.ranks:[]; const progress=await getUserAccountProgress(db, auth.user.id); const rank=getDisplayedRank(progress.accountLevel,null,rankList)||null; return json({ok:true,message:{...msg,sender_accountLevel:progress.accountLevel||1,sender_rank:rank?{id:rank.id,name:rank.name,level:rank.level}:null}},201);}catch(error){return json({ok:false,error:friendlyError(error)},500);} }
async function handleChatDirect(request, env){ try{const auth=await requireChatUser(request, env); if(auth.error) return auth.error; const body=await readJsonBody(request); const username=String(body?.username||'').trim(); if(!username) return json({ok:false,error:'username required'},400); const db=getDatabase(env); await ensureSchemaOnce(db); const target=await db.prepare('SELECT id, username FROM users WHERE username=?').bind(username).first(); if(!target) return json({ok:false,error:'User not found'},404); if(Number(target.id)===Number(auth.user.id)) return json({ok:false,error:'Cannot message yourself'},400); const [a,b]=[Number(auth.user.id),Number(target.id)].sort((x,y)=>x-y); const roomKey=`direct:${a}:${b}`; let room=await db.prepare('SELECT id, room_type, name FROM chat_rooms WHERE room_key=?').bind(roomKey).first(); if(!room){const name='Chat with '+target.username; const created=await db.prepare("INSERT INTO chat_rooms (room_key, room_type, name, created_by) VALUES (?, 'direct', ?, ?)").bind(roomKey,name,auth.user.id).run(); room={id:created.meta.last_row_id,room_type:'direct',name};} await db.prepare('INSERT OR IGNORE INTO chat_room_members (room_id, user_id) VALUES (?, ?)').bind(room.id, a).run(); await db.prepare('INSERT OR IGNORE INTO chat_room_members (room_id, user_id) VALUES (?, ?)').bind(room.id, b).run(); return json({ok:true,room:{id:room.id,room_type:'direct',name:room.name}});}catch(error){return json({ok:false,error:friendlyError(error)},500);} }
async function handleChatRead(request, env){ try{const auth=await requireChatUser(request, env); if(auth.error) return auth.error; const body=await readJsonBody(request); const roomId=Number(body?.room_id); const lastRead=Number(body?.last_read_message_id); if(!Number.isInteger(roomId)||roomId<1||!Number.isInteger(lastRead)||lastRead<0) return json({ok:false,error:'Invalid payload'},400); const db=getDatabase(env); await ensureSchemaOnce(db); const room=await getChatRoomForUser(db,auth.user.id,roomId); if(!room) return json({ok:false,error:'Room not found'},404); await db.prepare("INSERT INTO chat_room_members (room_id, user_id, last_read_message_id) VALUES (?,?,?) ON CONFLICT(room_id,user_id) DO UPDATE SET last_read_message_id=excluded.last_read_message_id").bind(roomId,auth.user.id,lastRead).run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);} }
async function handleAdminChatDelete(request, env, path){ try{const auth=await requireAdmin(request, env); if(auth) return auth; const id=Number(path.split('/')[5]); if(!Number.isInteger(id)||id<1) return json({ok:false,error:'Invalid id'},400); const db=getDatabase(env); await ensureSchemaOnce(db); await db.prepare("UPDATE chat_messages SET deleted_at=datetime('now') WHERE id=?").bind(id).run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);} }

const steamProfileCache = new Map();
const leetifyProfileCache = new Map();
const STEAM_PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;
const LEETIFY_PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;
function parseSteamIdFromUrl(url) { try { const u = new URL(url); const m1 = u.pathname.match(/\/profiles\/(\d{17})/); if (m1) return { steamid: m1[1], vanity: null }; const m2 = u.pathname.match(/\/id\/([^/]+)/); if (m2) return { steamid: null, vanity: m2[1] }; } catch {} return { steamid: null, vanity: null }; }

function parseLeetifyFromUrl(rawUrl) {
  try {
    const parsed = parseLeetifyProfileIdentifier(rawUrl);
    return {
      profileUrl: parsed.profileUrl || '',
      steamId64: parsed.steamId64 || '',
      steamid64: parsed.steamId64 || null,
      identifier: parsed.identifier || parsed.slugOrIdentifier || '',
      slug: parsed.identifier || parsed.slugOrIdentifier || null,
      sourcePath: parsed.sourcePath || ''
    };
  } catch {
    return { profileUrl: '', steamId64: '', steamid64: null, identifier: '', slug: null, sourcePath: '' };
  }
}
function readLeetifyCache(cacheKey) { const cached = leetifyProfileCache.get(cacheKey); if (!cached) return null; if (cached.expiresAt < Date.now()) { leetifyProfileCache.delete(cacheKey); return null; } return { ...cached.data, cache:{ hit:true, ttlSeconds: Math.max(0, Math.ceil((cached.expiresAt-Date.now())/1000)) } }; }
function writeLeetifyCache(cacheKey, data, ttlMs=LEETIFY_PROFILE_CACHE_TTL_MS) { const stored={ ...data, cache:{ hit:false, ttlSeconds: Math.ceil(ttlMs/1000) } }; leetifyProfileCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, data:stored }); return stored; }
async function handleLeetifyProfile(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ ok:false, error:'Not logged in' },401);
  const db=getDatabase(env);
  await ensureCoreSchemaOnce(db);
  const url = new URL(request.url);
  const requestedId = url.searchParams.get('user_id') || url.searchParams.get('id');
  const userId = requestedId ? Number(requestedId) : Number(user.id);
  if(!Number.isInteger(userId)||userId<1) return json({ ok:false, error:'Invalid user id' },400);
  const row=await getSafeProfileSettings(db, userId);
  const savedUrl=String(row?.leetify_profile_url || row?.leetify_url || '').trim();
  if(!savedUrl) return json({ ok:true, available:false, source:'leetify', reasonCode:'no_profile_link', reason:'No Leetify profile link set', attribution: LEETIFY_ATTRIBUTION });
  let parsedSaved;
  try { parsedSaved = parseLeetifyProfileIdentifier(savedUrl); } catch { return json({ ok:true, available:false, source:'leetify', profileUrl:savedUrl, viewUrl:savedUrl, reasonCode:'invalid_url', reason:'Saved Leetify profile URL is invalid.', attribution: LEETIFY_ATTRIBUTION }); }
  const profileUrl = parsedSaved.profileUrl;
  const parsed=parseLeetifyFromUrl(profileUrl);
  const legacyParsed = row?.leetify_url && row.leetify_url !== savedUrl ? parseLeetifyFromUrl(row.leetify_url) : { identifier:'' };
  const debugRequested = request.headers.get('x-grev-debug-integrations') === '1' || url.searchParams.get('debug') === '1';
  const debug = debugRequested && (Number(user.id) === userId || isUserAdmin(user));
  const debugParsed = { profileUrl, steamId64: parsed.steamId64 || '', identifier: parsed.identifier || '', sourcePath: parsed.sourcePath || '' };
  const cacheKey=`${userId}|${profileUrl}|${row?.leetify_steam_id||''}|debug:${debug ? 1 : 0}`;
  const cached=readLeetifyCache(cacheKey);
  if(cached) return json(cached);
  const attempts = [];
  const withDebug = (payload) => ({ ...payload, ...(debug?{ parsed: debugParsed, attempts }: {}) });
  const unavailable = (reason='Leetify data unavailable', status=null, reasonCode='unknown') => withDebug({ ok:true, available:false, source:'leetify', profileUrl, viewUrl:profileUrl, steamId64:parsed.steamId64||row?.leetify_steam_id||null, identifier:parsed.identifier||null, sourcePath:parsed.sourcePath||null, reasonCode, reason, attribution: LEETIFY_ATTRIBUTION, ...(status?{status}:{}) });
  const attemptsToTry = [];
  const addAttempt = (kind, candidate, endpoint) => {
    const value = String(candidate || '').trim();
    if (!value || attemptsToTry.some((attempt) => attempt.endpoint === endpoint)) return;
    attemptsToTry.push({ kind, candidate:value, endpoint });
  };
  if (row?.leetify_steam_id) addAttempt('steamId', row.leetify_steam_id, `https://api-public.cs-prod.leetify.com/v3/profile?steamId=${encodeURIComponent(row.leetify_steam_id)}`);
  if (parsed.steamId64 && parsed.steamId64 !== row?.leetify_steam_id) addAttempt('steamId', parsed.steamId64, `https://api-public.cs-prod.leetify.com/v3/profile?steamId=${encodeURIComponent(parsed.steamId64)}`);
  if (parsed.identifier && !/^7656119\d{10}$/.test(parsed.identifier)) addAttempt('leetifyUserId', parsed.identifier, `https://api-public.cs-prod.leetify.com/v3/profile?leetifyUserId=${encodeURIComponent(parsed.identifier)}`);
  if (legacyParsed.identifier && !/^7656119\d{10}$/.test(legacyParsed.identifier)) addAttempt('leetifyUserId', legacyParsed.identifier, `https://api-public.cs-prod.leetify.com/v3/profile?leetifyUserId=${encodeURIComponent(legacyParsed.identifier)}`);
  if (!attemptsToTry.length) return json(writeLeetifyCache(cacheKey, unavailable('Leetify profile URL could not be parsed', null, 'invalid_url'), 120000));
  const headers = { 'Accept':'application/json', ...(env?.LEETIFY_API_KEY ? { 'Authorization': `Bearer ${env.LEETIFY_API_KEY}` } : {}) };
  const previewResponse = (json) => json && typeof json === 'object' ? ({
    hasId: Boolean(json.id),
    hasName: Boolean(json.name || json.nickname || json.profile?.name || json.user?.name),
    hasSteamId: Boolean(json.steam64_id || json.steam64Id || json.steamId64 || json.steam_id || json.steamId),
    hasRanks: Boolean(json.ranks || json.rank || json.cs2?.rank || json.competitive?.rank),
    hasRating: Boolean(json.leetifyRating || json.rating || json.ratings),
    hasStats: Boolean(json.stats || json.aimRating || json.positioningRating || json.utilityRating || json.clutchRating || json.openingDuelRating),
    hasRecentMatches: Boolean(json.recent_matches || json.recentMatches || json.matches?.recent)
  }) : null;
  for (const attemptToTry of attemptsToTry) {
    const { kind, candidate, endpoint } = attemptToTry;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(()=>ctrl.abort('timeout'), 5000) : null;
    const attempt = { kind, candidate, endpoint, status: null, ok: false, reason: 'pending', responseKeys: [], topLevelPreview: null, bodyPreview: null };
    attempts.push(attempt);
    try {
      const resp = await fetch(endpoint, { headers, ...(ctrl?{signal:ctrl.signal}:{}) });
      attempt.status = resp.status;
      if (debug) console.debug('[leetify] endpoint', { userId, kind, candidate, endpoint, status: resp.status, ok: resp.ok });
      const text = await resp.text();
      if (debug) attempt.bodyPreview = text.slice(0, 500);
      let payload = null;
      if (text) {
        try { payload = JSON.parse(text); }
        catch {
          attempt.reason = resp.ok ? 'invalid_json' : `status_${resp.status}`;
          continue;
        }
      }
      if (payload && typeof payload === 'object') {
        attempt.responseKeys = Object.keys(payload);
        attempt.topLevelPreview = previewResponse(payload);
      }
      if (!resp.ok) {
        attempt.reason = [401,403,404,429].includes(resp.status) ? `status_${resp.status}` : 'http_error';
        continue;
      }
      const profile = payload?.profile || payload?.data?.profile || payload?.data || payload;
      if (!profile || typeof profile !== 'object') {
        attempt.reason = 'unexpected_response_shape';
        continue;
      }
      if (profile !== payload && profile && typeof profile === 'object') {
        attempt.topLevelPreview = { ...attempt.topLevelPreview, profileKeys: Object.keys(profile).slice(0, 30), profilePreview: previewResponse(profile) };
      }
      const normalized = normalizeLeetifyProfile(profile, profileUrl, parsed.steamId64 || row?.leetify_steam_id || null);
      if (!hasMeaningfulLeetifyData(normalized)) {
        attempt.reason = 'no_meaningful_data';
        return json(writeLeetifyCache(cacheKey, unavailable('Leetify Public API did not return usable data for this profile. The profile page can still be public on Leetify.com, but grev.dad only uses the official Public API and does not scrape Leetify pages.', 200, 'no_api_profile_data'), 120000));
      }
      attempt.ok = true;
      attempt.reason = 'ok';
      return json(writeLeetifyCache(cacheKey, withDebug(normalized)));
    } catch (error) {
      attempt.reason = error?.name === 'AbortError' || String(error?.message||error).includes('timeout') ? 'timeout' : 'fetch_failed';
      if (debug) console.debug('[leetify] fetch failed', { endpoint, error: String(error&&error.message||error) });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  if (attempts.length && attempts.every((attempt) => Number(attempt.status) === 404)) {
    return json(writeLeetifyCache(cacheKey, unavailable('Leetify Public API did not return this profile. The saved Leetify page can still be public in a browser, but the Public API may require the profile to be registered/non-hidden or available to third-party API access.', 404, 'not_found'), 120000));
  }
  const statusAttempt = attempts.find((attempt) => [401, 403, 404, 429].includes(Number(attempt.status)));
  const noDataAttempt = attempts.find((attempt) => attempt.reason === 'no_meaningful_data');
  const invalidJsonAttempt = attempts.find((attempt) => attempt.reason === 'invalid_json');
  const shapeAttempt = attempts.find((attempt) => attempt.reason === 'unexpected_response_shape');
  const timeoutAttempt = attempts.find((attempt) => attempt.reason === 'timeout');
  const status = Number(statusAttempt?.status);
  const reason = status === 404
    ? 'Leetify Public API did not return this profile. The saved Leetify page can still be public in a browser, but the Public API may require the profile to be registered/non-hidden or available to third-party API access.'
    : (status === 401 || status === 403)
      ? 'Leetify Public API rejected this request. A site-wide API key may be required, or the profile may not be available to third-party apps.'
      : status === 429
        ? 'Leetify Public API rate limit reached. Try again later.'
        : noDataAttempt
          ? 'Leetify Public API did not return usable data for this profile. The profile page can still be public on Leetify.com, but grev.dad only uses the official Public API and does not scrape Leetify pages.'
          : invalidJsonAttempt
            ? 'Leetify endpoint returned invalid JSON'
            : shapeAttempt
              ? 'Leetify response shape changed or profile data is unavailable'
              : timeoutAttempt
                ? 'Leetify endpoint timed out'
                : 'Leetify data unavailable';
  const reasonCode = status === 404 ? 'not_found' : (status === 401 || status === 403) ? 'api_rejected' : status === 429 ? 'rate_limited' : noDataAttempt ? 'no_api_profile_data' : timeoutAttempt ? 'api_unavailable' : 'unknown';
  return json(writeLeetifyCache(cacheKey, unavailable(reason, statusAttempt?.status || null, reasonCode), reasonCode === 'unknown' ? 120000 : 60000));
}

function pickDeep(obj, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], obj);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function normalizeLeetifyProfile(profile, profileUrl, steam64IdFromUrl) {
  function numberOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'string' && !v.trim()) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '') ?? null;
  const steam64Id = pickDeep(profile, ['steam64_id','steam64Id','steamId64','steam_id','steamId','steamID64','steamid64','data.steam64_id','data.steam64Id','data.steamId64','data.steam_id','data.steamId','profile.steam64_id','profile.steam64Id','profile.steamId64','profile.steam_id','profile.steamId','user.steam64_id','user.steam64Id','user.steamId64','user.steam_id','user.steamId']) || steam64IdFromUrl || null;
  const csPremierRating = numberOrNull(pickDeep(profile, ['csPremierRating','premierRating','ranks.premier','ranks.premier_rating','ranks.premierRating','rank.premier','cs2.premierRating','cs2.premier_rating','data.csPremierRating','data.premierRating','data.ranks.premier','data.ranks.premier_rating','data.ranks.premierRating','data.rank.premier','data.cs2.premierRating','data.cs2.premier_rating','profile.csPremierRating','profile.premierRating','profile.ranks.premier','profile.ranks.premier_rating','profile.ranks.premierRating','profile.rank.premier','profile.cs2.premierRating','profile.cs2.premier_rating']));
  const rankValue = pickDeep(profile, ['csRank','rank','rank.name','rank.label','ranks.current','ranks.competitive','cs2.rank','competitive.rank','currentRank','data.csRank','data.rank','data.rank.name','data.rank.label','data.ranks.current','data.ranks.competitive','data.cs2.rank','data.competitive.rank','data.currentRank','profile.csRank','profile.rank','profile.rank.name','profile.rank.label','profile.ranks.current','profile.ranks.competitive','profile.cs2.rank','profile.competitive.rank','profile.currentRank']);
  let csRank = null, csRankType = null;
  if (typeof rankValue === 'string' && rankValue.trim()) { csRank = rankValue.trim(); csRankType = 'competitive'; }
  else if (rankValue && typeof rankValue === 'object') {
    const label = pick(rankValue.name, rankValue.label, rankValue.rank, rankValue.rankName, rankValue.value);
    if (typeof label === 'string' && label.trim()) { csRank = label.trim(); csRankType = 'competitive'; }
  }
  if (!csRank && csPremierRating !== null) { csRank = `Premier ${csPremierRating.toLocaleString('en-US')}`; csRankType = 'premier'; }
  const mapRanksRaw = pickDeep(profile, ['csCompetitiveRanks','competitiveRanks','ranks.maps','ranks.mapRanks','mapRanks','competitive.mapRanks','data.csCompetitiveRanks','data.competitiveRanks','data.ranks.maps','data.ranks.mapRanks','data.mapRanks','data.competitive.mapRanks','profile.csCompetitiveRanks','profile.competitiveRanks','profile.ranks.maps','profile.ranks.mapRanks','profile.mapRanks','profile.competitive.mapRanks']);
  let csCompetitiveRanks = null;
  if (Array.isArray(mapRanksRaw) && mapRanksRaw.length) {
    csCompetitiveRanks = mapRanksRaw;
    if (!csRank) {
      const first = mapRanksRaw.find(Boolean);
      if (typeof first === 'string') { csRank = first; csRankType = 'map'; }
      else if (first && typeof first === 'object') { const label = pick(first.rank, first.csRank, first.value, first.name, first.label); if (label) { csRank = String(label); csRankType = 'map'; } }
    }
  } else if (mapRanksRaw && typeof mapRanksRaw === 'object') {
    const mapped = {};
    for (const [k,v] of Object.entries(mapRanksRaw)) {
      if (typeof v === 'string' && v.trim()) mapped[k]=v.trim();
      else if (v && typeof v==='object') { const label=pick(v.name,v.label,v.rank,v.rankName,v.csRank,v.value); if (typeof label==='string' && label.trim()) mapped[k]=label.trim(); }
    }
    if (Object.keys(mapped).length) {
      csCompetitiveRanks = mapped;
      if (!csRank) { csRank = Object.values(mapped)[0] || null; csRankType = csRank ? 'map' : null; }
    }
  }
  const recentMatchesRaw = pickDeep(profile, ['recentMatches','recent_matches','matches.recent','data.recentMatches','data.recent_matches','data.matches.recent','profile.recentMatches','profile.recent_matches','profile.matches.recent']);
  const recentMatches = Array.isArray(recentMatchesRaw) ? recentMatchesRaw.slice(0, 10).map((m)=>({ id: m?.id || m?.matchId || m?.match_id || null, mapName: m?.mapName || m?.map_name || m?.map || null, finishedAt: m?.finishedAt || m?.finished_at || m?.date || m?.createdAt || m?.created_at || null, result: m?.result || null, score: m?.score || null })) : [];
  const explicitRecentCount = numberOrNull(pickDeep(profile, ['recentMatchesCount','recent_matches_count','recentMatches.length','recent_matches.length','totalMatches','total_matches','data.recentMatchesCount','data.recent_matches_count','data.recentMatches.length','data.recent_matches.length','data.totalMatches','data.total_matches','profile.recentMatchesCount','profile.recent_matches_count','profile.recentMatches.length','profile.recent_matches.length','profile.totalMatches','profile.total_matches']));
  const totalMatches = numberOrNull(pickDeep(profile, ['totalMatches','total_matches','data.totalMatches','data.total_matches','profile.totalMatches','profile.total_matches']));
  const rawUpdatedAt = pickDeep(profile, ['rawUpdatedAt','updatedAt','updated_at','lastUpdatedAt','last_updated_at','data.rawUpdatedAt','data.updatedAt','data.updated_at','data.lastUpdatedAt','data.last_updated_at','profile.rawUpdatedAt','profile.updatedAt','profile.updated_at','profile.lastUpdatedAt','profile.last_updated_at']) || null;
  return {
    ok:true, available:true, source:'leetify', attribution: LEETIFY_ATTRIBUTION, profileUrl, viewUrl: profileUrl, steamId64: steam64Id,
    leetifyUserId: pickDeep(profile, ['id','leetifyUserId','leetify_user_id','data.id','data.leetifyUserId','data.leetify_user_id','profile.id','profile.leetifyUserId','profile.leetify_user_id']) || null,
    privacyMode: pickDeep(profile, ['privacy_mode','privacyMode','data.privacy_mode','data.privacyMode','profile.privacy_mode','profile.privacyMode']) || null,
    bans: pickDeep(profile, ['bans','data.bans','profile.bans']) || null,
    name: pickDeep(profile, ['name','nickname','profile.name','user.name','data.name','data.nickname','data.profile.name','data.user.name']) || null,
    nickname: pickDeep(profile, ['nickname','name','profile.nickname','user.nickname','data.nickname','data.name','data.profile.nickname','data.user.nickname']) || null,
    avatarUrl: pickDeep(profile, ['avatar_url','avatarUrl','avatar','profile.avatar_url','data.avatar_url','data.avatarUrl','data.avatar','data.profile.avatar_url','user.avatar_url','user.avatarUrl']) || null,
    leetifyRating: numberOrNull(pickDeep(profile, ['leetifyRating','rating.leetify','rating.overall','ratings.leetify','ratings.overall','data.leetifyRating','data.rating.leetify','data.rating.overall','data.ratings.leetify','data.ratings.overall','profile.leetifyRating','profile.rating.leetify','profile.rating.overall','profile.ratings.leetify','profile.ratings.overall'])),
    aimRating: numberOrNull(pickDeep(profile, ['aimRating','rating.aim','ratings.aim','stats.aim','data.aimRating','data.rating.aim','data.ratings.aim','data.stats.aim','profile.aimRating','profile.rating.aim','profile.ratings.aim','profile.stats.aim'])),
    positioningRating: numberOrNull(pickDeep(profile, ['positioningRating','rating.positioning','ratings.positioning','stats.positioning','data.positioningRating','data.rating.positioning','data.ratings.positioning','data.stats.positioning','profile.positioningRating','profile.rating.positioning','profile.ratings.positioning','profile.stats.positioning'])),
    utilityRating: numberOrNull(pickDeep(profile, ['utilityRating','rating.utility','ratings.utility','stats.utility','data.utilityRating','data.rating.utility','data.ratings.utility','data.stats.utility','profile.utilityRating','profile.rating.utility','profile.ratings.utility','profile.stats.utility'])),
    clutchRating: numberOrNull(pickDeep(profile, ['clutchRating','rating.clutch','ratings.clutch','stats.clutch','data.clutchRating','data.rating.clutch','data.ratings.clutch','data.stats.clutch','profile.clutchRating','profile.rating.clutch','profile.ratings.clutch','profile.stats.clutch'])),
    openingDuelRating: numberOrNull(pickDeep(profile, ['openingDuelRating','rating.openingDuel','rating.opening_duel','ratings.openingDuel','ratings.opening_duel','stats.openingDuel','stats.opening_duel','data.openingDuelRating','data.rating.openingDuel','data.rating.opening_duel','data.ratings.openingDuel','data.ratings.opening_duel','data.stats.openingDuel','data.stats.opening_duel','profile.openingDuelRating','profile.rating.openingDuel','profile.rating.opening_duel','profile.ratings.openingDuel','profile.ratings.opening_duel','profile.stats.openingDuel','profile.stats.opening_duel'])),
    recentMatchesCount: explicitRecentCount !== null ? explicitRecentCount : (recentMatches.length ? recentMatches.length : null),
    totalMatches,
    csRank, csRankType: csRankType || null, csPremierRating, csCompetitiveRanks,
    rank: csRank, recentMatches,
    recentTeammates: Array.isArray(pickDeep(profile, ['recent_teammates','recentTeammates','data.recent_teammates','data.recentTeammates','profile.recent_teammates','profile.recentTeammates'])) ? pickDeep(profile, ['recent_teammates','recentTeammates','data.recent_teammates','data.recentTeammates','profile.recent_teammates','profile.recentTeammates']).slice(0, 10) : [],
    firstMatchDate: pickDeep(profile, ['first_match_date','firstMatchDate','data.first_match_date','data.firstMatchDate','profile.first_match_date','profile.firstMatchDate']) || null,
    rawUpdatedAt
  };
}

function hasMeaningfulLeetifyData(data) {
  return Boolean(
    data.name ||
    data.nickname ||
    data.avatarUrl ||
    data.steamId64 ||
    data.csRank ||
    data.csPremierRating !== null ||
    data.leetifyRating !== null ||
    data.aimRating !== null ||
    data.positioningRating !== null ||
    data.utilityRating !== null ||
    data.clutchRating !== null ||
    data.openingDuelRating !== null ||
    data.recentMatchesCount !== null ||
    (Array.isArray(data.recentMatches) && data.recentMatches.length) ||
    (data.csCompetitiveRanks && Object.keys(data.csCompetitiveRanks).length)
  );
}


function readSteamCache(cacheKey) { const cached = steamProfileCache.get(cacheKey); if (!cached) return null; if (cached.expiresAt < Date.now()) { steamProfileCache.delete(cacheKey); return null; } return cached.data; }
function writeSteamCache(cacheKey, data) { steamProfileCache.set(cacheKey, { expiresAt: Date.now() + STEAM_PROFILE_CACHE_TTL_MS, data }); return data; }
function readSteamXmlField(xml, tag) {
  const match = String(xml || '').match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}
function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
function parseSteamLevelFromHtml(html) {
  const text = String(html || '');

  const patterns = [
    /friendPlayerLevelNum[^>]*>\s*(\d{1,5})\s*</i,
    /persona_level[^>]*>\s*(\d{1,5})\s*</i,
    /steam-level[^>]*>\s*(\d{1,5})\s*</i,
    /Steam Level\s*<\/[^>]+>\s*<[^>]+>\s*(\d{1,5})/i,
    /level\s*(\d{1,5})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const level = Number(match[1]);
      if (Number.isInteger(level) && level >= 0 && level <= 99999) return level;
    }
  }

  return null;
}

async function handleSteamProfile(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ ok:false, error:'Not logged in' },401);
  const db=getDatabase(env);
  await ensureCoreSchemaOnce(db);
  const url = new URL(request.url);
  const requestedId = url.searchParams.get('user_id') || url.searchParams.get('id');
  const userId = requestedId ? Number(requestedId) : Number(user.id);
  if(!Number.isInteger(userId)||userId<1) return json({ ok:false, error:'Invalid user id' },400);
  const row=await getSafeProfileSettings(db, userId);
  if(!row?.steam_url) return json({ ok:true, steam:{ available:false, profileUrl:null, message:'No Steam URL set' } });
  const profileUrl=String(row.steam_url).trim();
  const parsed=parseSteamIdFromUrl(profileUrl);
  const cacheKey = parsed.steamid || profileUrl;
  const cached = readSteamCache(cacheKey);
  if (cached) return json(cached);

  try {
    const xmlUrl = profileUrl.includes('?') ? `${profileUrl}&xml=1` : `${profileUrl}?xml=1`;
    const xmlResponse = await fetch(xmlUrl);
    const xmlText = await xmlResponse.text();
    const xmlSteamId64 = readSteamXmlField(xmlText, 'steamID64');
    const xmlSteamName = decodeXmlEntities(readSteamXmlField(xmlText, 'steamID') || '');
    const xmlCustomUrl = readSteamXmlField(xmlText, 'customURL');
    const xmlError = readSteamXmlField(xmlText, 'error');
    if (!xmlResponse.ok || xmlError || !xmlSteamId64) {
      return json(writeSteamCache(cacheKey,{ ok:true, steam:{ available:false, profileUrl, message:'Steam data unavailable.' } }));
    }

    const xmlAvatarIcon = readSteamXmlField(xmlText, 'avatarIcon');
    const xmlAvatarMedium = readSteamXmlField(xmlText, 'avatarMedium');
    const xmlAvatarFull = readSteamXmlField(xmlText, 'avatarFull');
    const steam = {
      available: true,
      profileUrl,
      steamid: xmlSteamId64,
      steamID64: xmlSteamId64,
      personaname: xmlSteamName || null,
      steamID: xmlSteamName || null,
      avatar: xmlAvatarIcon || xmlAvatarMedium || xmlAvatarFull || '',
      avatarmedium: xmlAvatarMedium || '',
      avatarfull: xmlAvatarFull || '',
      avatarIcon: xmlAvatarIcon || '',
      avatarMedium: xmlAvatarMedium || '',
      avatarFull: xmlAvatarFull || '',
      onlineState: readSteamXmlField(xmlText, 'onlineState'),
      privacyState: readSteamXmlField(xmlText, 'privacyState'),
      visibilityState: readSteamXmlField(xmlText, 'visibilityState'),
      customURL: xmlCustomUrl,
      memberSince: readSteamXmlField(xmlText, 'memberSince'),
      location: readSteamXmlField(xmlText, 'location'),
      realname: decodeXmlEntities(readSteamXmlField(xmlText, 'realname') || '') || null,
      summary: decodeXmlEntities(readSteamXmlField(xmlText, 'summary') || '') || null,
      steamLevel: null
    };

    const apiKey=env.STEAM_API_KEY;
    if (apiKey) {
      try {
        const levelParams = new URLSearchParams({ key: apiKey, steamid: xmlSteamId64 });
        const levelResp = await fetch(`https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?${levelParams.toString()}`);
        const levelData = await levelResp.json();
        steam.steamLevel = Number.isFinite(Number(levelData?.response?.player_level)) ? Number(levelData.response.player_level) : null;
        if (steam.steamLevel != null) steam.steamLevelSource = 'steam-web-api';
        else steam.steamLevelUnavailableReason = 'Steam level unavailable from Steam Web API';
      } catch {
        steam.steamLevel = null;
        steam.steamLevelUnavailableReason = 'Steam level unavailable from Steam Web API';
      }
    }

    if (steam.steamLevel == null) {
      try {
        const htmlResp = await fetch(profileUrl, {
          headers: { 'Accept': 'text/html,*/*' }
        });
        if (htmlResp.ok) {
          const html = await htmlResp.text();
          const htmlLevel = parseSteamLevelFromHtml(html);
          if (htmlLevel != null) {
            steam.steamLevel = htmlLevel;
            steam.steamLevelSource = 'public-profile-html';
            delete steam.steamLevelUnavailableReason;
          }
        }
      } catch {}
    }

    if (steam.steamLevel == null) {
      steam.steamLevelUnavailableReason = 'Steam level unavailable from public profile page';
    }

    return json(writeSteamCache(cacheKey,{ok:true, steam}));
  } catch {
    return json(writeSteamCache(cacheKey,{ ok:true, steam:{ available:false, profileUrl, message:'Steam data unavailable.' } }));
  }
}
