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
const HOMEPAGE_TILE_SIZE_OPTIONS = ['1x1', '2x1', '1x2', '2x2', '2x3', '3x2', '3x3', '3x4', '4x3', '4x4', '4x5', '5x4', '5x5', '5x6', '6x5', '6x6'];
let accountRankCache = null;

export default { async fetch(request, env) { const url = new URL(request.url);
  if (url.pathname === '/api/auth/register' && request.method === 'POST') return handleRegister(request, env);
  if (url.pathname === '/api/auth/login' && request.method === 'POST') return handleLogin(request, env);
  if (url.pathname === '/api/auth/logout' && request.method === 'POST') return handleLogout(request, env);
  if (url.pathname === '/api/auth/me' && request.method === 'GET') return handleMe(request, env);
  if (url.pathname === '/api/members' && request.method === 'GET') return handleMembers(request, env);
  if (url.pathname === '/api/leaderboard/levels' && request.method === 'GET') return handleLeaderboardLevels(request, env);
  if (url.pathname === '/api/profile/me' && request.method === 'GET') return handleProfileMe(request, env);
  if (url.pathname === '/api/profile/me' && request.method === 'POST') return handleProfileMeUpdate(request, env);
  if (url.pathname === '/api/profile/me/rank' && request.method === 'POST') return handleProfileRankUpdate(request, env);
  if (url.pathname === '/api/profile/me/showcase-unlocks' && request.method === 'GET') return handleProfileMyShowcaseUnlocks(request, env);
  if (url.pathname === '/api/profile/me/unlocks' && request.method === 'GET') return handleProfileMyUnlocks(request, env);
  if (url.pathname === '/api/profile/me/showcase' && request.method === 'GET') return handleProfileMyShowcase(request, env);
  if (url.pathname === '/api/profile/me/showcase' && request.method === 'POST') return handleProfileMyShowcaseUpdate(request, env);
  if (url.pathname === '/api/profile' && request.method === 'GET') return handleProfileLookup(request, env);
  if (url.pathname === '/api/account' && request.method === 'GET') return handleAccount(request, env);
  if (url.pathname === '/api/account/password' && request.method === 'POST') return handleAccountPassword(request, env);
  if (url.pathname === '/api/wallet/me' && request.method === 'GET') return handleWalletMe(request, env);
  if (url.pathname === '/api/wallet/me/transactions' && request.method === 'GET') return handleWalletTransactionsMe(request, env);
  if (url.pathname === '/api/admin/users' && request.method === 'GET') return handleAdminUsers(request, env);
  if (url.pathname.match(/^\/api\/admin\/users\/\d+\/role$/) && request.method === 'POST') return handleAdminUpdateRole(request, env, url.pathname);
  if (url.pathname.match(/^\/api\/admin\/users\/\d+\/status$/) && request.method === 'POST') return handleAdminUpdateStatus(request, env, url.pathname);
  if (url.pathname.match(/^\/api\/admin\/users\/\d+\/wallet-adjust$/) && request.method === 'POST') return handleAdminWalletAdjust(request, env, url.pathname);
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
  if (url.pathname === '/api/homepage/tile-config' && request.method === 'GET') return handleHomepageTileConfig(request, env);
  if (url.pathname === '/api/debug/db' && request.method === 'GET') return handleDebugDb(env);
  if (url.pathname === '/api/ranks' && request.method === 'GET') return handleRanks(request, env);

  if (url.pathname === '/api/chat/rooms' && request.method === 'GET') return handleChatRooms(request, env);
  if (url.pathname === '/api/chat/messages' && request.method === 'GET') return handleChatMessagesGet(request, env);
  if (url.pathname === '/api/chat/messages' && request.method === 'POST') return handleChatMessagesPost(request, env);
  if (url.pathname === '/api/chat/direct' && request.method === 'POST') return handleChatDirect(request, env);
  if (url.pathname === '/api/chat/read' && request.method === 'POST') return handleChatRead(request, env);
  if (url.pathname.match(/^\/api\/admin\/chat\/messages\/\d+\/delete$/) && request.method === 'POST') return handleAdminChatDelete(request, env, url.pathname);
  const authGateResponse = await enforceAuthGate(request, env, url.pathname); if (authGateResponse) return authGateResponse; return env.ASSETS.fetch(request);
}};

