interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown[]>; }

export interface GrevNewsEnv {
  DB: D1Database;
  APP_ENV?: 'development' | 'pbe' | 'production';
  LIQUIPEDIA_API_KEY?: string;
}

type Viewer = { id: string; isAdmin: boolean; isOwner: boolean };
type SourceType = 'steam' | 'rss' | 'jsonfeed' | 'liquipedia';
type NewsStatus = 'draft' | 'published' | 'archived';
type SourceRow = {
  id: string;
  name: string;
  source_type: SourceType;
  source_url: string;
  category: string;
  team_keywords_json: string;
  enabled: number;
  auto_publish: number;
  refresh_minutes: number;
  last_checked_at: number | null;
  last_status: string | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
};
type ImportedItem = {
  key: string;
  title: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  publishedAt: number;
  sourceName?: string;
};

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const MAX_TITLE = 180;
const MAX_SUMMARY = 800;
const MAX_BODY = 12000;
const MAX_SOURCE_BYTES = 2_000_000;
const ALLOWED_CATEGORIES = new Set(['grev', 'cs2', 'team', 'site', 'community']);
const ALLOWED_STATUSES = new Set<NewsStatus>(['draft', 'published', 'archived']);
const ALLOWED_SOURCE_TYPES = new Set<SourceType>(['steam', 'rss', 'jsonfeed', 'liquipedia']);

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  }});
}
function cookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get('Cookie') ?? '').split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const index = value.indexOf('=');
    return index < 0 ? ['', ''] : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
  }).filter(([key]) => Boolean(key)));
}
function b64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
async function sha256(value: string): Promise<string> { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
async function viewerFromRequest(request: Request, env: GrevNewsEnv): Promise<Viewer | null> {
  const token = cookies(request)[COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT u.id,u.is_owner,
      CASE WHEN u.is_owner=1 OR EXISTS(
        SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin'
      ) THEN 1 ELSE 0 END is_admin
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), Math.floor(Date.now() / 1000)).first<{ id: string; is_owner: number; is_admin: number }>();
  return row ? { id: row.id, isOwner: Boolean(row.is_owner), isAdmin: Boolean(row.is_admin) } : null;
}
function sameOrigin(request: Request): boolean { const origin = request.headers.get('Origin'); return !origin || origin === new URL(request.url).origin; }
async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) throw new Error('JSON_REQUIRED');
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}
function now(): number { return Math.floor(Date.now() / 1000); }
function clampText(value: unknown, max: number): string { return String(value ?? '').trim().slice(0, max); }
function parseList(value: unknown, max = 24): string[] {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(',');
  return [...new Set(raw.map(item => String(item).trim()).filter(Boolean).map(item => item.slice(0, 80)))].slice(0, max);
}
function parseJsonList(value: string): string[] { try { const parsed: unknown = JSON.parse(value); return parseList(parsed); } catch { return []; } }
function category(value: unknown): string { const result = String(value ?? 'cs2').toLowerCase(); return ALLOWED_CATEGORIES.has(result) ? result : 'cs2'; }
function status(value: unknown): NewsStatus { const result = String(value ?? 'draft') as NewsStatus; return ALLOWED_STATUSES.has(result) ? result : 'draft'; }
function parseTimestamp(value: unknown, fallback = now()): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 10_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : fallback;
}
function stripMarkup(value: unknown): string {
  return String(value ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/\[\/?[a-z][^\]]*\]/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}
function safeExternalUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' || host === '::1') return null;
    if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return null;
    return url.toString();
  } catch { return null; }
}
function automaticSourceError(type: SourceType, url: string): string | null {
  const parsed = safeExternalUrl(url);
  if (!parsed) return 'Automatic source URLs must be safe HTTPS addresses.';
  const host = new URL(parsed).hostname.toLowerCase();
  if (host === 'hltv.org' || host.endsWith('.hltv.org')) return 'HLTV automatic importing is disabled because its terms prohibit scraping. Add HLTV stories manually as source links.';
  if (type === 'liquipedia' && host !== 'api.liquipedia.net') return 'Liquipedia sources must use the licensed api.liquipedia.net endpoint.';
  return null;
}
function tagValue(block: string, names: string[]): string {
  for (const name of names) {
    const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
    if (match?.[1]) return stripMarkup(match[1]);
  }
  return '';
}
function linkValue(block: string): string {
  const direct = tagValue(block, ['link']);
  if (direct) return direct;
  const href = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1];
  return href ? stripMarkup(href) : '';
}
function imageValue(block: string): string | null {
  const candidate = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*(?:url|href)=["']([^"']+)["'][^>]*>/i)?.[1];
  return safeExternalUrl(candidate ?? '');
}
function parseXmlFeed(xml: string, source: SourceRow): ImportedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0, 40);
  return blocks.map(match => {
    const block = match[2];
    const title = tagValue(block, ['title']).slice(0, MAX_TITLE);
    const url = safeExternalUrl(linkValue(block)) ?? source.source_url;
    const key = tagValue(block, ['guid', 'id']) || url || title;
    const summary = tagValue(block, ['description', 'summary', 'content:encoded', 'content']).slice(0, MAX_SUMMARY);
    const publishedAt = parseTimestamp(tagValue(block, ['pubDate', 'published', 'updated', 'dc:date']));
    return { key, title, summary, url, imageUrl: imageValue(block), publishedAt, sourceName: source.name };
  }).filter(item => item.title && item.url);
}
function parseJsonFeed(value: unknown, source: SourceRow): ImportedItem[] {
  const root = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rawItems = Array.isArray(root.items) ? root.items : Array.isArray(root.newsitems) ? root.newsitems : [];
  return rawItems.slice(0, 40).map(raw => {
    const item = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const title = clampText(item.title ?? item.name, MAX_TITLE);
    const url = safeExternalUrl(item.url ?? item.external_url ?? item.home_page_url) ?? source.source_url;
    const key = clampText(item.id ?? item.guid ?? item.gid ?? url ?? title, 500);
    const summary = stripMarkup(item.summary ?? item.content_text ?? item.content_html ?? item.description ?? item.contents).slice(0, MAX_SUMMARY);
    const publishedAt = parseTimestamp(item.date_published ?? item.date_modified ?? item.date ?? item.published_at);
    const imageUrl = safeExternalUrl(item.image ?? item.image_url ?? item.banner_image ?? '');
    return { key, title, summary, url, imageUrl, publishedAt, sourceName: source.name };
  }).filter(item => item.title && item.url);
}
function parseSteamFeed(value: unknown, source: SourceRow): ImportedItem[] {
  const root = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const appnews = root.appnews && typeof root.appnews === 'object' && !Array.isArray(root.appnews) ? root.appnews as Record<string, unknown> : {};
  return parseJsonFeed({ items: Array.isArray(appnews.newsitems) ? appnews.newsitems : [] }, source);
}
function parseLiquipedia(value: unknown, source: SourceRow): ImportedItem[] {
  const root = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rows = Array.isArray(root.result) ? root.result : Array.isArray(root.data) ? root.data : [];
  return rows.slice(0, 40).map(raw => {
    const item = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const pagename = clampText(item.pagename ?? item.name ?? item.title, MAX_TITLE);
    const opponent1 = clampText(item.opponent1 ?? item.team1, 80);
    const opponent2 = clampText(item.opponent2 ?? item.team2, 80);
    const title = clampText(item.title ?? item.name ?? (opponent1 && opponent2 ? `${opponent1} vs ${opponent2}` : pagename), MAX_TITLE);
    const pageUrl = pagename ? `https://liquipedia.net/counterstrike/${encodeURIComponent(pagename.replaceAll(' ', '_')).replaceAll('%2F', '/')}` : source.source_url;
    const url = safeExternalUrl(item.url ?? item.pageurl ?? item.wiki ?? pageUrl) ?? source.source_url;
    const summary = stripMarkup(item.summary ?? item.description ?? item.status ?? item.tickername ?? '').slice(0, MAX_SUMMARY);
    const key = clampText(item.id ?? item.objectid ?? item.wiki ?? item.pagename ?? url ?? title, 500);
    return { key, title, summary, url, imageUrl: safeExternalUrl(item.imageurl ?? item.logo ?? ''), publishedAt: parseTimestamp(item.date ?? item.startdate ?? item.timestamp), sourceName: 'Liquipedia' };
  }).filter(item => item.title && item.url);
}
function matchingTeams(item: ImportedItem, keywords: string[]): string[] {
  if (!keywords.length) return [];
  const haystack = `${item.title} ${item.summary}`.toLowerCase();
  return keywords.filter(keyword => haystack.includes(keyword.toLowerCase()));
}
async function sourceItems(source: SourceRow, env: GrevNewsEnv): Promise<ImportedItem[]> {
  const sourceUrl = source.source_type === 'steam'
    ? (source.source_url || 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=20&maxlength=600')
    : source.source_url;
  const problem = automaticSourceError(source.source_type, sourceUrl);
  if (problem) throw new Error(problem);
  const headers = new Headers({ 'Accept': source.source_type === 'rss' ? 'application/rss+xml, application/atom+xml, text/xml;q=0.9, */*;q=0.5' : 'application/json', 'User-Agent': 'GrevNews/1.0 (https://grev.dad/news)' });
  if (source.source_type === 'liquipedia') {
    if (!env.LIQUIPEDIA_API_KEY) throw new Error('Liquipedia API access is not configured. Add the LIQUIPEDIA_API_KEY Worker secret after approval.');
    headers.set('Authorization', `Apikey ${env.LIQUIPEDIA_API_KEY}`);
  }
  const response = await fetch(sourceUrl, { headers, redirect: 'follow' });
  if (!response.ok) throw new Error(`${source.name} returned HTTP ${response.status}.`);
  const length = Number(response.headers.get('Content-Length') ?? 0);
  if (length > MAX_SOURCE_BYTES) throw new Error(`${source.name} returned more than 2 MB.`);
  if (source.source_type === 'rss') return parseXmlFeed((await response.text()).slice(0, MAX_SOURCE_BYTES), source);
  const value: unknown = await response.json();
  if (source.source_type === 'steam') return parseSteamFeed(value, source);
  if (source.source_type === 'liquipedia') return parseLiquipedia(value, source);
  return parseJsonFeed(value, source);
}
async function importSource(env: GrevNewsEnv, source: SourceRow, actorId: string | null): Promise<{ imported: number; skipped: number; error?: string }> {
  const started = now();
  let imported = 0;
  let skipped = 0;
  let error: string | null = null;
  try {
    const items = await sourceItems(source, env);
    const keywords = parseJsonList(source.team_keywords_json);
    const statements: D1Statement[] = [];
    for (const item of items) {
      const teams = matchingTeams(item, keywords);
      if (keywords.length && !teams.length) { skipped += 1; continue; }
      const externalKey = await sha256(`${source.id}:${item.key || item.url}`);
      const postStatus: NewsStatus = source.auto_publish ? 'published' : 'draft';
      statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO grev_news_posts(
          id,title,summary,body,category,team_tags_json,status,is_featured,source_name,source_url,image_url,
          external_key,published_at,created_by,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        crypto.randomUUID(), item.title.slice(0, MAX_TITLE), item.summary.slice(0, MAX_SUMMARY), null,
        source.category, JSON.stringify(teams), postStatus, 0, item.sourceName ?? source.name, item.url,
        item.imageUrl, externalKey, item.publishedAt || started, actorId, started, started
      ));
    }
    if (statements.length) {
      const before = await env.DB.prepare(`SELECT COUNT(*) total FROM grev_news_posts`).first<{ total: number }>();
      await env.DB.batch(statements);
      const after = await env.DB.prepare(`SELECT COUNT(*) total FROM grev_news_posts`).first<{ total: number }>();
      imported = Math.max(0, Number(after?.total ?? 0) - Number(before?.total ?? 0));
      skipped += Math.max(0, statements.length - imported);
    }
    await env.DB.prepare(`UPDATE grev_news_sources SET last_checked_at=?,last_status='ok',last_error=NULL,updated_at=? WHERE id=?`).bind(started, started, source.id).run();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'Unknown import failure.';
    await env.DB.prepare(`UPDATE grev_news_sources SET last_checked_at=?,last_status='error',last_error=?,updated_at=? WHERE id=?`).bind(started, error.slice(0, 800), started, source.id).run();
  }
  await env.DB.prepare(`INSERT INTO grev_news_import_runs(id,source_id,started_at,finished_at,imported_count,skipped_count,status,error_message,triggered_by) VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), source.id, started, now(), imported, skipped, error ? 'error' : 'ok', error, actorId).run();
  return error ? { imported, skipped, error } : { imported, skipped };
}
async function activeSources(env: GrevNewsEnv): Promise<SourceRow[]> {
  return (await env.DB.prepare(`SELECT * FROM grev_news_sources WHERE enabled=1 ORDER BY name`).all<SourceRow>()).results;
}
export async function refreshGrevNewsSources(env: GrevNewsEnv, actorId: string | null = null): Promise<{ sources: number; imported: number; errors: number }> {
  const sources = await activeSources(env);
  let imported = 0;
  let errors = 0;
  const timestamp = now();
  for (const source of sources) {
    const due = !source.last_checked_at || timestamp - source.last_checked_at >= Math.max(15, source.refresh_minutes) * 60;
    if (!due && actorId === null) continue;
    const result = await importSource(env, source, actorId);
    imported += result.imported;
    if (result.error) errors += 1;
  }
  return { sources: sources.length, imported, errors };
}
function postRecord(input: Record<string, unknown>, existing?: Record<string, unknown>): Record<string, unknown> {
  const title = clampText(input.title ?? existing?.title, MAX_TITLE);
  if (!title) throw new Error('A news title is required.');
  const sourceUrlRaw = clampText(input.sourceUrl ?? existing?.source_url, 1000);
  const sourceUrl = sourceUrlRaw ? safeExternalUrl(sourceUrlRaw) : null;
  if (sourceUrlRaw && !sourceUrl) throw new Error('Source links must be safe HTTPS URLs.');
  const imageUrlRaw = clampText(input.imageUrl ?? existing?.image_url, 1000);
  const imageUrl = imageUrlRaw ? safeExternalUrl(imageUrlRaw) : null;
  if (imageUrlRaw && !imageUrl) throw new Error('News images must use safe HTTPS URLs.');
  const postStatus = status(input.status ?? existing?.status);
  return {
    title,
    summary: clampText(input.summary ?? existing?.summary, MAX_SUMMARY),
    body: clampText(input.body ?? existing?.body, MAX_BODY),
    category: category(input.category ?? existing?.category),
    teamTags: parseList(input.teamTags ?? (existing ? parseJsonList(String(existing.team_tags_json ?? '[]')) : [])),
    status: postStatus,
    featured: Boolean(input.featured ?? existing?.is_featured),
    sourceName: clampText(input.sourceName ?? existing?.source_name, 120),
    sourceUrl,
    imageUrl,
    publishedAt: postStatus === 'published' ? parseTimestamp(input.publishedAt ?? existing?.published_at, now()) : parseTimestamp(existing?.published_at, now())
  };
}
function sourceRecord(input: Record<string, unknown>, existing?: SourceRow): Record<string, unknown> {
  const name = clampText(input.name ?? existing?.name, 120);
  const sourceType = String(input.sourceType ?? existing?.source_type ?? 'rss') as SourceType;
  const sourceUrl = clampText(input.sourceUrl ?? existing?.source_url, 1500);
  if (!name) throw new Error('A source name is required.');
  if (!ALLOWED_SOURCE_TYPES.has(sourceType)) throw new Error('Choose a supported source type.');
  const problem = automaticSourceError(sourceType, sourceUrl || (sourceType === 'steam' ? 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=730&count=20&maxlength=600' : ''));
  if (problem) throw new Error(problem);
  const refreshMinutes = Math.max(sourceType === 'liquipedia' ? 60 : 15, Math.min(1440, Number(input.refreshMinutes ?? existing?.refresh_minutes ?? 60)));
  return {
    name,
    sourceType,
    sourceUrl,
    category: category(input.category ?? existing?.category),
    teamKeywords: parseList(input.teamKeywords ?? (existing ? parseJsonList(existing.team_keywords_json) : [])),
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : Boolean(existing?.enabled ?? 1),
    autoPublish: input.autoPublish !== undefined ? Boolean(input.autoPublish) : Boolean(existing?.auto_publish ?? 0),
    refreshMinutes
  };
}
async function publicNews(request: Request, env: GrevNewsEnv): Promise<Response> {
  const url = new URL(request.url);
  const categoryFilter = url.searchParams.get('category');
  const team = (url.searchParams.get('team') ?? '').trim().toLowerCase();
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 40)));
  const rows = (await env.DB.prepare(`
    SELECT id,title,summary,body,category,team_tags_json,status,is_featured,source_name,source_url,image_url,published_at,created_at,updated_at
    FROM grev_news_posts WHERE status='published' ORDER BY is_featured DESC,published_at DESC LIMIT 150
  `).all<Record<string, unknown>>()).results.filter(row => {
    if (categoryFilter && categoryFilter !== 'all' && row.category !== categoryFilter) return false;
    if (!team) return true;
    return parseJsonList(String(row.team_tags_json ?? '[]')).some(tag => tag.toLowerCase().includes(team));
  }).slice(0, limit).map(row => ({ ...row, teamTags: parseJsonList(String(row.team_tags_json ?? '[]')), team_tags_json: undefined }));
  return json({ posts: rows, generatedAt: now() });
}
async function adminSnapshot(env: GrevNewsEnv): Promise<Response> {
  const [posts, sources, runs] = await Promise.all([
    env.DB.prepare(`SELECT * FROM grev_news_posts ORDER BY updated_at DESC LIMIT 200`).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT * FROM grev_news_sources ORDER BY name`).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT r.*,s.name source_name FROM grev_news_import_runs r JOIN grev_news_sources s ON s.id=r.source_id ORDER BY r.started_at DESC LIMIT 40`).all<Record<string, unknown>>()
  ]);
  return json({
    posts: posts.results.map(row => ({ ...row, teamTags: parseJsonList(String(row.team_tags_json ?? '[]')) })),
    sources: sources.results.map(row => ({ ...row, teamKeywords: parseJsonList(String(row.team_keywords_json ?? '[]')) })),
    runs: runs.results
  });
}
export async function handleGrevNewsRequest(request: Request, env: GrevNewsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/api/news' && request.method === 'GET') return publicNews(request, env);
  if (!path.startsWith('/api/admin/news')) return null;

  const viewer = await viewerFromRequest(request, env);
  if (!viewer?.isAdmin) return json({ ok: false, message: 'Administrator access is required.' }, 403);
  if (request.method !== 'GET' && !sameOrigin(request)) return json({ ok: false, message: 'Origin rejected.' }, 403);
  if (path === '/api/admin/news' && request.method === 'GET') return adminSnapshot(env);

  try {
    if (path === '/api/admin/news/posts' && request.method === 'POST') {
      const input = await readBody(request);
      const post = postRecord(input);
      const timestamp = now();
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO grev_news_posts(id,title,summary,body,category,team_tags_json,status,is_featured,source_name,source_url,image_url,external_key,published_at,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id, post.title, post.summary, post.body || null, post.category, JSON.stringify(post.teamTags), post.status, post.featured ? 1 : 0, post.sourceName || null, post.sourceUrl, post.imageUrl, null, post.publishedAt, viewer.id, timestamp, timestamp),
        env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)`)
          .bind(crypto.randomUUID(), viewer.id, 'news.post_created', 'grev_news_post', id, JSON.stringify({ status: post.status }), timestamp)
      ]);
      return json({ ok: true, id }, 201);
    }
    const postMatch = path.match(/^\/api\/admin\/news\/posts\/([^/]+)$/);
    if (postMatch && request.method === 'PUT') {
      const id = decodeURIComponent(postMatch[1]);
      const existing = await env.DB.prepare(`SELECT * FROM grev_news_posts WHERE id=?`).bind(id).first<Record<string, unknown>>();
      if (!existing) return json({ ok: false, message: 'News post not found.' }, 404);
      const post = postRecord(await readBody(request), existing);
      await env.DB.prepare(`UPDATE grev_news_posts SET title=?,summary=?,body=?,category=?,team_tags_json=?,status=?,is_featured=?,source_name=?,source_url=?,image_url=?,published_at=?,updated_at=? WHERE id=?`)
        .bind(post.title, post.summary, post.body || null, post.category, JSON.stringify(post.teamTags), post.status, post.featured ? 1 : 0, post.sourceName || null, post.sourceUrl, post.imageUrl, post.publishedAt, now(), id).run();
      return json({ ok: true });
    }
    if (postMatch && request.method === 'DELETE') {
      const id = decodeURIComponent(postMatch[1]);
      await env.DB.prepare(`DELETE FROM grev_news_posts WHERE id=?`).bind(id).run();
      return json({ ok: true });
    }
    if (path === '/api/admin/news/sources' && request.method === 'POST') {
      const source = sourceRecord(await readBody(request));
      const id = crypto.randomUUID();
      const timestamp = now();
      await env.DB.prepare(`INSERT INTO grev_news_sources(id,name,source_type,source_url,category,team_keywords_json,enabled,auto_publish,refresh_minutes,last_checked_at,last_status,last_error,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, source.name, source.sourceType, source.sourceUrl, source.category, JSON.stringify(source.teamKeywords), source.enabled ? 1 : 0, source.autoPublish ? 1 : 0, source.refreshMinutes, null, null, null, viewer.id, timestamp, timestamp).run();
      return json({ ok: true, id }, 201);
    }
    const sourceMatch = path.match(/^\/api\/admin\/news\/sources\/([^/]+)$/);
    if (sourceMatch && request.method === 'PUT') {
      const id = decodeURIComponent(sourceMatch[1]);
      const existing = await env.DB.prepare(`SELECT * FROM grev_news_sources WHERE id=?`).bind(id).first<SourceRow>();
      if (!existing) return json({ ok: false, message: 'News source not found.' }, 404);
      const source = sourceRecord(await readBody(request), existing);
      await env.DB.prepare(`UPDATE grev_news_sources SET name=?,source_type=?,source_url=?,category=?,team_keywords_json=?,enabled=?,auto_publish=?,refresh_minutes=?,updated_at=? WHERE id=?`)
        .bind(source.name, source.sourceType, source.sourceUrl, source.category, JSON.stringify(source.teamKeywords), source.enabled ? 1 : 0, source.autoPublish ? 1 : 0, source.refreshMinutes, now(), id).run();
      return json({ ok: true });
    }
    if (sourceMatch && request.method === 'DELETE') {
      const id = decodeURIComponent(sourceMatch[1]);
      await env.DB.prepare(`DELETE FROM grev_news_sources WHERE id=?`).bind(id).run();
      return json({ ok: true });
    }
    const importMatch = path.match(/^\/api\/admin\/news\/sources\/([^/]+)\/import$/);
    if (importMatch && request.method === 'POST') {
      const id = decodeURIComponent(importMatch[1]);
      const source = await env.DB.prepare(`SELECT * FROM grev_news_sources WHERE id=?`).bind(id).first<SourceRow>();
      if (!source) return json({ ok: false, message: 'News source not found.' }, 404);
      const result = await importSource(env, source, viewer.id);
      return json({ ok: !result.error, ...result }, result.error ? 502 : 200);
    }
    if (path === '/api/admin/news/import-all' && request.method === 'POST') {
      return json({ ok: true, ...(await refreshGrevNewsSources(env, viewer.id)) });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The news request could not be completed.';
    return json({ ok: false, message }, 400);
  }
  return null;
}
