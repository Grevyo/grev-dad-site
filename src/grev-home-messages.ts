import { getDeviceContext, type GrevHomeEnv } from './grev-home';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
type Db = Pick<GrevHomeEnv['DB'], 'prepare' | 'batch'>;

// Always use both directions of the block relationship, including for old conversations.
export async function canMessage(db: Db, actor: string, other: string): Promise<boolean> {
  if (!UUID.test(other) || actor === other) return false;
  const [low, high] = [actor, other].sort();
  const row = await db.prepare(`SELECT 1 ok FROM grev_home_friendships f
    JOIN users u ON u.id=? AND u.status='active'
    WHERE f.user_low_id=? AND f.user_high_id=? AND NOT EXISTS (
      SELECT 1 FROM profile_blocks WHERE (owner_user_id=? AND blocked_user_id=?)
      OR (owner_user_id=? AND blocked_user_id=?))`)
    .bind(other, low, high, actor, other, other, actor).first();
  return Boolean(row);
}

export async function directRoom(db: Db, actor: string, other: string): Promise<string> {
  const existing = await db.prepare(`SELECT r.id FROM chat_rooms r
    JOIN chat_members a ON a.room_id=r.id AND a.user_id=?
    JOIN chat_members b ON b.room_id=r.id AND b.user_id=?
    WHERE r.room_type='direct' ORDER BY r.created_at,r.id LIMIT 1`)
    .bind(actor, other).first<{id:string}>();
  if (existing) return existing.id;
  // A stable pair ID makes simultaneous opens from two Grev Home devices idempotent.
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(`grev-direct:${[actor, other].sort().join(':')}`)));
  bytes[6] = (bytes[6]! & 15) | 80;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = Array.from(bytes.slice(0,16), b => b.toString(16).padStart(2,'0')).join('');
  const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  const now = Math.floor(Date.now()/1000);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO chat_rooms(id,room_type,title,created_by,created_at,updated_at)
      VALUES(?,'direct','',?,?,?)`).bind(id, actor, now, now),
    db.prepare(`INSERT OR IGNORE INTO chat_members(room_id,user_id,joined_at) VALUES(?,?,?)`).bind(id,actor,now),
    db.prepare(`INSERT OR IGNORE INTO chat_members(room_id,user_id,joined_at) VALUES(?,?,?)`).bind(id,other,now)
  ]);
  return id;
}

export async function handleGrevHomeMessages(request: Request, env: GrevHomeEnv): Promise<Response|null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/grev-home/messages')) return null;
  const context = await getDeviceContext(request, env);
  if (!context) return json({ok:false,message:'Link authentication required.'},401);
  const origin = request.headers.get('Origin');
  if (request.method !== 'GET' && origin && origin !== url.origin) return json({ok:false,message:'Origin rejected.'},403);
  const db = env.DB.withSession('first-primary');
  const actor = context.user.id;
  if (url.pathname === '/api/grev-home/messages' && request.method === 'GET') {
    const rows = await db.prepare(`SELECT r.id roomId,u.id userId,u.display_name displayName,
      (SELECT COUNT(*) FROM chat_messages m WHERE m.room_id=r.id AND m.sender_user_id<>?
        AND m.deleted_at IS NULL AND m.created_at>COALESCE(a.last_read_at,0)) unread
      FROM chat_rooms r JOIN chat_members a ON a.room_id=r.id AND a.user_id=?
      JOIN chat_members b ON b.room_id=r.id AND b.user_id<>a.user_id
      JOIN users u ON u.id=b.user_id WHERE r.room_type='direct'
      ORDER BY r.updated_at DESC,r.id LIMIT 100`).bind(actor,actor)
      .all<{roomId:string;userId:string;displayName:string;unread:number}>();
    const conversations = [];
    for (const row of rows.results) if (await canMessage(db,actor,row.userId)) conversations.push(row);
    return json({ok:true,conversations});
  }
  const match = url.pathname.match(/^\/api\/grev-home\/messages\/([0-9a-f-]{36})(\/read)?$/i);
  if (!match) return json({ok:false,message:'Unknown messaging route.'},404);
  const other = match[1]!;
  if (!await canMessage(db,actor,other)) return json({ok:false,message:'Messaging is only available between active, unblocked friends.'},403);
  if (!['GET','POST'].includes(request.method)) return json({ok:false,message:'Method not allowed.'},405);
  if (match[2] && request.method !== 'POST') return json({ok:false,message:'Method not allowed.'},405);
  const roomId = await directRoom(db,actor,other);
  if (request.method === 'GET') {
    const before = url.searchParams.get('before');
    if (before && !UUID.test(before)) return json({ok:false,message:'Invalid history cursor.'},400);
    const rows = await db.prepare(`SELECT id,sender_user_id senderUserId,body,created_at createdAt,message_type type
      FROM chat_messages WHERE room_id=? AND deleted_at IS NULL
      AND (? IS NULL OR (created_at,id)<(SELECT created_at,id FROM chat_messages WHERE id=? AND room_id=?))
      ORDER BY created_at DESC,id DESC LIMIT 51`).bind(roomId,before,before,roomId)
      .all<{id:string;senderUserId:string;body:string;createdAt:number;type:string}>();
    const page = rows.results.slice(0,50);
    return json({ok:true,roomId,messages:page.reverse(),hasMore:rows.results.length>50});
  }
  if (!(request.headers.get('Content-Type')??'').includes('application/json')) return json({ok:false,message:'JSON required.'},400);
  const raw = await request.text();
  if (raw.length>12000) return json({ok:false,message:'Message too large.'},413);
  let input: Record<string,unknown>;
  try { input = JSON.parse(raw); } catch { return json({ok:false,message:'Invalid JSON.'},400); }
  if (!input || typeof input!=='object' || Array.isArray(input)) return json({ok:false,message:'Invalid request.'},400);
  if (match[2]) {
    const lastId = String(input.messageId??'');
    if (!UUID.test(lastId)) return json({ok:false,message:'Invalid read marker.'},400);
    // Mark only the page the client actually displayed; never mark newly arriving messages read.
    await db.prepare(`UPDATE chat_members SET last_read_at=MAX(COALESCE(last_read_at,0),
      COALESCE((SELECT created_at FROM chat_messages WHERE id=? AND room_id=?),0))
      WHERE room_id=? AND user_id=?`).bind(lastId,roomId,roomId,actor).run();
    return json({ok:true});
  }
  const id = String(input.messageId??'');
  const body = typeof input.body==='string' ? input.body.trim() : '';
  if (!UUID.test(id) || !body || body.length>2000) return json({ok:false,message:'Provide a unique message ID and 1–2,000 characters.'},400);
  const previous = await db.prepare('SELECT room_id,sender_user_id,body FROM chat_messages WHERE id=?')
    .bind(id).first<{room_id:string;sender_user_id:string;body:string}>();
  if (previous) return previous.room_id===roomId && previous.sender_user_id===actor && previous.body===body
    ? json({ok:true,messageId:id}) : json({ok:false,message:'Message ID already used.'},409);
  const now = Math.floor(Date.now()/1000);
  const recent = await db.prepare('SELECT COUNT(*) count FROM chat_messages WHERE sender_user_id=? AND created_at>?')
    .bind(actor,now-60).first<{count:number}>();
  if ((recent?.count??0)>=20) return json({ok:false,message:'Please wait before sending more messages.'},429);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO chat_messages(id,room_id,sender_user_id,message_type,body,created_at)
      VALUES(?,?,?,'text',?,?)`).bind(id,roomId,actor,body,now),
    db.prepare('UPDATE chat_rooms SET updated_at=MAX(updated_at,?) WHERE id=?').bind(now,roomId),
    db.prepare(`INSERT OR IGNORE INTO notifications(id,recipient_user_id,actor_user_id,notification_type,title,body,target_url,metadata_json,created_at)
      SELECT ?,?,?,'chat.message',?,'New private message',?,?,? WHERE EXISTS(
        SELECT 1 FROM chat_messages WHERE id=? AND room_id=? AND sender_user_id=? AND body=?)`)
      .bind(`home-message-${id}`,other,actor,`New message from ${context.user.displayName}`,
        `/dashboard#chat-${roomId}`,JSON.stringify({roomId,messageId:id}),now,id,roomId,actor,body)
  ]);
  const stored = await db.prepare('SELECT room_id,sender_user_id,body FROM chat_messages WHERE id=?')
    .bind(id).first<{room_id:string;sender_user_id:string;body:string}>();
  if (!stored || stored.room_id!==roomId || stored.sender_user_id!==actor || stored.body!==body)
    return json({ok:false,message:'Message ID conflict.'},409);
  return json({ok:true,messageId:id},201);
}
