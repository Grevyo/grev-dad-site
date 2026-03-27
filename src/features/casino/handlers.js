import { ensureCasinoTables } from './schema.js';
import { getCasinoLeaderboards } from './leaderboards.js';

function parseJsonSafe(value, fallback = {}) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeColor(value, fallback = '#eb4b4b') {
  const color = cleanText(value, fallback);
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function normalizeSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    const safeKey = cleanText(key);
    if (!safeKey) continue;
    if (typeof raw === 'boolean') result[safeKey] = raw;
    else if (typeof raw === 'number' && Number.isFinite(raw)) result[safeKey] = raw;
    else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed === 'true' || trimmed === 'false') result[safeKey] = trimmed === 'true';
      else if (trimmed !== '' && !Number.isNaN(Number(trimmed))) result[safeKey] = Number(trimmed);
      else result[safeKey] = trimmed;
    }
  }
  return result;
}



async function buildCasinoBalanceRows(env, formatCoins) {
  const users = await env.DB.prepare(`
    SELECT u.id, u.username, u.approved, u.gambling_admin, c.grev_coin_balance, c.updated_at, c.refreshed_at
    FROM casino_profiles c
    INNER JOIN users u ON u.id = c.user_id
    ORDER BY LOWER(u.username) ASC
  `).all();

  return (users.results || []).map((row) => ({
    user_id: Number(row.id),
    username: row.username || `User ${row.id}`,
    approved: Boolean(row.approved),
    gambling_admin: Boolean(row.gambling_admin),
    balance: formatCoins(row.grev_coin_balance || 0),
    balance_pence: Number(row.grev_coin_balance || 0),
    updated_at: row.updated_at || null,
    refreshed_at: row.refreshed_at || null
  }));
}

async function buildCatalogPayload(db) {
  const [sectionRows, gameRows] = await Promise.all([
    db.prepare(`SELECT * FROM casino_sections ORDER BY sort_order ASC, title ASC`).all(),
    db.prepare(`SELECT * FROM casino_games ORDER BY section_slug ASC, sort_order ASC, title ASC`).all()
  ]);
  const games = gameRows.results || [];
  return (sectionRows.results || []).map((section) => ({
    id: Number(section.id || 0),
    slug: section.slug,
    title: section.title,
    description: section.description,
    accent_color: section.accent_color || '#eb4b4b',
    is_active: Boolean(section.is_active),
    sort_order: Number(section.sort_order || 0),
    settings: parseJsonSafe(section.settings_json),
    games: games.filter((game) => game.section_slug === section.slug).map((game) => ({
      id: Number(game.id || 0),
      section_slug: game.section_slug,
      slug: game.slug,
      title: game.title,
      summary: game.summary,
      badge: game.badge || '',
      is_active: Boolean(game.is_active),
      sort_order: Number(game.sort_order || 0),
      settings: parseJsonSafe(game.settings_json)
    }))
  }));
}

