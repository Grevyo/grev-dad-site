import { getDeviceContext, type GrevHomeEnv } from './grev-home';
import { json } from './shared/http-security';

// Cloud saves (Grev Home docs/CLOUD_SAVES.md). Grev Home zips one app's save folder and PUTs it
// here; any device linked to the same grev.dad account can HEAD it (conflict check) or GET it
// back. Archives are opaque - the server never opens them - and live in R2. D1 holds the pointer
// to the current archive so an upload only becomes visible once it has fully landed.

const API_VERSION = 1;
const SAFE_APP_ID_RE = /^[A-Za-z0-9._-]{1,80}$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/i;
const CONTENT_HASH_HEADER = 'X-Grev-Content-SHA256';
const UPDATED_AT_HEADER = 'X-Grev-Updated-At';

// Cloudflare rejects request bodies over 100 MB on the Free and Pro plans before the Worker runs,
// so the limit sits just under that and is advertised through /capabilities for Grev Home to use.
export const CLOUD_SAVE_MAX_BYTES = 95 * 1024 * 1024;

export interface SaveObjectBody {
  body: ReadableStream;
  size: number;
}

export interface SaveBucket {
  put(key: string, value: ReadableStream | ArrayBuffer | Uint8Array, options?: {
    sha256?: string;
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }): Promise<unknown>;
  get(key: string): Promise<SaveObjectBody | null>;
  delete(key: string | string[]): Promise<void>;
}

export type GrevHomeSavesEnv = GrevHomeEnv & {
  GREV_HOME_SAVES?: SaveBucket;
};

type SaveRow = {
  object_key: string;
  sha256: string;
  size_bytes: number;
  updated_at_ms: number;
};

export function cloudSavesAvailable(env: GrevHomeSavesEnv): boolean {
  return Boolean(env.GREV_HOME_SAVES);
}

function saveHeaders(row: SaveRow, extra: Record<string, string> = {}): Headers {
  return new Headers({
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    [CONTENT_HASH_HEADER]: row.sha256.toUpperCase(),
    [UPDATED_AT_HEADER]: new Date(row.updated_at_ms).toISOString(),
    ...extra
  });
}

async function readSave(env: GrevHomeSavesEnv, userId: string, appId: string): Promise<SaveRow | null> {
  return env.DB.withSession('first-primary').prepare(`
    SELECT object_key,sha256,size_bytes,updated_at_ms FROM grev_home_cloud_saves
    WHERE user_id=? AND app_id=? COLLATE NOCASE
  `).bind(userId, appId).first<SaveRow>();
}

export async function handleGrevHomeSavesRequest(request: Request, env: GrevHomeSavesEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  const match = path.match(/^\/api\/grev-home\/saves\/([^/]+)$/);
  if (!match) return null;

  const appId = decodeURIComponent(match[1]!);
  if (!SAFE_APP_ID_RE.test(appId) || /^\.+$/.test(appId)) return json({ ok:false, apiVersion:API_VERSION, message:'Unknown app.' }, 400);
  if (!['GET','HEAD','PUT'].includes(request.method)) return json({ ok:false, message:'Method not allowed.' }, 405);

  const context = await getDeviceContext(request, env);
  if (!context) return json({ ok:false, message:'Grev Home link authentication required.' }, 401);

  const bucket = env.GREV_HOME_SAVES;
  if (!bucket) return json({ ok:false, apiVersion:API_VERSION, message:'Cloud saves are not enabled on this Grev.dad server.' }, 503);

  const userId = context.user.id;

  if (request.method === 'PUT') {
    const declaredHash = (request.headers.get(CONTENT_HASH_HEADER) ?? '').trim();
    if (!SHA256_HEX_RE.test(declaredHash)) {
      return json({ ok:false, apiVersion:API_VERSION, message:`${CONTENT_HASH_HEADER} must be the archive's SHA-256 in hex.` }, 400);
    }
    const length = Number(request.headers.get('Content-Length') ?? NaN);
    if (!Number.isSafeInteger(length) || length <= 0) {
      return json({ ok:false, apiVersion:API_VERSION, message:'A Content-Length is required for cloud save uploads.' }, 411);
    }
    if (length > CLOUD_SAVE_MAX_BYTES) {
      return json({ ok:false, apiVersion:API_VERSION, message:`Cloud saves are limited to ${Math.floor(CLOUD_SAVE_MAX_BYTES / 1024 / 1024)} MB.` }, 413);
    }
    if (!request.body) return json({ ok:false, apiVersion:API_VERSION, message:'The save archive is empty.' }, 400);

    const previous = await readSave(env, userId, appId);
    const objectKey = `saves/${userId}/${appId.toLowerCase()}/${crypto.randomUUID()}.zip`;
    try {
      // R2 verifies the SHA-256 itself and rejects the write on mismatch, so a truncated or
      // corrupted upload never becomes the current save.
      await bucket.put(objectKey, request.body, {
        sha256: declaredHash.toLowerCase(),
        httpMetadata: { contentType:'application/zip' },
        customMetadata: { userId, appId, grevId:context.grevId }
      });
    } catch (error) {
      console.warn('Cloud save upload rejected', error);
      return json({ ok:false, apiVersion:API_VERSION, message:'The uploaded save did not match its checksum. Nothing was replaced.' }, 400);
    }

    // Timestamps are strictly increasing per save so a device that last saw version N can always
    // tell that version N+1 is newer, even when two uploads land within the same millisecond.
    const updatedAtMs = Math.max(Date.now(), (previous?.updated_at_ms ?? 0) + 1);
    await env.DB.prepare(`
      INSERT INTO grev_home_cloud_saves(user_id,app_id,object_key,sha256,size_bytes,source_grev_id,updated_at_ms)
      VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(user_id,app_id) DO UPDATE SET
        object_key=excluded.object_key,sha256=excluded.sha256,size_bytes=excluded.size_bytes,
        source_grev_id=excluded.source_grev_id,updated_at_ms=excluded.updated_at_ms
    `).bind(userId, appId, objectKey, declaredHash.toLowerCase(), length, context.grevId, updatedAtMs).run();

    if (previous && previous.object_key !== objectKey) {
      try { await bucket.delete(previous.object_key); } catch (error) { console.warn('Old cloud save cleanup failed', error); }
    }

    const updatedAtUtc = new Date(updatedAtMs).toISOString();
    return new Response(JSON.stringify({ ok:true, apiVersion:API_VERSION, exists:true, sizeBytes:length, updatedAtUtc }), {
      status: 200,
      headers: saveHeaders({ object_key:objectKey, sha256:declaredHash, size_bytes:length, updated_at_ms:updatedAtMs }, {
        'Content-Type':'application/json; charset=utf-8'
      })
    });
  }

  const row = await readSave(env, userId, appId);
  if (!row) {
    return request.method === 'HEAD'
      ? new Response(null, { status:404, headers:{ 'Cache-Control':'no-store' } })
      : json({ ok:false, apiVersion:API_VERSION, exists:false, message:'No cloud save has been uploaded for this app yet.' }, 404);
  }

  const headers = saveHeaders(row, {
    'Content-Type':'application/zip',
    'Content-Length':String(row.size_bytes)
  });
  if (request.method === 'HEAD') return new Response(null, { status:200, headers });

  const object = await bucket.get(row.object_key);
  if (!object) {
    console.error('Cloud save index points at a missing archive', row.object_key);
    return json({ ok:false, apiVersion:API_VERSION, message:'The cloud save could not be read. Upload it again from a device that has it.' }, 500);
  }
  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { status:200, headers });
}
