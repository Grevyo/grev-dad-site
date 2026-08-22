import type { GrevHomeEnv } from './grev-home';

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BrowserUser = {
  id: string;
  username: string;
  displayName: string;
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY'
    }
  });
}

function parseCookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get('Cookie') ?? '')
    .split(';')
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      const index = value.indexOf('=');
      return index < 0 ? ['', ''] : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
    })
    .filter(([key]) => key));
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return btoa(String.fromCharCode(...digest)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}

async function browserUser(request: Request, env: GrevHomeEnv): Promise<BrowserUser | null> {
  const token = parseCookies(request)[COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(`
    SELECT u.id,u.username,u.display_name
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token), now()).first<{id:string;username:string;display_name:string}>();
  return row ? { id:row.id, username:row.username, displayName:row.display_name } : null;
}

export async function handleGrevHomeBrowserAccountRequest(
  request: Request,
  env: GrevHomeEnv
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const deviceMatch = path.match(/^\/api\/grev-home\/browser\/devices\/([0-9a-f-]{36})$/i);
  if (path !== '/api/grev-home/browser/link' && !deviceMatch) return null;

  const user = await browserUser(request, env);
  if (!user) return json({ ok:false, message:'Authentication required.' }, 401);

  if (deviceMatch) {
    if (request.method !== 'DELETE') return json({ ok:false, message:'Method not allowed.' }, 405);
    if (!sameOrigin(request)) return json({ ok:false, message:'Origin rejected.' }, 403);

    const tokenId = deviceMatch[1]!;
    if (!UUID_RE.test(tokenId)) return json({ ok:false, message:'Device not found.' }, 404);

    const device = await env.DB.prepare(`
      SELECT t.id,t.link_id,t.revoked_at,l.user_id
      FROM grev_home_tokens t JOIN grev_home_links l ON l.id=t.link_id
      WHERE t.id=? AND l.user_id=? AND l.revoked_at IS NULL
    `).bind(tokenId, user.id).first<{id:string;link_id:string;revoked_at:number|null;user_id:string}>();
    if (!device) return json({ ok:false, message:'Device not found.' }, 404);

    if (device.revoked_at === null) {
      await env.DB.prepare(`UPDATE grev_home_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL`)
        .bind(now(), tokenId).run();
    }
    return json({ ok:true, revoked:true, deviceId:tokenId });
  }

  if (request.method === 'GET') {
    const link = await env.DB.prepare(`
      SELECT id,grev_id,local_username,local_display_name,created_at,updated_at,last_seen_at
      FROM grev_home_links WHERE user_id=? AND revoked_at IS NULL
    `).bind(user.id).first<{
      id:string;grev_id:string;local_username:string;local_display_name:string;
      created_at:number;updated_at:number;last_seen_at:number|null;
    }>();
    if (!link) return json({ ok:true, linked:false, link:null, devices:[] });

    const devices = await env.DB.prepare(`
      SELECT id,device_name,created_at,last_used_at,expires_at
      FROM grev_home_tokens
      WHERE link_id=? AND revoked_at IS NULL AND expires_at>?
      ORDER BY COALESCE(last_used_at,created_at) DESC
    `).bind(link.id, now()).all<{
      id:string;device_name:string;created_at:number;last_used_at:number|null;expires_at:number;
    }>();

    return json({
      ok:true,
      linked:true,
      link:{
        id:link.id,
        grevId:link.grev_id,
        localUsername:link.local_username,
        localDisplayName:link.local_display_name,
        createdAt:link.created_at,
        updatedAt:link.updated_at,
        lastSeenAt:link.last_seen_at
      },
      devices:devices.results.map(device => ({
        id:device.id,
        deviceName:device.device_name,
        createdAt:device.created_at,
        lastUsedAt:device.last_used_at,
        expiresAt:device.expires_at
      }))
    });
  }

  if (request.method === 'DELETE') {
    if (!sameOrigin(request)) return json({ ok:false, message:'Origin rejected.' }, 403);
    const link = await env.DB.prepare(`SELECT id FROM grev_home_links WHERE user_id=? AND revoked_at IS NULL`)
      .bind(user.id).first<{id:string}>();
    if (!link) return json({ ok:true, linked:false });

    const current = now();
    await env.DB.batch([
      env.DB.prepare(`UPDATE grev_home_links SET revoked_at=?,updated_at=? WHERE id=?`).bind(current, current, link.id),
      env.DB.prepare(`UPDATE grev_home_tokens SET revoked_at=? WHERE link_id=? AND revoked_at IS NULL`).bind(current, link.id),
      env.DB.prepare(`UPDATE user_presence SET availability='offline',activity_type='none',activity_text='',expires_at=?,updated_at=? WHERE user_id=?`).bind(current, current, user.id)
    ]);
    return json({ ok:true, linked:false });
  }

  return json({ ok:false, message:'Method not allowed.' }, 405);
}