async function handleRegister(request, env) { try { const body = await readJsonBody(request); const username = (body?.username ?? '').trim(); const password = body?.password ?? ''; if (!username || !password) return json({ ok: false, error: 'Username and password are required' }, 400); const db = getDatabase(env); await ensureSchema(db); if (!isTruthy(await getSetting(db, 'registration_enabled', 'true'))) return json({ ok: false, error: 'Registration is disabled' }, 403); const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(username).first(); if (existing) return json({ ok: false, error: 'Username is already taken' }, 409); const defaultRole = normalizeRole(await getSetting(db, 'default_new_user_role', FALLBACK_DEFAULT_NEW_USER_ROLE)); const passwordHash = await hashPassword(password); const result = await db.prepare('INSERT INTO users (username, password_hash, role, is_admin, status) VALUES (?, ?, ?, ?, ?)').bind(username, passwordHash, defaultRole, defaultRole === 'admin' ? 1 : 0, 'active').run(); const userId = result.meta.last_row_id; await getOrCreateWallet(db, userId); await ensureStarterUnlocks(db, userId); await logAudit(db, userId, userId, 'user_registered', { username, role: defaultRole }); const user = await db.prepare('SELECT id, username, role, is_admin, status FROM users WHERE id = ?').bind(userId).first(); return json({ ok: true, user: serializeUser(user) }, 201); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleLogin(request, env) { try { const body = await readJsonBody(request); const username = (body?.username ?? '').trim(); const password = body?.password ?? ''; if (!username || !password) return json({ ok: false, error: 'Username and password are required' }, 400); const db = getDatabase(env); await ensureSchema(db); const user = await db.prepare('SELECT id, username, role, is_admin, password_hash, status FROM users WHERE username = ?').bind(username).first(); if (!user) return json({ ok: false, error: 'Invalid username or password' }, 401); if (normalizeStatus(user.status) === 'disabled') return json({ ok: false, error: 'Account disabled' }, 403); const valid = await verifyPassword(password, user.password_hash); if (!valid) return json({ ok: false, error: 'Invalid username or password' }, 401); const { token, expiresAt } = makeSessionToken(); await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expiresAt).run(); await logAudit(db, user.id, user.id, 'user_login', { username: user.username }); return withSessionCookie(json({ ok: true, user: serializeUser(user) }), token, expiresAt); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleLogout(request, env) { try { const token = getSessionToken(request); if (token) { const db = getDatabase(env); await ensureSchema(db); await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run(); } const response = json({ ok: true }); response.headers.append('Set-Cookie', clearSessionCookie()); return response; } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleMe(request, env) { const u = await getCurrentUserFast(request, env); if (!u) return json({ ok: false, user: null, error: 'Not logged in' }, 401); return json({ ok: true, user: { id: u.id, username: u.username, role: u.role, roleLabel: getRoleLabel(u.role), roleLevel: getRoleLevel(u.role), is_admin: u.is_admin } }); }
async function handleMembers(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchema(db); const rows = await db.prepare(`SELECT u.id, u.username, u.role, u.is_admin, u.created_at, u.status, p.display_name, p.profile_title, p.avatar_url, p.show_level, p.show_rank FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id ORDER BY u.created_at DESC, u.id DESC`).all(); const ranks = await loadAccountRanks(request, env); if (!ranks.ok) return json(ranks, 500); const members=[]; for (const r of (rows.results||[])) { const progress=await getUserAccountProgress(db, r.id); const profile=await db.prepare('SELECT selected_rank_id FROM user_profiles WHERE user_id = ?').bind(r.id).first(); const displayedRank=getDisplayedRank(progress.accountLevel, profile?.selected_rank_id, ranks.ranks); members.push({ ...serializeUser(r), created_at:r.created_at||null, display_name:r.display_name||null, profile_title:r.profile_title||null, avatar_url:r.avatar_url||null, show_level:r.show_level == null ? 1 : Number(r.show_level), show_rank:r.show_rank == null ? 1 : Number(r.show_rank), accountLevel:progress.accountLevel, rank: displayedRank }); } return json({ ok: true, siteName: SITE_NAME, members }); }
async function handleProfileMe(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchema(db); await ensureStarterUnlocks(db, user.id); const row = await db.prepare('SELECT id, username, role, is_admin, created_at, status FROM users WHERE id = ?').bind(user.id).first(); if (!row) return json({ ok: false, error: 'User not found' }, 404); const profileRow = await db.prepare('SELECT display_name, profile_title, bio, location, website_url, avatar_url, banner_url, favourite_colour, profile_accent_colour, profile_background_colour, profile_layout, show_level, show_rank, show_badges, show_last_active, status_message, profile_quote, favourite_game, profile_visibility, show_member_card, show_profile_showcase, show_profile_xp, show_profile_user_id, show_joined_date, show_header_avatar, show_header_display_name, show_header_username, show_header_user_id, show_header_level, show_header_rank, show_header_xp_bar, selected_rank_id, updated_at FROM user_profiles WHERE user_id = ?').bind(row.id).first(); const safeProfile = { display_name: row.username, bio: '', profile_title: '', avatar_url: '', banner_url: '', profile_layout: 'standard', show_level: 1, show_rank: 1, show_badges: 1, show_last_active: 0, ...(profileRow || {}) }; const progress = await getUserAccountProgress(db, row.id); const ranks = await loadAccountRanks(request, env); const rankLoadError = !ranks.ok; const rankList = ranks.ok ? ranks.ranks : []; const unlockedRanks = getUnlockedRanks(progress.accountLevel, rankList); const defaultRank = getDefaultRankForLevel(progress.accountLevel, rankList); const rank = getDisplayedRank(progress.accountLevel, safeProfile?.selected_rank_id, rankList); const showcase = await getPublicShowcaseSlots(db, row.id); return json({ ok: true, profile: { ...serializeUser(row), created_at: row.created_at || null, ...safeProfile, ...progress, selected_rank_id: safeProfile?.selected_rank_id || null, rank, defaultRank, unlockedRanks, showcase }, ...(rankLoadError ? { rankLoadError: ranks.error } : {}) }); }
async function handleProfileLookup(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchema(db); const url = new URL(request.url); const idParam = url.searchParams.get('id'); const usernameParam = (url.searchParams.get('user') || '').trim(); let row = null; if (idParam) { const id = Number(idParam); if (!Number.isInteger(id) || id < 1) return json({ ok: false, error: 'Invalid user id' }, 400); row = await db.prepare('SELECT id, username, role, is_admin, created_at, status FROM users WHERE id = ?').bind(id).first(); } else if (usernameParam) { row = await db.prepare('SELECT id, username, role, is_admin, created_at, status FROM users WHERE username = ?').bind(usernameParam).first(); } else { return handleProfileMe(request, env); } if (!row) return json({ ok: false, error: 'User not found' }, 404); const profileRow = await db.prepare('SELECT display_name, profile_title, bio, location, website_url, avatar_url, banner_url, favourite_colour, profile_accent_colour, profile_background_colour, profile_layout, show_level, show_rank, show_badges, show_last_active, status_message, profile_quote, favourite_game, profile_visibility, show_member_card, show_profile_showcase, show_profile_xp, show_profile_user_id, show_joined_date, show_header_avatar, show_header_display_name, show_header_username, show_header_user_id, show_header_level, show_header_rank, show_header_xp_bar, selected_rank_id, updated_at FROM user_profiles WHERE user_id = ?').bind(row.id).first(); const safeProfile = { display_name: row.username, bio: '', profile_title: '', avatar_url: '', banner_url: '', profile_layout: 'standard', show_level: 1, show_rank: 1, show_badges: 1, show_last_active: 0, ...(profileRow || {}) }; const progress = await getUserAccountProgress(db, row.id); const ranks = await loadAccountRanks(request, env); const rankLoadError = !ranks.ok; const rankList = ranks.ok ? ranks.ranks : []; const defaultRank = getDefaultRankForLevel(progress.accountLevel, rankList); const rank = getDisplayedRank(progress.accountLevel, safeProfile?.selected_rank_id, rankList); const unlockedRanks = user.id === row.id ? getUnlockedRanks(progress.accountLevel, rankList) : undefined; const showcase = await getPublicShowcaseSlots(db, row.id); return json({ ok: true, profile: { ...serializeUser(row), created_at: row.created_at || null, ...safeProfile, ...progress, selected_rank_id: safeProfile?.selected_rank_id || null, rank, defaultRank, showcase, ...(unlockedRanks ? { unlockedRanks } : {}) }, ...(rankLoadError ? { rankLoadError: ranks.error } : {}) }); }
async function handleProfileMeUpdate(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const body = await readJsonBody(request); const profile = normalizeProfileInput(body); if (profile.error) return json({ ok: false, error: profile.error }, 400); const db = getDatabase(env); await ensureSchema(db); await db.prepare("INSERT INTO user_profiles (user_id, display_name, profile_title, bio, location, website_url, avatar_url, banner_url, favourite_colour, profile_accent_colour, profile_background_colour, profile_layout, show_level, show_rank, show_badges, show_last_active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name, profile_title=excluded.profile_title, bio=excluded.bio, location=excluded.location, website_url=excluded.website_url, avatar_url=excluded.avatar_url, banner_url=excluded.banner_url, favourite_colour=excluded.favourite_colour, profile_accent_colour=excluded.profile_accent_colour, profile_background_colour=excluded.profile_background_colour, profile_layout=excluded.profile_layout, show_level=excluded.show_level, show_rank=excluded.show_rank, show_badges=excluded.show_badges, show_last_active=excluded.show_last_active, updated_at=datetime('now')").bind(user.id, profile.display_name, profile.profile_title, profile.bio, profile.location, profile.website_url, profile.avatar_url, profile.banner_url, profile.favourite_colour, profile.profile_accent_colour, profile.profile_background_colour, profile.profile_layout, profile.show_level, profile.show_rank, profile.show_badges, profile.show_last_active).run(); return handleProfileMe(request, env); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }


async function handleProfileRankUpdate(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const body = await readJsonBody(request); const incoming = body?.selected_rank_id; const selected = incoming == null ? null : String(incoming).trim(); const db = getDatabase(env); await ensureSchema(db); const ranks = await loadAccountRanks(request, env); if (!ranks.ok) return json(ranks, 500); const progress = await getUserAccountProgress(db, user.id); let selectedRankId = null; if (selected && selected.toLowerCase() !== 'default') { const rank = getRankById(selected, ranks.ranks); if (!rank) return json({ ok: false, error: 'Unknown rank' }, 400); if (rank.level > progress.accountLevel) return json({ ok: false, error: 'You have not unlocked that rank yet' }, 400); selectedRankId = rank.id; }
await db.prepare("INSERT INTO user_profiles (user_id, selected_rank_id, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET selected_rank_id=excluded.selected_rank_id, updated_at=datetime('now')").bind(user.id, selectedRankId).run(); return handleProfileMe(request, env); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }

async function handleAccount(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchema(db); await ensureStarterUnlocks(db, user.id); const row = await db.prepare('SELECT id, username, role, is_admin, status, created_at FROM users WHERE id = ?').bind(user.id).first(); if (!row) return json({ ok: false, error: 'User not found' }, 404); return json({ ok: true, user: { ...serializeUser(row), created_at: row.created_at || null } }); }
async function handleAccountPassword(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const body = await readJsonBody(request); const currentPassword = body?.currentPassword ?? ''; const newPassword = body?.newPassword ?? ''; const confirmPassword = body?.confirmPassword ?? ''; if (!currentPassword) return json({ ok: false, error: 'Current password is required' }, 400); if (!newPassword) return json({ ok: false, error: 'New password is required' }, 400); if (!confirmPassword) return json({ ok: false, error: 'Confirm password is required' }, 400); if (newPassword !== confirmPassword) return json({ ok: false, error: 'New passwords do not match' }, 400); const db = getDatabase(env); await ensureSchema(db); await ensureStarterUnlocks(db, user.id); const row = await db.prepare('SELECT id, password_hash FROM users WHERE id = ?').bind(user.id).first(); if (!row) return json({ ok: false, error: 'User not found' }, 404); const valid = await verifyPassword(currentPassword, row.password_hash); if (!valid) return json({ ok: false, error: 'Current password is incorrect' }, 400); const passwordHash = await hashPassword(newPassword); await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, user.id).run(); await logAudit(db, user.id, user.id, 'password_changed', {}); return json({ ok: true }); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleWalletMe(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchema(db); const wallet = await getOrCreateWallet(db, user.id); return json({ ok: true, currency: SITE_CURRENCY_NAME, coins: wallet.coins }); }
async function handleWalletTransactionsMe(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchema(db); await getOrCreateWallet(db, user.id); const rows = await db.prepare('SELECT id, amount, balance_after, type, reason, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50').bind(user.id).all(); return json({ ok: true, currency: SITE_CURRENCY_NAME, transactions: rows?.results || [] }); }
async function handleAdminUsers(request, env) { const auth = await requireAdmin(request, env); if (auth) return auth; const db = getDatabase(env); await ensureSchema(db); const rows = await db.prepare(`SELECT u.id, u.username, u.role, u.is_admin, u.created_at, u.status, w.coins FROM users u LEFT JOIN wallets w ON w.user_id = u.id ORDER BY u.created_at DESC`).all(); return json({ ok: true, users: (rows.results || []).map((r) => ({ ...serializeUser(r), created_at: r.created_at || null, coins: r.coins == null ? null : Number(r.coins) })), roles: ROLES }); }
async function handleAdminUpdateRole(request, env, path) { const auth = await requireAdmin(request, env); if (auth) return auth; const actor = await getCurrentUser(request, env); const userId = Number(path.split('/')[4]); const role = normalizeRole(String((await readJsonBody(request))?.role || '').trim().toLowerCase()); if (!ROLES[role]) return json({ ok: false, error: 'Invalid role' }, 400); const db = getDatabase(env); const result = await db.prepare('UPDATE users SET role = ?, is_admin = ? WHERE id = ?').bind(role, role === 'admin' ? 1 : 0, userId).run(); if (!result.meta.changes) return json({ ok: false, error: 'User not found' }, 404); await logAudit(db, actor?.id || null, userId, 'role_changed', { role }); const updated = await db.prepare('SELECT id, username, role, is_admin, status, created_at FROM users WHERE id = ?').bind(userId).first(); return json({ ok: true, user: { ...serializeUser(updated), created_at: updated.created_at || null } }); }
async function handleAdminUpdateStatus(request, env, path) { const auth = await requireAdmin(request, env); if (auth) return auth; const actor = await getCurrentUser(request, env); const userId = Number(path.split('/')[4]); const status = normalizeStatus((await readJsonBody(request))?.status); if (!ALLOWED_STATUSES.has(status)) return json({ ok: false, error: 'Invalid status' }, 400); const db = getDatabase(env); const result = await db.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run(); if (!result.meta.changes) return json({ ok: false, error: 'User not found' }, 404); await logAudit(db, actor?.id || null, userId, 'status_changed', { status }); const updated = await db.prepare('SELECT id, username, role, is_admin, status, created_at FROM users WHERE id = ?').bind(userId).first(); return json({ ok: true, user: { ...serializeUser(updated), created_at: updated.created_at || null } }); }
async function handleAdminWalletAdjust(request, env, path) { const auth = await requireAdmin(request, env); if (auth) return auth; const actor = await getCurrentUser(request, env); const db = getDatabase(env); const userId = Number(path.split('/')[4]); const body = await readJsonBody(request); const amount = body?.amount; const reason = String(body?.reason || '').trim(); if (!Number.isInteger(amount)) return json({ ok: false, error: 'amount must be an integer' }, 400); if (!reason) return json({ ok: false, error: 'reason is required' }, 400); const target = await db.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first(); if (!target) return json({ ok: false, error: 'User not found' }, 404); const wallet = await getOrCreateWallet(db, userId); const coins = wallet.coins + amount; await db.prepare("UPDATE wallets SET coins = ?, updated_at = datetime('now') WHERE user_id = ?").bind(coins, userId).run(); await db.prepare("INSERT INTO wallet_transactions (user_id, actor_user_id, amount, balance_after, type, reason) VALUES (?, ?, ?, ?, 'admin_adjustment', ?)").bind(userId, actor?.id || null, amount, coins, reason).run(); await logAudit(db, actor?.id || null, userId, 'wallet_adjusted', { amount, reason, balance_after: coins }); return json({ ok: true, currency: SITE_CURRENCY_NAME, user_id: userId, coins }); }
async function handleAdminGameProgress(request, env, path) { const auth = await requireAdmin(request, env); if (auth) return auth; const userId = Number(path.split('/')[4]); const body = await readJsonBody(request); const game_key = String(body?.game_key || '').trim(); const game_name = String(body?.game_name || '').trim(); const level = Number(body?.level); const xp = Number(body?.xp); if (!game_key || !game_name) return json({ ok: false, error: 'game_key and game_name are required' }, 400); if (!Number.isInteger(level) || level < 1) return json({ ok: false, error: 'level must be integer >= 1' }, 400); if (!Number.isInteger(xp) || xp < 0) return json({ ok: false, error: 'xp must be integer >= 0' }, 400); const db = getDatabase(env); await db.prepare("INSERT INTO game_progress (user_id, game_key, game_name, level, xp, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(user_id, game_key) DO UPDATE SET game_name=excluded.game_name, level=excluded.level, xp=excluded.xp, updated_at=datetime('now')").bind(userId, game_key, game_name, level, xp).run(); const progress = await getUserAccountProgress(db, userId); return json({ ok: true, user_id: userId, progress }); }

async function handleAdminGetSettings(request, env) { const auth = await requireAdmin(request, env); if (auth) return auth; const db = getDatabase(env); await ensureSchema(db); return json({ ok: true, settings: await getAllSettings(db) }); }
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

async function handleRanks(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const ranks = await loadAccountRanks(request, env); if (!ranks.ok) return json(ranks, 500); return json({ ok: true, ranks: ranks.ranks }); }
async function readJsonBody(request) { const text = await request.text(); if (!text) return {}; try { return JSON.parse(text); } catch { throw new Error('Invalid JSON body'); } }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
function makeSessionToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''); const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString(); return { token, expiresAt }; }
function withSessionCookie(response, token, expiresAt) { response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${new Date(expiresAt).toUTCString()}`); return response; }
const clearSessionCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
function getSessionToken(request) { const header = request.headers.get('Cookie') || ''; for (const part of header.split(';').map((p) => p.trim())) if (part.startsWith(`${SESSION_COOKIE}=`)) return part.slice(SESSION_COOKIE.length + 1); return null; }
async function hashPassword(password) { const salt = crypto.getRandomValues(new Uint8Array(16)); const enc = new TextEncoder(); const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256); return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`; }
async function verifyPassword(password, stored) { const [algo, roundsStr, saltB64, hashB64] = (stored || '').split('$'); if (algo !== 'pbkdf2') return false; const rounds = Number(roundsStr); if (!Number.isFinite(rounds) || rounds < 1 || rounds > PBKDF2_ITERATIONS) return false; const salt = fromBase64(saltB64); const expected = fromBase64(hashB64); const enc = new TextEncoder(); const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-256' }, keyMaterial, expected.length * 8); return timingSafeEqual(expected, new Uint8Array(bits)); }
const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes)); const fromBase64 = (b64) => Uint8Array.from(atob(b64 || ''), (c) => c.charCodeAt(0)); const timingSafeEqual = (a, b) => a.length === b.length && a.reduce((d, v, i) => d | (v ^ b[i]), 0) === 0;
function getXpForNextLevel(accountLevel) { return Math.max(100, Number(accountLevel) * 100); }
function getAccountLevelFromGameProgress(rows) { const sum = (rows || []).reduce((acc, r) => acc + (Number(r.level) || 0), 0); return Math.max(1, sum); }
async function getUserAccountProgress(db, userId) { try { const rows = await db.prepare('SELECT level, xp FROM game_progress WHERE user_id = ?').bind(userId).all(); const list = rows.results || []; const accountLevel = getAccountLevelFromGameProgress(list); const accountXp = list.reduce((acc, r) => acc + (Number(r.xp) || 0), 0); const accountXpRequired = getXpForNextLevel(accountLevel); const accountXpCurrent = accountXpRequired > 0 ? accountXp % accountXpRequired : 0; const accountXpPercent = accountXpRequired > 0 ? Math.floor((accountXpCurrent / accountXpRequired) * 100) : 0; return { accountLevel, accountXp, accountXpCurrent, accountXpRequired, accountXpPercent }; } catch { return { accountLevel: 1, accountXp: 0, accountXpCurrent: 0, accountXpRequired: 100, accountXpPercent: 0, progressLoadError: true }; } }
function normalizeProfileInput(body) {
  const clean = (v) => String(v ?? '').trim();
  const nullable = (v) => { const x = clean(v); return x || null; };
  const asBoolInt = (v, fallback = 1) => (v === undefined || v === null || v === '' ? fallback : (Number(v) ? 1 : 0));
  const hexRe = /^#[0-9a-fA-F]{6}$/;
  const allowedLayouts = new Set(['compact', 'standard', 'showcase']);

  const display_name = nullable(body?.display_name);
  const profile_title = nullable(body?.profile_title);
  const bio = nullable(body?.bio);
  const location = nullable(body?.location);
  const website_url = nullable(body?.website_url);
  const avatar_url = nullable(body?.avatar_url);
  const banner_url = nullable(body?.banner_url);
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
  if (website_url && website_url.length > 200) return { error: 'website_url max length is 200' };
  if (avatar_url && avatar_url.length > 500) return { error: 'avatar_url max length is 500' };
  if (banner_url && banner_url.length > 500) return { error: 'banner_url max length is 500' };
  for (const [name, value] of [['favourite_colour', favourite_colour], ['profile_accent_colour', profile_accent_colour], ['profile_background_colour', profile_background_colour]]) {
    if (value && !hexRe.test(value)) return { error: `${name} must be blank or a hex colour like #00ff66` };
  }
  if (!allowedLayouts.has(profile_layout)) return { error: 'profile_layout must be compact, standard, or showcase' };

  return { display_name, profile_title, bio, location, website_url, avatar_url, banner_url, favourite_colour, profile_accent_colour, profile_background_colour, profile_layout, show_level, show_rank, show_badges, show_last_active };
}


async function getOrCreateWallet(db, userId) { const startCoins = Number(await getSetting(db, 'starting_coins', String(FALLBACK_STARTING_COINS))); const initialCoins = Number.isInteger(startCoins) ? startCoins : FALLBACK_STARTING_COINS; await db.prepare('INSERT OR IGNORE INTO wallets (user_id, coins) VALUES (?, ?)').bind(userId, initialCoins).run(); const existingTx = await db.prepare("SELECT id FROM wallet_transactions WHERE user_id = ? AND type = 'initial_grant' LIMIT 1").bind(userId).first(); if (!existingTx) await db.prepare("INSERT INTO wallet_transactions (user_id, amount, balance_after, type, reason) VALUES (?, ?, ?, 'initial_grant', 'Starting Grev Coins')").bind(userId, initialCoins, initialCoins).run(); const wallet = await db.prepare('SELECT coins FROM wallets WHERE user_id = ?').bind(userId).first(); return { coins: Number(wallet?.coins ?? initialCoins) }; }
async function ensureSchema(db) { await createSchemaTables(db); return true; }
async function createSchemaTables(db) { await db.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', is_admin INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')))" ).run(); try { await db.prepare("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN selected_rank_id TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN website_url TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN profile_accent_colour TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN profile_background_colour TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN profile_layout TEXT NOT NULL DEFAULT 'standard'").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_level INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_rank INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_badges INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_last_active INTEGER NOT NULL DEFAULT 0").run(); } catch {}

  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN status_message TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN profile_quote TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN favourite_game TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN profile_visibility TEXT NOT NULL DEFAULT 'public'").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_member_card INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_profile_showcase INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_profile_xp INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_profile_user_id INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_joined_date INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_header_avatar INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_header_display_name INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_header_username INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_header_user_id INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_header_level INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_header_rank INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  try { await db.prepare("ALTER TABLE user_profiles ADD COLUMN show_header_xp_bar INTEGER NOT NULL DEFAULT 1").run(); } catch {}
  await db.prepare("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS wallets (user_id INTEGER PRIMARY KEY, coins INTEGER NOT NULL DEFAULT 1000, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS wallet_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, actor_user_id INTEGER, amount INTEGER NOT NULL, balance_after INTEGER NOT NULL, type TEXT NOT NULL, reason TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS user_profiles (user_id INTEGER PRIMARY KEY, display_name TEXT, bio TEXT, location TEXT, favourite_colour TEXT, profile_title TEXT, avatar_url TEXT, banner_url TEXT, selected_rank_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS game_progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, game_key TEXT NOT NULL, game_name TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id, game_key), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS user_unlocks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, unlock_key TEXT NOT NULL, unlock_type TEXT NOT NULL, name TEXT NOT NULL, description TEXT, icon_url TEXT, source TEXT, rarity TEXT NOT NULL DEFAULT 'common', metadata_json TEXT, unlocked_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id, unlock_key), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS showcase_catalog (id INTEGER PRIMARY KEY AUTOINCREMENT, item_key TEXT NOT NULL UNIQUE, item_type TEXT NOT NULL, name TEXT NOT NULL, description TEXT, rarity TEXT NOT NULL DEFAULT 'common', icon_url TEXT, image_url TEXT, source TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  try { await db.prepare("ALTER TABLE showcase_catalog ADD COLUMN image_url TEXT").run(); } catch {}
  await db.prepare("CREATE TABLE IF NOT EXISTS user_showcase_unlocks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, catalog_item_id INTEGER NOT NULL, unlocked_at TEXT NOT NULL DEFAULT (datetime('now')), unlock_source TEXT, metadata_json TEXT, UNIQUE(user_id, catalog_item_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (catalog_item_id) REFERENCES showcase_catalog(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS profile_showcase_slots (user_id INTEGER NOT NULL, slot INTEGER NOT NULL, unlock_id INTEGER, custom_label TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, slot), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (unlock_id) REFERENCES user_unlocks(id) ON DELETE SET NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_user_id INTEGER, target_user_id INTEGER, action TEXT NOT NULL, details_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS homepage_tile_config (tile_id TEXT PRIMARY KEY, label TEXT NOT NULL, default_size TEXT NOT NULL, allowed_sizes_json TEXT NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT (datetime('now')))").run();

  await db.prepare("CREATE TABLE IF NOT EXISTS chat_rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, room_key TEXT NOT NULL UNIQUE, room_type TEXT NOT NULL, name TEXT NOT NULL, created_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS chat_room_members (room_id INTEGER NOT NULL, user_id INTEGER NOT NULL, joined_at TEXT NOT NULL DEFAULT (datetime('now')), last_read_message_id INTEGER, PRIMARY KEY (room_id, user_id), FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER NOT NULL, sender_user_id INTEGER NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), edited_at TEXT, deleted_at TEXT, FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE, FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE)").run();
  await db.prepare("INSERT OR IGNORE INTO chat_rooms (room_key, room_type, name) VALUES ('global','global','Global Chat')").run();
  await db.prepare("INSERT OR IGNORE INTO site_settings (key, value) VALUES ('site_name',?),('registration_enabled','true'),('default_new_user_role','admin'),('starting_coins','1000'),('maintenance_mode','false')").bind(SITE_NAME).run();
  for (const tile of getHomepageTileSeedConfigs()) {
    await db.prepare("INSERT OR IGNORE INTO homepage_tile_config (tile_id, label, default_size, allowed_sizes_json, is_enabled, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))").bind(tile.tile_id, tile.label, tile.default_size, JSON.stringify(tile.allowed_sizes), tile.is_enabled, tile.sort_order).run();
  }
  await db.prepare("UPDATE users SET role = 'admin' WHERE role IS NULL OR role = '' OR role = 'user'").run(); await db.prepare('UPDATE users SET is_admin = 1 WHERE is_admin IS NULL').run(); await db.prepare("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''").run();
}
async function getSetting(db, key, fallback) { const row = await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(key).first(); return row?.value ?? fallback; }
async function setSetting(db, key, value) { await db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')").bind(key, value).run(); }
async function getAllSettings(db) { const rows = await db.prepare('SELECT key, value, updated_at FROM site_settings ORDER BY key').all(); const settings = {}; (rows.results || []).forEach((r) => { settings[r.key] = r.value; }); return settings; }
async function logAudit(db, actorUserId, targetUserId, action, details) { await db.prepare('INSERT INTO audit_logs (actor_user_id, target_user_id, action, details_json) VALUES (?, ?, ?, ?)').bind(actorUserId, targetUserId, action, JSON.stringify(details || {})).run(); }
const isTruthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
const friendlyError = (error) => (error instanceof Error ? error.message : 'Unexpected error');




async function handleProfileMyUnlocks(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchema(db); await ensureStarterUnlocks(db, user.id); const rows = await db.prepare("SELECT id, unlock_key, unlock_type, name, description, icon_url, source, rarity, unlocked_at FROM user_unlocks WHERE user_id = ? ORDER BY unlocked_at DESC, id DESC").bind(user.id).all(); return json({ ok: true, unlocks: rows.results || [] }); }
async function handleProfileMyShowcase(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchema(db); return json({ ok: true, slots: await getPublicShowcaseSlots(db, user.id) }); }
async function handleProfileMyShowcaseUpdate(request, env) { try { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const body = await readJsonBody(request); const slots = Array.isArray(body?.slots) ? body.slots : null; if (!slots) return json({ ok: false, error: 'slots array is required' }, 400); const db = getDatabase(env); await ensureSchema(db); for (const entry of slots) { const slot = Number(entry?.slot); if (!Number.isInteger(slot) || slot < SHOWCASE_SLOT_MIN || slot > SHOWCASE_SLOT_MAX) return json({ ok: false, error: 'slot must be 1 to 4' }, 400); const unlockId = entry?.unlock_id; if (unlockId !== null && unlockId !== undefined) { const unlock = await db.prepare('SELECT id FROM user_unlocks WHERE id = ? AND user_id = ?').bind(Number(unlockId), user.id).first(); if (!unlock) return json({ ok: false, error: `unlock_id ${unlockId} does not belong to your account` }, 400); } await db.prepare("INSERT INTO profile_showcase_slots (user_id, slot, unlock_id, updated_at) VALUES (?, ?, ?, datetime('now')) ON CONFLICT(user_id, slot) DO UPDATE SET unlock_id=excluded.unlock_id, updated_at=datetime('now')").bind(user.id, slot, unlockId == null ? null : Number(unlockId)).run(); } return json({ ok: true, slots: await getPublicShowcaseSlots(db, user.id) }); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function getPublicShowcaseSlots(db, userId) { const rows = await db.prepare(`SELECT s.slot, u.id as unlock_id, u.unlock_key, u.unlock_type, u.name, u.description, u.icon_url, u.source, u.rarity, u.unlocked_at FROM profile_showcase_slots s LEFT JOIN user_unlocks u ON u.id = s.unlock_id AND u.user_id = s.user_id WHERE s.user_id = ? AND s.slot BETWEEN ? AND ? ORDER BY s.slot ASC`).bind(userId, SHOWCASE_SLOT_MIN, SHOWCASE_SLOT_MAX).all(); const bySlot = new Map((rows.results || []).map((r) => [Number(r.slot), r])); const slots = []; for (let i = SHOWCASE_SLOT_MIN; i <= SHOWCASE_SLOT_MAX; i += 1) { const row = bySlot.get(i); slots.push({ slot: i, unlock: row && row.unlock_id ? { id: row.unlock_id, unlock_key: row.unlock_key, unlock_type: row.unlock_type, name: row.name, description: row.description || '', icon_url: row.icon_url || '', source: row.source || '', rarity: row.rarity, unlocked_at: row.unlocked_at } : null }); } return slots; }
async function ensureStarterUnlocks(db, userId) { await db.prepare("INSERT OR IGNORE INTO user_unlocks (user_id, unlock_key, unlock_type, name, description, source, rarity) VALUES (?, 'founding_account', 'achievement', 'Founding Account', 'Created an account during the foundation build.', 'site', 'common')").bind(userId).run(); }
async function handleAdminUserUnlockUpsert(request, env, path) { try { const auth = await requireAdmin(request, env); if (auth) return auth; const userId = Number(path.split('/')[4]); const body = await readJsonBody(request); const unlock_key = String(body?.unlock_key || '').trim(); const unlock_type = String(body?.unlock_type || '').trim(); const name = String(body?.name || '').trim(); const description = String(body?.description || '').trim() || null; const rarity = String(body?.rarity || 'common').trim(); const source = String(body?.source || 'admin').trim() || 'admin'; const icon_url = String(body?.icon_url || '').trim() || null; if (!unlock_key || !name) return json({ ok: false, error: 'unlock_key and name are required' }, 400); if (!UNLOCK_TYPES.has(unlock_type)) return json({ ok: false, error: 'Invalid unlock_type' }, 400); if (!UNLOCK_RARITIES.has(rarity)) return json({ ok: false, error: 'Invalid rarity' }, 400); const db = getDatabase(env); await ensureSchema(db); await db.prepare("INSERT INTO user_unlocks (user_id, unlock_key, unlock_type, name, description, icon_url, source, rarity, unlocked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(user_id, unlock_key) DO UPDATE SET unlock_type=excluded.unlock_type, name=excluded.name, description=excluded.description, icon_url=excluded.icon_url, source=excluded.source, rarity=excluded.rarity").bind(userId, unlock_key, unlock_type, name, description, icon_url, source, rarity).run(); return json({ ok: true }); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }


async function handleLeaderboardLevels(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok:false, error:'Not logged in' },401); const db=getDatabase(env); await ensureSchema(db); const rows=await db.prepare("SELECT id, username, role FROM users ORDER BY username ASC").all(); const ranks=await loadAccountRanks(request, env); const list=[]; for (const r of (rows.results||[])) { const pr=await getUserAccountProgress(db,r.id); list.push({id:r.id,username:r.username,role:r.role,roleLabel:getRoleLabel(r.role),...pr,displayedRank:getDisplayedRank(pr.accountLevel,null,ranks.ranks||[])});} list.sort((a,b)=>b.accountLevel-a.accountLevel||b.accountXp-a.accountXp||a.username.localeCompare(b.username)); return json({ok:true,leaderboard:list.slice(0,100).map((x,i)=>({rankPosition:i+1,...x}))}); }
function getHomepageTileSeedConfigs() { return [
  { tile_id: 'profile-snapshot', label: 'Profile Snapshot', default_size: '2x1', allowed_sizes: ['1x1', '2x1', '2x2', '3x2', '4x2'], is_enabled: 1, sort_order: 10 },
  { tile_id: 'quick-actions', label: 'Quick Actions', default_size: '1x1', allowed_sizes: ['1x1', '2x1', '2x2'], is_enabled: 1, sort_order: 20 },
  { tile_id: 'profile-completion', label: 'Profile Completion', default_size: '1x1', allowed_sizes: ['1x1', '2x1', '2x2'], is_enabled: 1, sort_order: 30 },
  { tile_id: 'members-preview', label: 'Members Preview', default_size: '2x1', allowed_sizes: ['1x1', '2x1', '2x2', '3x2', '4x2'], is_enabled: 1, sort_order: 40 },
  { tile_id: 'chat', label: 'Global Chat', default_size: '2x2', allowed_sizes: HOMEPAGE_TILE_SIZE_OPTIONS, is_enabled: 1, sort_order: 50 },
  { tile_id: 'coming-later', label: 'Status', default_size: '1x1', allowed_sizes: ['1x1', '2x1', '2x2'], is_enabled: 1, sort_order: 60 },
  { tile_id: 'status', label: 'Status', default_size: '1x1', allowed_sizes: ['1x1', '2x1', '2x2'], is_enabled: 1, sort_order: 61 },
  { tile_id: 'showcase-preview', label: 'Showcase Preview', default_size: '2x1', allowed_sizes: ['1x1', '2x1', '2x2', '3x2', '4x2'], is_enabled: 1, sort_order: 70 }
]; }
function parseAllowedSizes(value) { try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function normalizeHomepageTilePayload(tileId, body) { const allowed = Array.isArray(body?.allowed_sizes) ? body.allowed_sizes.map((s) => String(s || '').trim()).filter(Boolean) : []; const invalid = allowed.filter((size) => !HOMEPAGE_TILE_SIZE_OPTIONS.includes(size)); if (!allowed.length) return { error: 'allowed_sizes must contain at least one size' }; if (invalid.length) return { error: `Unsupported size(s): ${invalid.join(', ')}` }; const defaultSize = String(body?.default_size || '').trim(); if (!allowed.includes(defaultSize)) return { error: 'default_size must be one of allowed_sizes' }; const isEnabled = Number(body?.is_enabled); if (!(isEnabled === 0 || isEnabled === 1)) return { error: 'is_enabled must be 0 or 1' }; return { tile_id: tileId, label: String(body?.label || '').trim() || tileId, default_size: defaultSize, allowed_sizes: allowed, is_enabled: isEnabled, sort_order: Number(body?.sort_order) || 0 }; }
async function readHomepageTileConfigs(db, enabledOnly = false) { const rows = await db.prepare(`SELECT tile_id, label, default_size, allowed_sizes_json, is_enabled, sort_order FROM homepage_tile_config ${enabledOnly ? 'WHERE is_enabled = 1' : ''} ORDER BY sort_order ASC, tile_id ASC`).all(); return (rows.results || []).map((row) => ({ tile_id: row.tile_id, label: row.label, default_size: row.default_size, allowed_sizes: parseAllowedSizes(row.allowed_sizes_json), is_enabled: Number(row.is_enabled) === 1 ? 1 : 0, sort_order: Number(row.sort_order) || 0 })); }
async function handleAdminHomepageTilesGet(request, env) { const auth = await requireAdmin(request, env); if (auth) return auth; const db = getDatabase(env); await ensureSchema(db); return json({ ok: true, tiles: await readHomepageTileConfigs(db, false) }); }
async function handleAdminHomepageTilesPost(request, env, path) { try { const auth = await requireAdmin(request, env); if (auth) return auth; const tileId = decodeURIComponent(path.split('/').pop() || '').trim(); const db = getDatabase(env); await ensureSchema(db); const exists = await db.prepare('SELECT tile_id FROM homepage_tile_config WHERE tile_id = ?').bind(tileId).first(); if (!exists) return json({ ok: false, error: 'Unknown tile_id' }, 400); const body = await readJsonBody(request); const normalized = normalizeHomepageTilePayload(tileId, body); if (normalized.error) return json({ ok: false, error: normalized.error }, 400); await db.prepare("UPDATE homepage_tile_config SET label = ?, default_size = ?, allowed_sizes_json = ?, is_enabled = ?, sort_order = ?, updated_at = datetime('now') WHERE tile_id = ?").bind(normalized.label, normalized.default_size, JSON.stringify(normalized.allowed_sizes), normalized.is_enabled, normalized.sort_order, tileId).run(); return json({ ok: true, tile: normalized }); } catch (error) { return json({ ok: false, error: friendlyError(error) }, 500); } }
async function handleHomepageTileConfig(request, env) { const user = await getCurrentUser(request, env); if (!user) return json({ ok: false, error: 'Not logged in' }, 401); const db = getDatabase(env); await ensureSchema(db); return json({ ok: true, tiles: await readHomepageTileConfigs(db, true) }); }

async function handleProfileMyShowcaseUnlocks(request, env){ const user=await getCurrentUser(request, env); if(!user) return json({ok:false,error:'Not logged in'},401); const db=getDatabase(env); await ensureSchema(db); const rows=await db.prepare("SELECT u.catalog_item_id as id,c.item_key,c.item_type,c.name,c.description,c.icon_url,c.rarity FROM user_showcase_unlocks u JOIN showcase_catalog c ON c.id=u.catalog_item_id WHERE u.user_id=? ORDER BY c.name").bind(user.id).all(); return json({ok:true,unlocks:rows.results||[]}); }
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
async function handleAdminShowcaseCatalog(request, env){const auth=await requireAdmin(request, env); if(auth) return auth; const db=getDatabase(env); await ensureSchema(db); const rows=await db.prepare("SELECT id,item_key,name,description,rarity,COALESCE(image_url,icon_url,'') as image_url,is_active,created_at,updated_at FROM showcase_catalog ORDER BY id DESC").all(); return json({ok:true,items:rows.results||[]});}
async function handleAdminShowcaseCatalogCreate(request, env){try{const auth=await requireAdmin(request, env); if(auth) return auth; const b=await readJsonBody(request); const v=normalizeShowcaseCatalogInput(b); if(v.error) return json({ok:false,error:v.error},400); const db=getDatabase(env); await ensureSchema(db); const itemKey=await generateUniqueShowcaseKey(db, String(b?.item_key||v.name)); await db.prepare("INSERT INTO showcase_catalog (item_key,item_type,name,description,icon_url,image_url,source,rarity,is_active,updated_at) VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))").bind(itemKey,'other',v.name,v.description,v.image_url,v.image_url,'admin',v.rarity,v.is_active).run(); return json({ok:true,item_key:itemKey});}catch(error){return json({ok:false,error:friendlyError(error)},500);}}
async function handleAdminShowcaseCatalogUpdate(request, env, path){try{const auth=await requireAdmin(request, env); if(auth) return auth; const id=Number(path.split('/').pop()); if(!Number.isInteger(id)||id<1) return json({ok:false,error:'Invalid id'},400); const b=await readJsonBody(request); const v=normalizeShowcaseCatalogInput(b); if(v.error) return json({ok:false,error:v.error},400); const db=getDatabase(env); await ensureSchema(db); const existing=await db.prepare('SELECT id FROM showcase_catalog WHERE id=?').bind(id).first(); if(!existing) return json({ok:false,error:'Item not found'},404); await db.prepare("UPDATE showcase_catalog SET name=?,description=?,icon_url=?,image_url=?,rarity=?,is_active=?,updated_at=datetime('now') WHERE id=?").bind(v.name,v.description,v.image_url,v.image_url,v.rarity,v.is_active,id).run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);}}
async function handleAdminShowcaseCatalogToggle(request, env, path){try{const auth=await requireAdmin(request, env); if(auth) return auth; const id=Number(path.split('/')[5]); if(!Number.isInteger(id)||id<1) return json({ok:false,error:'Invalid id'},400); const db=getDatabase(env); await ensureSchema(db); const ex=await db.prepare('SELECT id FROM showcase_catalog WHERE id=?').bind(id).first(); if(!ex) return json({ok:false,error:'Item not found'},404); await db.prepare("UPDATE showcase_catalog SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END, updated_at=datetime('now') WHERE id=?").bind(id).run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);}}
async function handleAdminGrantCatalogUnlock(request, env, path){try{const auth=await requireAdmin(request, env); if(auth) return auth; const userId=Number(path.split('/')[4]); const b=await readJsonBody(request); const itemId=Number(b.catalog_item_id); if(!Number.isInteger(userId)||userId<1) return json({ok:false,error:'Invalid user id'},400); if(!Number.isInteger(itemId)||itemId<1) return json({ok:false,error:'catalog_item_id required'},400); const db=getDatabase(env); await ensureSchema(db); const user=await db.prepare('SELECT id FROM users WHERE id=?').bind(userId).first(); if(!user) return json({ok:false,error:'User not found'},404); const item=await db.prepare('SELECT id FROM showcase_catalog WHERE id=?').bind(itemId).first(); if(!item) return json({ok:false,error:'Catalogue item not found'},404); await db.prepare("INSERT OR IGNORE INTO user_showcase_unlocks (user_id,catalog_item_id,unlock_source) VALUES (?,?,?)").bind(userId,itemId,String(b.unlock_source||'admin').trim()||'admin').run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);}}


