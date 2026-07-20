interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

export interface PlatformEnv {
  DB: D1Database;
  APP_ENV: 'development' | 'pbe' | 'production';
}

type User = { id: string; username: string; displayName: string; isVerified: boolean; isOwner: boolean; isAdmin: boolean };
type ItemType = 'task'|'reminder'|'event'|'project'|'favourite'|'achievement'|'gaming_account'|'equipment'|'timeline'|'media'|'post'|'announcement';
type Visibility = 'private'|'account'|'verified'|'group';
type ItemRow = {
  id: string; owner_user_id: string; group_id: string|null; item_type: ItemType; title: string; body: string; data_json: string;
  visibility: Visibility; starts_at: number|null; ends_at: number|null; completed_at: number|null; pinned: number; sort_order: number;
  created_at: number; updated_at: number; owner_username?: string; owner_display_name?: string; group_name?: string|null;
};
type Layout = { tiles: Record<string, unknown>[]; preferences: Record<string, unknown> };

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_RE = /^(home|page-[0-9a-f-]{36})$/i;
const ITEM_TYPES = new Set<ItemType>(['task','reminder','event','project','favourite','achievement','gaming_account','equipment','timeline','media','post','announcement']);
const VISIBILITIES = new Set<Visibility>(['private','account','verified','group']);
const MODES = new Set(['desktop','mobile']);
const MAX_LAYOUT_BYTES = 1_000_000;
const MAX_TILES = 80;
const SAFE_TILE_FIELDS = new Set([
  'featureId','sourceFeatureId','x','y','width','height','colour','contentMode','customTitle','customIcon','mediaFit','mediaOverlay','iconMode','iconLabel','iconMedia',
  'iconTextColour','iconBackgroundColour','iconBorderColour','iconMediaFit','backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle',
  'backgroundMedia','textColour','borderColour','fontFamily'
]);

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function sha256(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}
function parseCookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get('Cookie') ?? '').split(';').map(value => value.trim()).filter(Boolean).map(value => {
    const index = value.indexOf('=');
    return index < 0 ? ['', ''] : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
  }).filter(([key]) => key));
}
async function getUser(request: Request, env: PlatformEnv): Promise<User | null> {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT u.id,u.username,u.display_name,u.is_verified,u.is_owner,
      CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), Math.floor(Date.now() / 1000)).first<{id:string;username:string;display_name:string;is_verified:number;is_owner:number;is_admin:number}>();
  return row ? { id: row.id, username: row.username, displayName: row.display_name, isVerified: Boolean(row.is_verified), isOwner: Boolean(row.is_owner), isAdmin: Boolean(row.is_admin) } : null;
}
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  }});
}
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get('Content-Type') ?? '').includes('application/json')) throw new Error('JSON_REQUIRED');
  const value: unknown = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_BODY');
  return value as Record<string, unknown>;
}
function safeJson(value: string): Record<string, unknown> {
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; }
}
function now(): number { return Math.floor(Date.now() / 1000); }
function itemJson(row: ItemRow, viewer: User) {
  return {
    id: row.id, ownerId: row.owner_user_id, groupId: row.group_id, groupName: row.group_name ?? null, type: row.item_type,
    title: row.title, body: row.body, data: safeJson(row.data_json), visibility: row.visibility, startsAt: row.starts_at,
    endsAt: row.ends_at, completedAt: row.completed_at, pinned: Boolean(row.pinned), sortOrder: row.sort_order,
    createdAt: row.created_at, updatedAt: row.updated_at,
    owner: row.owner_username ? { id: row.owner_user_id, username: row.owner_username, displayName: row.owner_display_name } : null,
    canEdit: row.owner_user_id === viewer.id || viewer.isAdmin
  };
}
async function userGroups(env: PlatformEnv, userId: string): Promise<Set<string>> {
  const rows = await env.DB.prepare(`SELECT group_id FROM group_memberships WHERE user_id=?`).bind(userId).all<{group_id:string}>();
  return new Set(rows.results.map(row => row.group_id));
}
async function canUseGroup(env: PlatformEnv, user: User, groupId: string, requireManage = false): Promise<boolean> {
  if (user.isAdmin) return true;
  if (requireManage) return false;
  return Boolean(await env.DB.prepare(`SELECT 1 AS ok FROM group_memberships WHERE user_id=? AND group_id=?`).bind(user.id, groupId).first());
}
function cleanData(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(key)) continue;
    if (item === null || ['number','boolean'].includes(typeof item)) {
    result[key] = item;
  } else if (typeof item === 'string') {
    if (key === 'mediaUrl') {
      if (/^https:\/\//i.test(item)) result[key] = item.slice(0, 2048);
      else if (/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/]+={0,2}$/i.test(item) && item.length <= 1_900_000) result[key] = item;
    } else result[key] = item.slice(0, 2000);
  }
  }
  return result;
}
function parseTimestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}
async function notify(env: PlatformEnv, recipientId: string, actorId: string|null, type: string, title: string, text: string, targetUrl: string|null, metadata: unknown = {}) {
  if (recipientId === actorId) return;
  await env.DB.prepare(`INSERT INTO notifications(id,recipient_user_id,actor_user_id,notification_type,title,body,target_url,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), recipientId, actorId, type, title.slice(0,120), text.slice(0,500), targetUrl, JSON.stringify(metadata), now()).run();
}
async function notifyGroup(env: PlatformEnv, groupId: string, actorId: string, type: string, title: string, text: string, targetUrl: string|null, metadata: unknown = {}) {
  const created = now();
  await env.DB.prepare(`
    INSERT INTO notifications(id,recipient_user_id,actor_user_id,notification_type,title,body,target_url,metadata_json,created_at)
    SELECT lower(hex(randomblob(4)))||'-'||lower(hex(randomblob(2)))||'-4'||substr(lower(hex(randomblob(2))),2)||'-a'||substr(lower(hex(randomblob(2))),2)||'-'||lower(hex(randomblob(6))),
      gm.user_id,?,?,?,?,?,?,?
    FROM group_memberships gm WHERE gm.group_id=? AND gm.user_id<>?
  `).bind(actorId, type, title.slice(0,120), text.slice(0,500), targetUrl, JSON.stringify(metadata), created, groupId, actorId).run();
}

async function listItems(request: Request, env: PlatformEnv, user: User): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const ownerId = url.searchParams.get('ownerId') ?? user.id;
  const groupId = url.searchParams.get('groupId');
  if (type && !ITEM_TYPES.has(type as ItemType)) return json({ ok:false, message:'Unknown content module.' },400);
  if (ownerId !== user.id && !UUID_RE.test(ownerId)) return json({ ok:false, message:'Profile not found.' },404);
  const groups = await userGroups(env, user.id);
  const parameters: unknown[] = [ownerId, user.id, user.isVerified ? 1 : 0];
  let where = `i.owner_user_id=? AND (
    i.owner_user_id=? OR i.visibility='account' OR (i.visibility='verified' AND ?=1)
    OR (i.visibility='group' AND i.group_id IS NOT NULL AND EXISTS(SELECT 1 FROM group_memberships gm WHERE gm.group_id=i.group_id AND gm.user_id=?))
  )`;
  parameters.push(user.id);
  if (type) { where += ` AND i.item_type=?`; parameters.push(type); }
  if (groupId) {
    if (!groups.has(groupId) && !user.isAdmin) return json({ ok:false, message:'Group access required.' },403);
    where += ` AND i.group_id=?`; parameters.push(groupId);
  }
  const rows = await env.DB.prepare(`
    SELECT i.*,u.username AS owner_username,u.display_name AS owner_display_name,g.name AS group_name
    FROM content_items i JOIN users u ON u.id=i.owner_user_id LEFT JOIN groups g ON g.id=i.group_id
    WHERE ${where}
    ORDER BY i.pinned DESC,CASE WHEN i.starts_at IS NULL THEN 1 ELSE 0 END,i.starts_at,i.sort_order,i.updated_at DESC LIMIT 200
  `).bind(...parameters).all<ItemRow>();
  return json({ ok:true, items:rows.results.map(row => itemJson(row,user)) });
}
async function createItem(request: Request, env: PlatformEnv, user: User): Promise<Response> {
  const input = await body(request);
  const type = String(input.type ?? '') as ItemType;
  const title = String(input.title ?? '').trim();
  const text = String(input.body ?? '').trim();
  const groupId = input.groupId ? String(input.groupId) : null;
  const visibility = String(input.visibility ?? (groupId ? 'group' : 'private')) as Visibility;
  if (!ITEM_TYPES.has(type) || title.length < 1 || title.length > 120 || text.length > 5000 || !VISIBILITIES.has(visibility)) return json({ ok:false, message:'Check the content item fields.' },400);
  if (groupId && !await canUseGroup(env,user,groupId,type==='announcement')) return json({ ok:false, message:type==='announcement'?'Administrator access is required to publish group announcements.':'Group access required.' },403);
  if (visibility === 'group' && !groupId) return json({ ok:false, message:'Choose a group for group-visible content.' },400);
  const id = crypto.randomUUID(), created = now();
  await env.DB.prepare(`
    INSERT INTO content_items(id,owner_user_id,group_id,item_type,title,body,data_json,visibility,starts_at,ends_at,pinned,sort_order,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(id,user.id,groupId,type,title,text,JSON.stringify(cleanData(input.data)),visibility,parseTimestamp(input.startsAt),parseTimestamp(input.endsAt),input.pinned===true?1:0,Number.isInteger(Number(input.sortOrder))?Number(input.sortOrder):0,created,created).run();
  if (groupId && ['post','announcement'].includes(type)) await notifyGroup(env,groupId,user.id,`group.${type}`,title,text.slice(0,180),'/hub#announcements',{itemId:id});
  const row = await env.DB.prepare(`SELECT i.*,u.username owner_username,u.display_name owner_display_name,g.name group_name FROM content_items i JOIN users u ON u.id=i.owner_user_id LEFT JOIN groups g ON g.id=i.group_id WHERE i.id=?`).bind(id).first<ItemRow>();
  return json({ ok:true, item:itemJson(row!,user) },201);
}
async function getOwnedItem(env: PlatformEnv, user: User, id: string): Promise<ItemRow|null> {
  return env.DB.prepare(`SELECT * FROM content_items WHERE id=? AND (owner_user_id=? OR ?=1)`).bind(id,user.id,user.isAdmin?1:0).first<ItemRow>();
}
async function updateItem(request: Request, env: PlatformEnv, user: User, id: string): Promise<Response> {
  const existing = await getOwnedItem(env,user,id);
  if (!existing) return json({ ok:false, message:'Content item not found.' },404);
  const input = await body(request);
  const title = String(input.title ?? existing.title).trim(), text = String(input.body ?? existing.body).trim();
  const groupId = input.groupId === undefined ? existing.group_id : input.groupId ? String(input.groupId) : null;
  const visibility = String(input.visibility ?? existing.visibility) as Visibility;
  if (!title || title.length>120 || text.length>5000 || !VISIBILITIES.has(visibility)) return json({ ok:false, message:'Check the content item fields.' },400);
  if (groupId && !await canUseGroup(env,user,groupId,existing.item_type==='announcement')) return json({ ok:false, message:'Group access required.' },403);
  await env.DB.prepare(`UPDATE content_items SET group_id=?,title=?,body=?,data_json=?,visibility=?,starts_at=?,ends_at=?,completed_at=?,pinned=?,sort_order=?,updated_at=? WHERE id=?`)
    .bind(groupId,title,text,JSON.stringify(input.data===undefined?safeJson(existing.data_json):cleanData(input.data)),visibility,
      input.startsAt===undefined?existing.starts_at:parseTimestamp(input.startsAt),input.endsAt===undefined?existing.ends_at:parseTimestamp(input.endsAt),
      input.completed===true?(existing.completed_at??now()):input.completed===false?null:existing.completed_at,input.pinned===undefined?existing.pinned:input.pinned===true?1:0,
      Number.isInteger(Number(input.sortOrder))?Number(input.sortOrder):existing.sort_order,now(),id).run();
  const row = await env.DB.prepare(`SELECT i.*,u.username owner_username,u.display_name owner_display_name,g.name group_name FROM content_items i JOIN users u ON u.id=i.owner_user_id LEFT JOIN groups g ON g.id=i.group_id WHERE i.id=?`).bind(id).first<ItemRow>();
  return json({ ok:true, item:itemJson(row!,user) });
}
async function deleteItem(env: PlatformEnv, user: User, id: string): Promise<Response> {
  const existing = await getOwnedItem(env,user,id);
  if (!existing) return json({ ok:false, message:'Content item not found.' },404);
  await env.DB.prepare(`DELETE FROM content_items WHERE id=?`).bind(id).run();
  return json({ ok:true });
}

async function presencePayload(env: PlatformEnv, userId: string) {
  const row = await env.DB.prepare(`SELECT availability,status_text,activity_type,activity_text,expires_at,updated_at FROM user_presence WHERE user_id=?`).bind(userId).first<{availability:string;status_text:string;activity_type:string;activity_text:string;expires_at:number|null;updated_at:number}>();
  const expired = row?.expires_at && row.expires_at <= now();
  return row && !expired ? { availability:row.availability,statusText:row.status_text,activityType:row.activity_type,activityText:row.activity_text,expiresAt:row.expires_at,updatedAt:row.updated_at } : { availability:'offline',statusText:'',activityType:'none',activityText:'',expiresAt:null,updatedAt:null };
}
async function updatePresence(request: Request, env: PlatformEnv, user: User): Promise<Response> {
  const input = await body(request), availability=String(input.availability??'online'), activityType=String(input.activityType??'none');
  if (!['online','away','busy','offline'].includes(availability)||!['none','playing','listening','watching','working'].includes(activityType)) return json({ok:false,message:'Choose a valid presence status.'},400);
  const updated=now();
  await env.DB.prepare(`INSERT INTO user_presence(user_id,availability,status_text,activity_type,activity_text,expires_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET availability=excluded.availability,status_text=excluded.status_text,activity_type=excluded.activity_type,activity_text=excluded.activity_text,expires_at=excluded.expires_at,updated_at=excluded.updated_at`)
    .bind(user.id,availability,String(input.statusText??'').trim().slice(0,160),activityType,String(input.activityText??'').trim().slice(0,160),parseTimestamp(input.expiresAt),updated).run();
  return json({ok:true,presence:await presencePayload(env,user.id)});
}

async function notificationPayload(env: PlatformEnv, user: User): Promise<Response> {
  const rows=await env.DB.prepare(`SELECT n.*,u.username actor_username,u.display_name actor_display_name FROM notifications n LEFT JOIN users u ON u.id=n.actor_user_id WHERE n.recipient_user_id=? ORDER BY n.created_at DESC LIMIT 100`).bind(user.id).all<{id:string;actor_user_id:string|null;notification_type:string;title:string;body:string;target_url:string|null;metadata_json:string;read_at:number|null;created_at:number;actor_username:string|null;actor_display_name:string|null}>();
  const preferences=await env.DB.prepare(`SELECT guestbook,reactions,group_posts,reminders,mentions FROM notification_preferences WHERE user_id=?`).bind(user.id).first<Record<string,number>>();
  return json({ok:true,unread:rows.results.filter(row=>!row.read_at).length,notifications:rows.results.map(row=>({id:row.id,type:row.notification_type,title:row.title,body:row.body,targetUrl:row.target_url,metadata:safeJson(row.metadata_json),readAt:row.read_at,createdAt:row.created_at,actor:row.actor_user_id?{id:row.actor_user_id,username:row.actor_username,displayName:row.actor_display_name}:null})),preferences:{guestbook:preferences?Boolean(preferences.guestbook):true,reactions:preferences?Boolean(preferences.reactions):true,groupPosts:preferences?Boolean(preferences.group_posts):true,reminders:preferences?Boolean(preferences.reminders):true,mentions:preferences?Boolean(preferences.mentions):true}});
}
async function updateNotifications(request: Request, env: PlatformEnv, user: User): Promise<Response> {
  const input=await body(request),action=String(input.action??'');
  if(action==='read-all') await env.DB.prepare(`UPDATE notifications SET read_at=? WHERE recipient_user_id=? AND read_at IS NULL`).bind(now(),user.id).run();
  else if(action==='read'&&UUID_RE.test(String(input.id??''))) await env.DB.prepare(`UPDATE notifications SET read_at=? WHERE id=? AND recipient_user_id=?`).bind(now(),String(input.id),user.id).run();
  else if(action==='delete'&&UUID_RE.test(String(input.id??''))) await env.DB.prepare(`DELETE FROM notifications WHERE id=? AND recipient_user_id=?`).bind(String(input.id),user.id).run();
  else if(action==='preferences') await env.DB.prepare(`INSERT INTO notification_preferences(user_id,guestbook,reactions,group_posts,reminders,mentions,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET guestbook=excluded.guestbook,reactions=excluded.reactions,group_posts=excluded.group_posts,reminders=excluded.reminders,mentions=excluded.mentions,updated_at=excluded.updated_at`).bind(user.id,input.guestbook===false?0:1,input.reactions===false?0:1,input.groupPosts===false?0:1,input.reminders===false?0:1,input.mentions===false?0:1,now()).run();
  else return json({ok:false,message:'Choose a valid notification action.'},400);
  return notificationPayload(env,user);
}

function normalizedLayout(value: unknown): {json:string;layout:Layout}|null {
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const raw=value as Record<string,unknown>,rawTiles=Array.isArray(raw.tiles)?raw.tiles:[];
  if(rawTiles.length>MAX_TILES)return null;
  const tiles:Record<string,unknown>[]=[];
  for(const candidate of rawTiles){
    if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return null;
    const tile=candidate as Record<string,unknown>,featureId=String(tile.featureId??''),x=Number(tile.x),y=Number(tile.y),width=Number(tile.width),height=Number(tile.height);
    if(!featureId||![x,y,width,height].every(Number.isInteger)||x<0||y<0||width<1||height<1||x+width>8||width>8||height>6||y>300)return null;
    const clean:Record<string,unknown>={featureId,x,y,width,height};
    for(const field of SAFE_TILE_FIELDS){const val=tile[field];if(val===null||['string','number','boolean'].includes(typeof val))clean[field]=val;}
    tiles.push(clean);
  }
  const preferences=raw.preferences&&typeof raw.preferences==='object'&&!Array.isArray(raw.preferences)?raw.preferences as Record<string,unknown>:{};
  const layout={tiles,preferences},serialized=JSON.stringify(layout);
  return encoder.encode(serialized).byteLength<=MAX_LAYOUT_BYTES?{json:serialized,layout}:null;
}
async function pagePermission(env: PlatformEnv,user:User,pageKey:string,required:'view'|'edit'|'manage'='view'):Promise<boolean>{
  if(pageKey==='home')return true;
  const page=await env.DB.prepare(`SELECT owner_user_id,group_id FROM dashboard_pages WHERE id=?`).bind(pageKey).first<{owner_user_id:string|null;group_id:string|null}>();
  if(!page)return false;
  if(page.owner_user_id===user.id||user.isAdmin)return true;
  const collaborator=await env.DB.prepare(`SELECT permission FROM dashboard_page_collaborators WHERE page_id=? AND user_id=?`).bind(pageKey,user.id).first<{permission:string}>();
  const rank={view:1,edit:2,manage:3};
  if(collaborator&&rank[collaborator.permission as keyof typeof rank]>=rank[required])return true;
  return required==='view'&&Boolean(page.group_id&&await env.DB.prepare(`SELECT 1 ok FROM group_memberships WHERE group_id=? AND user_id=?`).bind(page.group_id,user.id).first());
}
async function deviceLayouts(env:PlatformEnv,user:User,pageKey:string):Promise<Response>{
  if(!PAGE_RE.test(pageKey)||!await pagePermission(env,user,pageKey,'view'))return json({ok:false,message:'Dashboard page not found.'},404);
  const rows=await env.DB.prepare(`SELECT device_mode,layout_json,updated_at FROM dashboard_device_layouts WHERE user_id=? AND page_key=?`).bind(user.id,pageKey).all<{device_mode:string;layout_json:string;updated_at:number}>();
  return json({ok:true,pageKey,layouts:Object.fromEntries(rows.results.map(row=>[row.device_mode,{layout:JSON.parse(row.layout_json),updatedAt:row.updated_at}]))});
}
async function saveDeviceLayout(request:Request,env:PlatformEnv,user:User,pageKey:string,mode:string):Promise<Response>{
  if(!PAGE_RE.test(pageKey)||!MODES.has(mode)||!await pagePermission(env,user,pageKey,'edit'))return json({ok:false,message:'You cannot edit this dashboard page.'},403);
  const input=await body(request),normalized=normalizedLayout(input.layout);
  if(!normalized)return json({ok:false,message:'The dashboard layout is invalid.'},400);
  const updated=now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO dashboard_device_layouts(user_id,page_key,device_mode,layout_json,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,page_key,device_mode) DO UPDATE SET layout_json=excluded.layout_json,updated_at=excluded.updated_at`).bind(user.id,pageKey,mode,normalized.json,updated),
    env.DB.prepare(`DELETE FROM dashboard_layout_drafts WHERE user_id=? AND page_key=? AND device_mode=?`).bind(user.id,pageKey,mode)
  ]);
  return deviceLayouts(env,user,pageKey);
}
async function draftRoute(request:Request,env:PlatformEnv,user:User,pageKey:string,mode:string):Promise<Response>{
  if(!PAGE_RE.test(pageKey)||!MODES.has(mode)||!await pagePermission(env,user,pageKey,'edit'))return json({ok:false,message:'You cannot edit this dashboard page.'},403);
  if(request.method==='GET'){
    const row=await env.DB.prepare(`SELECT layout_json,updated_at FROM dashboard_layout_drafts WHERE user_id=? AND page_key=? AND device_mode=?`).bind(user.id,pageKey,mode).first<{layout_json:string;updated_at:number}>();
    return json({ok:true,draft:row?{layout:JSON.parse(row.layout_json),updatedAt:row.updated_at}:null});
  }
  if(request.method==='DELETE'){await env.DB.prepare(`DELETE FROM dashboard_layout_drafts WHERE user_id=? AND page_key=? AND device_mode=?`).bind(user.id,pageKey,mode).run();return json({ok:true});}
  const input=await body(request),normalized=normalizedLayout(input.layout);if(!normalized)return json({ok:false,message:'The dashboard draft is invalid.'},400);
  await env.DB.prepare(`INSERT INTO dashboard_layout_drafts(user_id,page_key,device_mode,layout_json,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,page_key,device_mode) DO UPDATE SET layout_json=excluded.layout_json,updated_at=excluded.updated_at`).bind(user.id,pageKey,mode,normalized.json,now()).run();
  return json({ok:true,draft:{layout:normalized.layout,updatedAt:now()}});
}
async function versionRoute(request:Request,env:PlatformEnv,user:User,pageKey:string,mode:string):Promise<Response>{
  if(!PAGE_RE.test(pageKey)||!MODES.has(mode)||!await pagePermission(env,user,pageKey,'edit'))return json({ok:false,message:'You cannot edit this dashboard page.'},403);
  if(request.method==='GET'){
    const rows=await env.DB.prepare(`SELECT id,version_name,created_at,layout_json FROM dashboard_layout_versions WHERE user_id=? AND page_key=? AND device_mode=? ORDER BY created_at DESC LIMIT 30`).bind(user.id,pageKey,mode).all<{id:string;version_name:string;created_at:number;layout_json:string}>();
    return json({ok:true,versions:rows.results.map(row=>({id:row.id,name:row.version_name,createdAt:row.created_at,layout:JSON.parse(row.layout_json)}))});
  }
  const input=await body(request),normalized=normalizedLayout(input.layout);if(!normalized)return json({ok:false,message:'The dashboard version is invalid.'},400);
  const id=crypto.randomUUID();await env.DB.prepare(`INSERT INTO dashboard_layout_versions(id,user_id,page_key,device_mode,version_name,layout_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(id,user.id,pageKey,mode,String(input.name??'Saved layout').trim().slice(0,80)||'Saved layout',normalized.json,now()).run();
  return versionRoute(new Request(request.url,{method:'GET',headers:request.headers}),env,user,pageKey,mode);
}
async function restoreVersion(request:Request,env:PlatformEnv,user:User,versionId:string):Promise<Response>{
  const row=await env.DB.prepare(`SELECT page_key,device_mode,layout_json FROM dashboard_layout_versions WHERE id=? AND user_id=?`).bind(versionId,user.id).first<{page_key:string;device_mode:string;layout_json:string}>();
  if(!row)return json({ok:false,message:'Layout version not found.'},404);
  await env.DB.prepare(`INSERT INTO dashboard_device_layouts(user_id,page_key,device_mode,layout_json,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,page_key,device_mode) DO UPDATE SET layout_json=excluded.layout_json,updated_at=excluded.updated_at`).bind(user.id,row.page_key,row.device_mode,row.layout_json,now()).run();
  return json({ok:true,pageKey:row.page_key,mode:row.device_mode,layout:JSON.parse(row.layout_json)});
}
async function collaborators(request:Request,env:PlatformEnv,user:User,pageId:string):Promise<Response>{
  if(!await pagePermission(env,user,pageId,'manage'))return json({ok:false,message:'Page manager access required.'},403);
  if(request.method==='PUT'){
    const input=await body(request),entries=Array.isArray(input.collaborators)?input.collaborators:[];
    if(entries.length>100)return json({ok:false,message:'Too many collaborators.'},400);
    const statements:D1Statement[]=[env.DB.prepare(`DELETE FROM dashboard_page_collaborators WHERE page_id=?`).bind(pageId)];
    for(const entry of entries){if(!entry||typeof entry!=='object'||Array.isArray(entry))continue;const candidate=entry as Record<string,unknown>,userId=String(candidate.userId??''),permission=String(candidate.permission??'edit');if(!UUID_RE.test(userId)||!['view','edit','manage'].includes(permission))continue;statements.push(env.DB.prepare(`INSERT INTO dashboard_page_collaborators(page_id,user_id,permission,assigned_by,assigned_at) VALUES(?,?,?,?,?)`).bind(pageId,userId,permission,user.id,now()));}
    await env.DB.batch(statements);
  }
  const rows=await env.DB.prepare(`SELECT c.user_id,c.permission,u.username,u.display_name FROM dashboard_page_collaborators c JOIN users u ON u.id=c.user_id WHERE c.page_id=? ORDER BY u.display_name`).bind(pageId).all<{user_id:string;permission:string;username:string;display_name:string}>();
  return json({ok:true,collaborators:rows.results.map(row=>({userId:row.user_id,permission:row.permission,username:row.username,displayName:row.display_name}))});
}

async function searchUsers(request:Request,env:PlatformEnv,user:User):Promise<Response>{
  const raw=new URL(request.url).searchParams.get('q')??'';
  const query=raw.trim().replace(/[^A-Za-z0-9@._ -]/g,'').replace(/^@/,'').slice(0,60);
  if(query.length<2)return json({ok:false,message:'Enter at least two characters.'},400);
  const like=`%${query}%`;
  const rows=await env.DB.prepare(`SELECT u.id,u.username,u.display_name,u.is_verified,p.avatar_media,COALESCE(up.level,1) level FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN user_progression up ON up.user_id=u.id WHERE u.status='active' AND u.id<>? AND (u.username LIKE ? COLLATE NOCASE OR u.display_name LIKE ? COLLATE NOCASE) ORDER BY u.display_name LIMIT 20`).bind(user.id,like,like).all<{id:string;username:string;display_name:string;is_verified:number;avatar_media:string|null;level:number}>();
  return json({ok:true,users:rows.results.map(row=>({id:row.id,username:row.username,displayName:row.display_name,isVerified:Boolean(row.is_verified),avatarMedia:row.avatar_media,level:Number(row.level??1)}))});
}

async function modulePayload(env:PlatformEnv,user:User,ownerId=user.id):Promise<Response>{
  const groups=await userGroups(env,user.id),params:[unknown,...unknown[]]=[ownerId,user.id,user.isVerified?1:0,user.id];
  const rows=await env.DB.prepare(`SELECT i.*,u.username owner_username,u.display_name owner_display_name,g.name group_name FROM content_items i JOIN users u ON u.id=i.owner_user_id LEFT JOIN groups g ON g.id=i.group_id WHERE i.owner_user_id=? AND (i.owner_user_id=? OR i.visibility='account' OR(i.visibility='verified' AND ?=1) OR(i.visibility='group' AND EXISTS(SELECT 1 FROM group_memberships gm WHERE gm.group_id=i.group_id AND gm.user_id=?))) ORDER BY i.pinned DESC,i.starts_at,i.updated_at DESC LIMIT 300`).bind(...params).all<ItemRow>();
  const items=rows.results.map(row=>itemJson(row,user));
  const byType=Object.fromEntries([...ITEM_TYPES].map(type=>[type,items.filter(item=>item.type===type)]));
  const groupAnnouncements=await env.DB.prepare(`SELECT i.*,u.username owner_username,u.display_name owner_display_name,g.name group_name FROM content_items i JOIN users u ON u.id=i.owner_user_id JOIN groups g ON g.id=i.group_id WHERE i.item_type IN('announcement','post') AND (i.owner_user_id=? OR i.visibility='account' OR (i.visibility='verified' AND ?=1) OR (i.visibility='group' AND EXISTS(SELECT 1 FROM group_memberships gm WHERE gm.group_id=i.group_id AND gm.user_id=?))) ORDER BY i.pinned DESC,i.updated_at DESC LIMIT 50`).bind(user.id,user.isVerified?1:0,user.id).all<ItemRow>();
  const notifications=await env.DB.prepare(`SELECT id,notification_type,title,body,target_url,read_at,created_at FROM notifications WHERE recipient_user_id=? ORDER BY created_at DESC LIMIT 20`).bind(user.id).all<{id:string;notification_type:string;title:string;body:string;target_url:string|null;read_at:number|null;created_at:number}>();
  return json({ok:true,generatedAt:now(),presence:await presencePayload(env,ownerId),items,byType,groupAnnouncements:groupAnnouncements.results.map(row=>itemJson(row,user)),notifications:notifications.results.map(row=>({id:row.id,type:row.notification_type,title:row.title,body:row.body,targetUrl:row.target_url,readAt:row.read_at,createdAt:row.created_at})),unreadNotifications:notifications.results.filter(row=>!row.read_at).length,groups:[...groups]});
}

async function recordVisit(env:PlatformEnv,user:User,profileId:string):Promise<Response>{
  if(!UUID_RE.test(profileId))return json({ok:false,message:'Profile not found.'},404);
  if(profileId!==user.id&&!await env.DB.prepare(`SELECT 1 ok FROM profile_blocks WHERE owner_user_id=? AND blocked_user_id=?`).bind(profileId,user.id).first())await env.DB.prepare(`INSERT INTO profile_visits(profile_user_id,visitor_user_id,visited_at) VALUES(?,?,?) ON CONFLICT(profile_user_id,visitor_user_id) DO UPDATE SET visited_at=excluded.visited_at`).bind(profileId,user.id,now()).run();
  return json({ok:true});
}
async function communitySettings(request:Request,env:PlatformEnv,user:User,profileId:string):Promise<Response>{
  if(!UUID_RE.test(profileId))return json({ok:false,message:'Profile not found.'},404);
  if(request.method==='POST'){
    const input=await body(request),action=String(input.action??'');
    if(action==='subscribe')await env.DB.prepare(`INSERT OR IGNORE INTO profile_subscriptions(profile_user_id,subscriber_user_id,created_at) VALUES(?,?,?)`).bind(profileId,user.id,now()).run();
    else if(action==='unsubscribe')await env.DB.prepare(`DELETE FROM profile_subscriptions WHERE profile_user_id=? AND subscriber_user_id=?`).bind(profileId,user.id).run();
    else if(action==='block'&&profileId===user.id&&UUID_RE.test(String(input.userId??'')))await env.DB.prepare(`INSERT OR IGNORE INTO profile_blocks(owner_user_id,blocked_user_id,created_at) VALUES(?,?,?)`).bind(user.id,String(input.userId),now()).run();
    else if(action==='unblock'&&profileId===user.id&&UUID_RE.test(String(input.userId??'')))await env.DB.prepare(`DELETE FROM profile_blocks WHERE owner_user_id=? AND blocked_user_id=?`).bind(user.id,String(input.userId)).run();
    else return json({ok:false,message:'Choose a valid community action.'},400);
  }
  const [subscribed,subscribers,visits,blocked]=await Promise.all([
    env.DB.prepare(`SELECT 1 ok FROM profile_subscriptions WHERE profile_user_id=? AND subscriber_user_id=?`).bind(profileId,user.id).first(),
    env.DB.prepare(`SELECT COUNT(*) count FROM profile_subscriptions WHERE profile_user_id=?`).bind(profileId).first<{count:number}>(),
    profileId===user.id?env.DB.prepare(`SELECT v.visitor_user_id,u.username,u.display_name,v.visited_at FROM profile_visits v JOIN users u ON u.id=v.visitor_user_id WHERE v.profile_user_id=? ORDER BY v.visited_at DESC LIMIT 30`).bind(profileId).all<{visitor_user_id:string;username:string;display_name:string;visited_at:number}>():Promise.resolve({results:[]}),
    profileId===user.id?env.DB.prepare(`SELECT b.blocked_user_id,u.username,u.display_name FROM profile_blocks b JOIN users u ON u.id=b.blocked_user_id WHERE b.owner_user_id=? ORDER BY u.display_name`).bind(profileId).all<{blocked_user_id:string;username:string;display_name:string}>():Promise.resolve({results:[]})
  ]);
  return json({ok:true,subscribed:Boolean(subscribed),subscriberCount:Number(subscribers?.count??0),recentVisitors:visits.results.map(row=>({id:row.visitor_user_id,username:row.username,displayName:row.display_name,visitedAt:row.visited_at})),blockedUsers:blocked.results.map(row=>({id:row.blocked_user_id,username:row.username,displayName:row.display_name}))});
}
async function guestbookExtended(request:Request,env:PlatformEnv,user:User,entryId:string):Promise<Response>{
  const entry=await env.DB.prepare(`SELECT id,profile_user_id,author_user_id,message,deleted_at FROM profile_guestbook_entries WHERE id=?`).bind(entryId).first<{id:string;profile_user_id:string;author_user_id:string;message:string;deleted_at:number|null}>();
  if(!entry||entry.deleted_at)return json({ok:false,message:'Guestbook entry not found.'},404);
  const input=await body(request),action=String(input.action??'');
  if(action==='edit'){
    if(entry.author_user_id!==user.id)return json({ok:false,message:'Only the author can edit this message.'},403);
    const message=String(input.message??'').trim();if(!message||message.length>500)return json({ok:false,message:'Messages must be 1–500 characters.'},400);
    await env.DB.prepare(`UPDATE profile_guestbook_entries SET message=?,updated_at=? WHERE id=?`).bind(message,now(),entryId).run();
  }else if(action==='pin'){
    if(entry.profile_user_id!==user.id&&!user.isAdmin)return json({ok:false,message:'Only the profile owner can pin messages.'},403);
    await env.DB.prepare(`UPDATE profile_guestbook_entries SET is_pinned=? WHERE id=?`).bind(input.pinned===false?0:1,entryId).run();
  }else if(action==='report'){
    await env.DB.prepare(`INSERT OR IGNORE INTO profile_guestbook_reports(entry_id,reporter_user_id,reason,created_at) VALUES(?,?,?,?)`).bind(entryId,user.id,String(input.reason??'').trim().slice(0,300),now()).run();
    await notify(env,entry.profile_user_id,user.id,'guestbook.report','Guestbook message reported','A guestbook message on your profile was reported.','/profile#guestbook',{entryId});
  }else return json({ok:false,message:'Choose a valid guestbook action.'},400);
  return json({ok:true});
}
async function replyGuestbook(request:Request,env:PlatformEnv,user:User,profileId:string):Promise<Response>{
  const input=await body(request),parentId=String(input.parentId??''),message=String(input.message??'').trim();
  if(!UUID_RE.test(profileId)||!UUID_RE.test(parentId)||!message||message.length>500)return json({ok:false,message:'Check the reply fields.'},400);
  const parent=await env.DB.prepare(`SELECT author_user_id FROM profile_guestbook_entries WHERE id=? AND profile_user_id=? AND deleted_at IS NULL`).bind(parentId,profileId).first<{author_user_id:string}>();
  if(!parent)return json({ok:false,message:'Guestbook message not found.'},404);
  const id=crypto.randomUUID(),created=now();await env.DB.prepare(`INSERT INTO profile_guestbook_entries(id,profile_user_id,author_user_id,message,created_at,parent_id,updated_at) VALUES(?,?,?,?,?,?,?)`).bind(id,profileId,user.id,message,created,parentId,created).run();
  await notify(env,parent.author_user_id,user.id,'guestbook.reply','New guestbook reply',message.slice(0,180),`/profile/${profileId}#guestbook`,{entryId:id,parentId});
  return json({ok:true,id});
}

export async function handlePlatformRequest(request:Request,env:PlatformEnv):Promise<Response|null>{
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/platform/')&&!path.startsWith('/api/dashboard/layouts/')&&!path.startsWith('/api/dashboard/drafts/')&&!path.startsWith('/api/dashboard/versions/')&&!path.startsWith('/api/dashboard/collaborators/')&&!path.startsWith('/api/community/'))return null;
  const user=await getUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},401);
  if(request.method!=='GET'&&!sameOrigin(request))return json({ok:false,message:'Origin rejected.'},403);

  if(path==='/api/platform/users'&&request.method==='GET')return searchUsers(request,env,user);
  if(path==='/api/platform/items'&&request.method==='GET')return listItems(request,env,user);
  if(path==='/api/platform/items'&&request.method==='POST')return createItem(request,env,user);
  const item=path.match(/^\/api\/platform\/items\/([0-9a-f-]{36})$/i);if(item&&request.method==='PUT')return updateItem(request,env,user,item[1]!);if(item&&request.method==='DELETE')return deleteItem(env,user,item[1]!);
  if(path==='/api/platform/presence'&&request.method==='GET')return json({ok:true,presence:await presencePayload(env,user.id)});
  if(path==='/api/platform/presence'&&request.method==='PUT')return updatePresence(request,env,user);
  const profileModules=path.match(/^\/api\/platform\/profiles\/([0-9a-f-]{36})\/modules$/i);if(profileModules&&request.method==='GET')return modulePayload(env,user,profileModules[1]!);
  if(path==='/api/platform/modules'&&request.method==='GET')return modulePayload(env,user);
  if(path==='/api/platform/notifications'&&request.method==='GET')return notificationPayload(env,user);
  if(path==='/api/platform/notifications'&&request.method==='POST')return updateNotifications(request,env,user);

  const layouts=path.match(/^\/api\/dashboard\/layouts\/(home|page-[0-9a-f-]{36})$/i);if(layouts&&request.method==='GET')return deviceLayouts(env,user,layouts[1]!);
  const saveLayout=path.match(/^\/api\/dashboard\/layouts\/(home|page-[0-9a-f-]{36})\/(desktop|mobile)$/i);if(saveLayout&&request.method==='PUT')return saveDeviceLayout(request,env,user,saveLayout[1]!,saveLayout[2]!);
  const draft=path.match(/^\/api\/dashboard\/drafts\/(home|page-[0-9a-f-]{36})\/(desktop|mobile)$/i);if(draft&&['GET','PUT','DELETE'].includes(request.method))return draftRoute(request,env,user,draft[1]!,draft[2]!);
  const versions=path.match(/^\/api\/dashboard\/versions\/(home|page-[0-9a-f-]{36})\/(desktop|mobile)$/i);if(versions&&['GET','POST'].includes(request.method))return versionRoute(request,env,user,versions[1]!,versions[2]!);
  const restore=path.match(/^\/api\/dashboard\/versions\/([0-9a-f-]{36})\/restore$/i);if(restore&&request.method==='POST')return restoreVersion(request,env,user,restore[1]!);
  const collaborator=path.match(/^\/api\/dashboard\/collaborators\/(page-[0-9a-f-]{36})$/i);if(collaborator&&['GET','PUT'].includes(request.method))return collaborators(request,env,user,collaborator[1]!);

  const visit=path.match(/^\/api\/community\/profiles\/([0-9a-f-]{36})\/visit$/i);if(visit&&request.method==='POST')return recordVisit(env,user,visit[1]!);
  const settings=path.match(/^\/api\/community\/profiles\/([0-9a-f-]{36})$/i);if(settings&&['GET','POST'].includes(request.method))return communitySettings(request,env,user,settings[1]!);
  const reply=path.match(/^\/api\/community\/profiles\/([0-9a-f-]{36})\/guestbook\/reply$/i);if(reply&&request.method==='POST')return replyGuestbook(request,env,user,reply[1]!);
  const guestbook=path.match(/^\/api\/community\/guestbook\/([0-9a-f-]{36})$/i);if(guestbook&&request.method==='POST')return guestbookExtended(request,env,user,guestbook[1]!);
  return null;
}
