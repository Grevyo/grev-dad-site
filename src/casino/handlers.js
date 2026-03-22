import { ensureCasinoTables } from './schema.js';

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
  const { json, requireGamblingAdmin, safeJson, isoNow } = deps;
  const url = new URL(request.url);
  const { pathname } = url;
  if (!pathname.startsWith('/api/casino')) return null;
  const db = await ensureCasinoTables(env);
  if (!db) return json({ success: false, error: 'CASES_DB is not configured' }, 500, request);

  if (pathname === '/api/casino/catalog' && request.method === 'GET') {
    const sections = await buildCatalogPayload(db);
    return json({ success: true, sections }, 200, request);
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