export async function handleCasinoRequest(request, env, deps) {
  const { json, requireGamblingAdmin, safeJson, isoNow, ensureCasinoProfile, formatCasinoProfile, getCasinoDailySpinState, toCoinAmount } = deps;
  const url = new URL(request.url);
  const { pathname } = url;
  if (!pathname.startsWith('/api/casino')) return null;
  const db = await ensureCasinoTables(env);
  if (!db) return json({ success: false, error: 'CASES-DB is not configured' }, 500, request);

  if (pathname === '/api/casino/catalog' && request.method === 'GET') {
    const sections = await buildCatalogPayload(db);
    return json({ success: true, sections }, 200, request);
  }

  if (pathname === '/api/casino/leaderboards' && request.method === 'GET') {
    const leaderboards = await getCasinoLeaderboards(env);
    if (!leaderboards) return json({ success: false, error: 'CASES-DB is not configured' }, 500, request);
    return json({ success: true, leaderboards }, 200, request);
  }

  if (pathname === '/api/casino/admin/balances' && request.method === 'GET') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    return json({ success: true, balances: await buildCasinoBalanceRows(env, toCoinAmount) }, 200, request);
  }

  if (pathname === '/api/casino/admin/balance' && request.method === 'POST') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const userId = Number(body?.user_id);
    const delta = Number(body?.balance_delta_pence ?? body?.gambling_balance_delta ?? 0);
    if (!Number.isInteger(userId) || userId <= 0) return json({ success: false, error: 'A valid user id is required' }, 400, request);
    if (!Number.isInteger(delta) || delta === 0) return json({ success: false, error: 'balance_delta_pence must be a non-zero integer' }, 400, request);

    const user = await env.DB.prepare(`SELECT id, username FROM users WHERE id = ? LIMIT 1`).bind(userId).first();
    if (!user) return json({ success: false, error: 'User not found' }, 404, request);

    const profile = await ensureCasinoProfile(env, userId, user.username, { force: true });
    const nextBalance = Number(profile?.grev_coin_balance || 0) + delta;
    if (nextBalance < 0) return json({ success: false, error: 'Balance update would make the casino balance negative' }, 400, request);

    const now = isoNow();
    if (db) {
      await db.prepare(`UPDATE case_profiles SET balance = ?, updated_at = ? WHERE user_id = ?`).bind(nextBalance, now, userId).run();
    }
    await env.DB.prepare(`UPDATE casino_profiles SET grev_coin_balance = ?, updated_at = ?, refreshed_at = ? WHERE user_id = ?`).bind(nextBalance, now, now, userId).run();

    const updated = await ensureCasinoProfile(env, userId, user.username, { force: true });
    return json({ success: true, message: 'Casino balance updated', profile: formatCasinoProfile(updated, user.username), daily_spin: await getCasinoDailySpinState(env, userId), balance_after: toCoinAmount(nextBalance), balance_after_pence: nextBalance }, 200, request);
  }

  if (pathname === '/api/casino/admin/catalog' && request.method === 'GET') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const sections = await buildCatalogPayload(db);
    return json({ success: true, sections }, 200, request);
  }

  if (pathname === '/api/casino/admin/section' && request.method === 'POST') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const slug = cleanText(body?.slug).toLowerCase();
    if (!slug) return json({ success: false, error: 'Section slug is required' }, 400, request);
    const now = isoNow();
    await db.prepare(`
      UPDATE casino_sections
      SET title = ?, description = ?, accent_color = ?, settings_json = ?, is_active = ?, sort_order = ?, updated_at = ?
      WHERE slug = ?
    `).bind(
      cleanText(body?.title, slug),
      cleanText(body?.description, ''),
      normalizeColor(body?.accent_color),
      JSON.stringify(normalizeSettings(body?.settings)),
      body?.is_active === false ? 0 : 1,
      Math.max(0, Math.round(Number(body?.sort_order || 0))),
      now,
      slug
    ).run();
    return json({ success: true, message: 'Casino section updated' }, 200, request);
  }

  if (pathname === '/api/casino/admin/game' && request.method === 'POST') {
    const admin = await requireGamblingAdmin(request, env);
    if (admin instanceof Response) return admin;
    const body = await safeJson(request);
    const slug = cleanText(body?.slug).toLowerCase();
    if (!slug) return json({ success: false, error: 'Game slug is required' }, 400, request);
    const now = isoNow();
    await db.prepare(`
      UPDATE casino_games
      SET section_slug = ?, title = ?, summary = ?, badge = ?, settings_json = ?, is_active = ?, sort_order = ?, updated_at = ?
      WHERE slug = ?
    `).bind(
      cleanText(body?.section_slug).toLowerCase(),
      cleanText(body?.title, slug),
      cleanText(body?.summary, ''),
      cleanText(body?.badge, ''),
      JSON.stringify(normalizeSettings(body?.settings)),
      body?.is_active === false ? 0 : 1,
      Math.max(0, Math.round(Number(body?.sort_order || 0))),
      now,
      slug
    ).run();
    return json({ success: true, message: 'Casino game updated' }, 200, request);
  }

  return null;
}