async function requireChatUser(request, env) { const user = await getCurrentUser(request, env); if (!user) return { error: json({ ok: false, error: 'Not logged in' }, 401) }; return { user }; }
async function getChatRoomForUser(db, userId, roomId) { return db.prepare(`SELECT r.id, r.room_key, r.room_type, r.name FROM chat_rooms r LEFT JOIN chat_room_members m ON m.room_id = r.id AND m.user_id = ? WHERE r.id = ? AND (r.room_type = 'global' OR m.user_id IS NOT NULL)`).bind(userId, roomId).first(); }
async function handleChatRooms(request, env) { const auth = await requireChatUser(request, env); if (auth.error) return auth.error; const db=getDatabase(env); await ensureSchema(db); const rows=await db.prepare(`SELECT r.id, r.room_key, r.room_type, r.name, COALESCE((SELECT COUNT(1) FROM chat_messages cm WHERE cm.room_id=r.id AND cm.deleted_at IS NULL AND cm.id > COALESCE(m.last_read_message_id,0)),0) as unread_count FROM chat_rooms r LEFT JOIN chat_room_members m ON m.room_id=r.id AND m.user_id=? WHERE r.room_type='global' OR m.user_id IS NOT NULL ORDER BY r.room_type='global' DESC, r.updated_at DESC`).bind(auth.user.id).all(); return json({ok:true,rooms:(rows.results||[]).map(r=>({...r,unread_count:Number(r.unread_count||0)}))}); }
async function handleChatMessagesGet(request, env){ const auth=await requireChatUser(request, env); if(auth.error) return auth.error; const db=getDatabase(env); await ensureSchema(db); const url=new URL(request.url); const roomId=Number(url.searchParams.get('room_id')); const afterId=Number(url.searchParams.get('after_id')||0); if(!Number.isInteger(roomId)||roomId<1) return json({ok:false,error:'Invalid room_id'},400); const room=await getChatRoomForUser(db,auth.user.id,roomId); if(!room) return json({ok:false,error:'Room not found'},404); let q='SELECT m.id,m.room_id,m.sender_user_id,u.username as sender_username,COALESCE(p.display_name,u.username) as sender_display_name,COALESCE(p.avatar_url,"") as sender_avatar_url,CASE WHEN m.deleted_at IS NULL THEN m.body ELSE "[deleted]" END as body,m.created_at FROM chat_messages m JOIN users u ON u.id=m.sender_user_id LEFT JOIN user_profiles p ON p.user_id=u.id WHERE m.room_id=?'; const binds=[roomId]; if(Number.isInteger(afterId)&&afterId>0){q+=' AND m.id>?'; binds.push(afterId);} q+=' ORDER BY m.id DESC LIMIT 50'; const rows=await db.prepare(q).bind(...binds).all(); const ranks = await loadAccountRanks(request, env); const rankList = ranks.ok ? ranks.ranks : []; const messages=[]; for (const row of ((rows.results||[]).reverse())) { const progress = await getUserAccountProgress(db, row.sender_user_id); const rank = getDisplayedRank(progress.accountLevel, null, rankList) || null; messages.push({ ...row, sender_accountLevel: progress.accountLevel || 1, sender_rank: rank ? { id: rank.id, name: rank.name, level: rank.level } : null }); } return json({ok:true,messages}); }

async function handleChatMessagesPost(request, env){ try{const auth=await requireChatUser(request, env); if(auth.error) return auth.error; const body=await readJsonBody(request); const roomId=Number(body?.room_id); const text=String(body?.body??'').trim(); if(!Number.isInteger(roomId)||roomId<1) return json({ok:false,error:'Invalid room_id'},400); if(!text) return json({ok:false,error:'Message body required'},400); if(text.length>1000) return json({ok:false,error:'Message too long'},400); const db=getDatabase(env); await ensureSchema(db); const room=await getChatRoomForUser(db,auth.user.id,roomId); if(!room) return json({ok:false,error:'Room not found'},404); const r=await db.prepare('INSERT INTO chat_messages (room_id, sender_user_id, body) VALUES (?,?,?)').bind(roomId,auth.user.id,text).run(); await db.prepare("UPDATE chat_rooms SET updated_at=datetime('now') WHERE id=?").bind(roomId).run(); const msg=await db.prepare(`SELECT m.id,m.room_id,m.sender_user_id,u.username as sender_username,COALESCE(p.display_name,u.username) as sender_display_name,COALESCE(p.avatar_url,"") as sender_avatar_url,m.body,m.created_at FROM chat_messages m JOIN users u ON u.id=m.sender_user_id LEFT JOIN user_profiles p ON p.user_id=u.id WHERE m.id=?`).bind(r.meta.last_row_id).first(); const ranks=await loadAccountRanks(request, env); const rankList=ranks.ok?ranks.ranks:[]; const progress=await getUserAccountProgress(db, auth.user.id); const rank=getDisplayedRank(progress.accountLevel,null,rankList)||null; return json({ok:true,message:{...msg,sender_accountLevel:progress.accountLevel||1,sender_rank:rank?{id:rank.id,name:rank.name,level:rank.level}:null}},201);}catch(error){return json({ok:false,error:friendlyError(error)},500);} }
async function handleChatDirect(request, env){ try{const auth=await requireChatUser(request, env); if(auth.error) return auth.error; const body=await readJsonBody(request); const username=String(body?.username||'').trim(); if(!username) return json({ok:false,error:'username required'},400); const db=getDatabase(env); await ensureSchema(db); const target=await db.prepare('SELECT id, username FROM users WHERE username=?').bind(username).first(); if(!target) return json({ok:false,error:'User not found'},404); if(Number(target.id)===Number(auth.user.id)) return json({ok:false,error:'Cannot message yourself'},400); const [a,b]=[Number(auth.user.id),Number(target.id)].sort((x,y)=>x-y); const roomKey=`direct:${a}:${b}`; let room=await db.prepare('SELECT id, room_type, name FROM chat_rooms WHERE room_key=?').bind(roomKey).first(); if(!room){const name='Chat with '+target.username; const created=await db.prepare("INSERT INTO chat_rooms (room_key, room_type, name, created_by) VALUES (?, 'direct', ?, ?)").bind(roomKey,name,auth.user.id).run(); room={id:created.meta.last_row_id,room_type:'direct',name};} await db.prepare('INSERT OR IGNORE INTO chat_room_members (room_id, user_id) VALUES (?, ?)').bind(room.id, a).run(); await db.prepare('INSERT OR IGNORE INTO chat_room_members (room_id, user_id) VALUES (?, ?)').bind(room.id, b).run(); return json({ok:true,room:{id:room.id,room_type:'direct',name:room.name}});}catch(error){return json({ok:false,error:friendlyError(error)},500);} }
async function handleChatRead(request, env){ try{const auth=await requireChatUser(request, env); if(auth.error) return auth.error; const body=await readJsonBody(request); const roomId=Number(body?.room_id); const lastRead=Number(body?.last_read_message_id); if(!Number.isInteger(roomId)||roomId<1||!Number.isInteger(lastRead)||lastRead<0) return json({ok:false,error:'Invalid payload'},400); const db=getDatabase(env); await ensureSchema(db); const room=await getChatRoomForUser(db,auth.user.id,roomId); if(!room) return json({ok:false,error:'Room not found'},404); await db.prepare("INSERT INTO chat_room_members (room_id, user_id, last_read_message_id) VALUES (?,?,?) ON CONFLICT(room_id,user_id) DO UPDATE SET last_read_message_id=excluded.last_read_message_id").bind(roomId,auth.user.id,lastRead).run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);} }
async function handleAdminChatDelete(request, env, path){ try{const auth=await requireAdmin(request, env); if(auth) return auth; const id=Number(path.split('/')[5]); if(!Number.isInteger(id)||id<1) return json({ok:false,error:'Invalid id'},400); const db=getDatabase(env); await ensureSchema(db); await db.prepare("UPDATE chat_messages SET deleted_at=datetime('now') WHERE id=?").bind(id).run(); return json({ok:true});}catch(error){return json({ok:false,error:friendlyError(error)},500);} }
