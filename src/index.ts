interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database { prepare(query: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown[]>; }
interface Env { DB: D1Database; ASSETS: { fetch(request: Request): Promise<Response> }; APP_ENV: 'development' | 'pbe' | 'production'; }
type SessionUser = { id: string; username: string; displayName: string; isVerified: boolean; isOwner: boolean; isAdmin: boolean };
type ManagedUser = { id: string; username: string; display_name: string; email: string | null; status: string; is_verified: number; is_owner: number; is_admin: number; created_at: number };

const COOKIE = 'grev_session';
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function b64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
function unb64(value: string): Uint8Array<ArrayBuffer> { const padded=value.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(value.length/4)*4,'='); return Uint8Array.from(atob(padded), c=>c.charCodeAt(0)); }
async function sha256(value: string): Promise<string> { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
async function hashPassword(password: string, salt=crypto.getRandomValues(new Uint8Array(16)), iterations=310000) {
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations},key,256);
  return {salt:b64(salt),hash:b64(new Uint8Array(bits)),iterations};
}
async function verifyPassword(password:string,salt:string,expected:string,iterations:number):Promise<boolean>{
  const actual=await hashPassword(password,unb64(salt),iterations); const a=unb64(actual.hash),b=unb64(expected); if(a.length!==b.length)return false;
  let difference=0; for(let i=0;i<a.length;i++) difference|=a[i]!^b[i]!; return difference===0;
}
function parseCookies(request:Request):Record<string,string>{return Object.fromEntries((request.headers.get('Cookie')??'').split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('=');return[v.slice(0,i),decodeURIComponent(v.slice(i+1))];}));}
function sessionCookie(token:string,maxAge:number,secure:boolean):string{return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;}
function clearCookie(secure:boolean):string{return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure?'; Secure':''}`;}
function json(value:unknown,init:ResponseInit={}):Response{const headers=new Headers(init.headers);headers.set('Content-Type','application/json; charset=utf-8');headers.set('Cache-Control','no-store');return new Response(JSON.stringify(value),{...init,headers});}
function redirect(location:string):Response{return new Response(null,{status:303,headers:{Location:location}});}
function secure(response:Response):Response{const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');headers.set('X-Frame-Options','DENY');headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}
function sameOrigin(request:Request):boolean{const origin=request.headers.get('Origin');return !origin||origin===new URL(request.url).origin;}
function usesSecureCookies(env:Env):boolean{return env.APP_ENV!=='development';}
async function readBody(request:Request):Promise<Record<string,unknown>>{if(!(request.headers.get('Content-Type')??'').includes('application/json'))throw new Error('JSON_REQUIRED');const data=await request.json();if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('INVALID_BODY');return data as Record<string,unknown>;}
function safeMetadata(value:string):unknown{try{return JSON.parse(value);}catch{return {};}}
function audit(env:Env,actorId:string,eventType:string,targetType:string,targetId:string,metadata:unknown,now:number):D1Statement{
  return env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),actorId,eventType,targetType,targetId,JSON.stringify(metadata),now);
}

async function getSessionUser(request:Request,env:Env):Promise<SessionUser|null>{
  const token=parseCookies(request)[COOKIE]; if(!token)return null; const now=Math.floor(Date.now()/1000);
  const row=await env.DB.prepare(`SELECT u.id,u.username,u.display_name,u.is_verified,u.is_owner,CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'`).bind(await sha256(token),now).first<{id:string;username:string;display_name:string;is_verified:number;is_owner:number;is_admin:number}>();
  return row?{id:row.id,username:row.username,displayName:row.display_name,isVerified:Boolean(row.is_verified),isOwner:Boolean(row.is_owner),isAdmin:Boolean(row.is_admin)}:null;
}
async function createSession(env:Env,userId:string,remember:boolean,userAgent:string|null){
  const token=b64(crypto.getRandomValues(new Uint8Array(32))),now=Math.floor(Date.now()/1000),maxAge=remember?2592000:86400;
  await env.DB.prepare(`INSERT INTO sessions(id,user_id,token_hash,created_at,last_seen_at,expires_at,remember_me,user_agent) VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),userId,await sha256(token),now,now,now+maxAge,remember?1:0,userAgent?.slice(0,500)??null).run();
  return {token,maxAge};
}
async function getManagedUser(env:Env,userId:string):Promise<ManagedUser|null>{
  return env.DB.prepare(`SELECT u.id,u.username,u.display_name,u.email,u.status,u.is_verified,u.is_owner,u.created_at,CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin FROM users u WHERE u.id=?`).bind(userId).first<ManagedUser>();
}
function canManageTarget(actor:SessionUser,target:ManagedUser):boolean{return actor.isOwner||(!target.is_owner&&!target.is_admin);}

async function handleApi(request:Request,env:Env,path:string):Promise<Response>{
  const url=new URL(request.url);
  if(path==='/api/health'&&request.method==='GET')return json({ok:true,service:'grev-dad',environment:env.APP_ENV});
  if(path==='/api/auth/session'&&request.method==='GET'){const user=await getSessionUser(request,env);return json({ok:true,authenticated:Boolean(user),user});}

  if(path.startsWith('/api/profiles/')&&request.method==='GET'){
    const viewer=await getSessionUser(request,env);if(!viewer)return json({ok:false,message:'Authentication required.'},{status:401});
    const profileId=decodeURIComponent(path.slice('/api/profiles/'.length));
    if(!UUID_RE.test(profileId))return json({ok:false,message:'Profile not found.'},{status:404});
    const row=await env.DB.prepare(`SELECT id,username,display_name,is_verified,is_owner,created_at FROM users WHERE id=? AND status='active'`).bind(profileId).first<{id:string;username:string;display_name:string;is_verified:number;is_owner:number;created_at:number}>();
    if(!row)return json({ok:false,message:'Profile not found.'},{status:404});
    return json({ok:true,profile:{id:row.id,username:row.username,displayName:row.display_name,isVerified:Boolean(row.is_verified),isOwner:Boolean(row.is_owner),createdAt:row.created_at,isSelf:viewer.id===row.id}});
  }

  if(!sameOrigin(request))return json({ok:false,message:'Origin rejected.'},{status:403});

  if(path==='/api/auth/signup'&&request.method==='POST'){
    const data=await readBody(request),username=String(data.username??'').trim(),displayName=String(data.displayName??'').trim(),emailValue=String(data.email??'').trim().toLowerCase(),password=String(data.password??'');
    const email=emailValue||null;
    if(!/^[A-Za-z0-9_]{3,24}$/.test(username)||displayName.length<1||displayName.length>60||(email!==null&&!/^\S+@\S+\.\S+$/.test(email))||password.length<12)return json({ok:false,message:'Check the sign-up fields. Passwords need at least 12 characters.'},{status:400});
    const id=crypto.randomUUID(),now=Math.floor(Date.now()/1000),hashed=await hashPassword(password);
    try{await env.DB.batch([
      env.DB.prepare(`INSERT INTO users(id,username,email,display_name,status,is_verified,is_owner,created_at,updated_at) VALUES(?,?,?,?,'active',0,0,?,?)`).bind(id,username,email,displayName,now,now),
      env.DB.prepare(`INSERT INTO user_credentials(user_id,password_algorithm,password_iterations,password_salt,password_hash,password_updated_at) VALUES(?,'PBKDF2-SHA256',?,?,?,?)`).bind(id,hashed.iterations,hashed.salt,hashed.hash,now),
      env.DB.prepare(`INSERT INTO user_roles(user_id,role_id,assigned_at) VALUES(?,'role-member',?)`).bind(id,now),
      env.DB.prepare(`INSERT INTO audit_events(id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,'account.registered','user',?,'{}',?)`).bind(crypto.randomUUID(),id,now)
    ]);}catch{return json({ok:false,message:'That username or email is already in use.'},{status:409});}
    const created=await createSession(env,id,false,request.headers.get('User-Agent'));
    return json({ok:true,next:'/intentions',message:'Account created. Tell us what brings you to Grev.dad.'},{status:201,headers:{'Set-Cookie':sessionCookie(created.token,created.maxAge,usesSecureCookies(env))}});
  }

  if(path==='/api/auth/login'&&request.method==='POST'){
    const data=await readBody(request),identifier=String(data.identifier??'').trim().toLowerCase(),password=String(data.password??''),remember=Boolean(data.rememberMe);
    const row=await env.DB.prepare(`SELECT u.id,u.status,c.password_iterations,c.password_salt,c.password_hash FROM users u JOIN user_credentials c ON c.user_id=u.id WHERE lower(u.username)=? OR (u.email IS NOT NULL AND lower(u.email)=?)`).bind(identifier,identifier).first<{id:string;status:string;password_iterations:number;password_salt:string;password_hash:string}>();
    if(!row||row.status!=='active'||!(await verifyPassword(password,row.password_salt,row.password_hash,row.password_iterations)))return json({ok:false,message:'Invalid username/email or password.'},{status:401});
    const created=await createSession(env,row.id,remember,request.headers.get('User-Agent'));
    return json({ok:true,next:'/dashboard'},{headers:{'Set-Cookie':sessionCookie(created.token,created.maxAge,usesSecureCookies(env))}});
  }

  if(path==='/api/auth/logout'&&request.method==='POST'){
    const token=parseCookies(request)[COOKIE];if(token)await env.DB.prepare(`UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL`).bind(Math.floor(Date.now()/1000),await sha256(token)).run();
    return json({ok:true},{headers:{'Set-Cookie':clearCookie(usesSecureCookies(env))}});
  }

  if(path==='/api/bootstrap/owner-status'&&request.method==='GET'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const stats=await env.DB.prepare(`SELECT COUNT(*) AS user_count,SUM(CASE WHEN is_owner=1 THEN 1 ELSE 0 END) AS owner_count FROM users`).first<{user_count:number;owner_count:number|null}>();
    const first=await env.DB.prepare(`SELECT id FROM users ORDER BY created_at,id LIMIT 1`).first<{id:string}>();
    const ownerConfigured=Number(stats?.owner_count??0)>0;
    return json({ok:true,ownerConfigured,eligible:!ownerConfigured&&Number(stats?.user_count??0)===1&&first?.id===user.id,userCount:Number(stats?.user_count??0)});
  }

  if(path==='/api/bootstrap/owner'&&request.method==='POST'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const stats=await env.DB.prepare(`SELECT COUNT(*) AS user_count,SUM(CASE WHEN is_owner=1 THEN 1 ELSE 0 END) AS owner_count FROM users`).first<{user_count:number;owner_count:number|null}>();
    const first=await env.DB.prepare(`SELECT id FROM users ORDER BY created_at,id LIMIT 1`).first<{id:string}>();
    if(Number(stats?.owner_count??0)>0)return json({ok:false,message:'An Owner has already been configured.'},{status:409});
    if(Number(stats?.user_count??0)!==1||first?.id!==user.id)return json({ok:false,message:'Automatic Owner setup is only available when this is the sole account.'},{status:403});
    const data=await readBody(request),password=String(data.password??'');
    const credential=await env.DB.prepare(`SELECT password_iterations,password_salt,password_hash FROM user_credentials WHERE user_id=?`).bind(user.id).first<{password_iterations:number;password_salt:string;password_hash:string}>();
    if(!credential||!(await verifyPassword(password,credential.password_salt,credential.password_hash,credential.password_iterations)))return json({ok:false,message:'Password confirmation failed.'},{status:401});
    const now=Math.floor(Date.now()/1000);
    try{await env.DB.batch([
      env.DB.prepare(`UPDATE users SET is_owner=1,is_verified=1,verified_at=?,verified_by=?,updated_at=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM users WHERE is_owner=1)`).bind(now,user.id,now,user.id),
      env.DB.prepare(`INSERT OR IGNORE INTO user_roles(user_id,role_id,assigned_by,assigned_at) VALUES(?,'role-admin',?,?)`).bind(user.id,user.id,now),
      audit(env,user.id,'owner.claimed','user',user.id,{environment:env.APP_ENV},now)
    ]);}catch{return json({ok:false,message:'Owner setup could not be completed.'},{status:409});}
    const owner=await env.DB.prepare(`SELECT is_owner FROM users WHERE id=?`).bind(user.id).first<{is_owner:number}>();
    if(!owner?.is_owner)return json({ok:false,message:'Owner setup was not completed because another Owner was configured first.'},{status:409});
    return json({ok:true,next:'/admin',message:'Owner account configured.'});
  }

  if(path==='/api/intentions'&&request.method==='GET'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const rows=await env.DB.prepare(`SELECT i.id,i.slug,i.name,i.description,CASE WHEN ui.user_id IS NULL THEN 0 ELSE 1 END AS is_selected FROM intention_options i LEFT JOIN user_intentions ui ON ui.intention_id=i.id AND ui.user_id=? WHERE i.is_active=1 ORDER BY i.sort_order,i.name`).bind(user.id).all<{id:string;slug:string;name:string;description:string;is_selected:number}>();
    return json({ok:true,intentions:rows.results.map(row=>({id:row.id,slug:row.slug,name:row.name,description:row.description,selected:Boolean(row.is_selected)}))});
  }

  if(path==='/api/intentions'&&request.method==='POST'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const data=await readBody(request),rawIds=data.intentionIds;
    if(!Array.isArray(rawIds)||rawIds.length>20||rawIds.some(value=>typeof value!=='string'))return json({ok:false,message:'Choose valid intentions.'},{status:400});
    const requestedIds=[...new Set(rawIds.map(value=>value.trim()).filter(Boolean))];
    const activeRows=await env.DB.prepare(`SELECT id FROM intention_options WHERE is_active=1`).all<{id:string}>();
    const active=new Set(activeRows.results.map(row=>row.id));
    if(requestedIds.some(id=>!active.has(id)))return json({ok:false,message:'One or more intentions are unavailable.'},{status:400});
    const now=Math.floor(Date.now()/1000),statements:D1Statement[]=[];
    for(const intentionId of requestedIds){
      statements.push(env.DB.prepare(`INSERT OR IGNORE INTO user_intentions(user_id,intention_id,selected_at) VALUES(?,?,?)`).bind(user.id,intentionId,now));
      statements.push(env.DB.prepare(`INSERT OR IGNORE INTO group_memberships(group_id,user_id,assigned_by,assigned_at) SELECT group_id,?,?,? FROM intention_group_grants WHERE intention_id=?`).bind(user.id,user.id,now,intentionId));
    }
    if(requestedIds.length){statements.push(audit(env,user.id,'account.intentions_selected','user',user.id,{intentionIds:requestedIds},now));await env.DB.batch(statements);}
    return json({ok:true,next:'/dashboard',message:requestedIds.length?'Your intentions have been saved and the matching areas have been added.':'You can choose intentions later from your dashboard.'});
  }

  if(path==='/api/admin/summary'&&request.method==='GET'){
    const actor=await getSessionUser(request,env);if(!actor?.isAdmin)return json({ok:false,message:'Administrator access required.'},{status:403});
    const counts=await env.DB.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,SUM(CASE WHEN status='suspended' THEN 1 ELSE 0 END) AS suspended,SUM(CASE WHEN is_verified=0 THEN 1 ELSE 0 END) AS unverified FROM users`).first<{total:number;active:number|null;suspended:number|null;unverified:number|null}>();
    const admins=await env.DB.prepare(`SELECT COUNT(*) AS total FROM users u WHERE u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin')`).first<{total:number}>();
    const owner=await env.DB.prepare(`SELECT id,username,display_name FROM users WHERE is_owner=1 LIMIT 1`).first<{id:string;username:string;display_name:string}>();
    return json({ok:true,summary:{total:Number(counts?.total??0),active:Number(counts?.active??0),suspended:Number(counts?.suspended??0),unverified:Number(counts?.unverified??0),admins:Number(admins?.total??0)},owner:owner?{id:owner.id,username:owner.username,displayName:owner.display_name}:null});
  }

  if(path==='/api/admin/users'&&request.method==='GET'){
    const actor=await getSessionUser(request,env);if(!actor?.isAdmin)return json({ok:false,message:'Administrator access required.'},{status:403});
    const query=(url.searchParams.get('q')??'').trim().slice(0,100),status=url.searchParams.get('status')??'all';
    if(!['all','active','suspended','disabled'].includes(status))return json({ok:false,message:'Invalid status filter.'},{status:400});
    const pattern=`%${query.toLowerCase()}%`;
    const rows=await env.DB.prepare(`SELECT u.id,u.username,u.display_name,u.email,u.status,u.is_verified,u.is_owner,u.created_at,CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin,COALESCE((SELECT GROUP_CONCAT(pgc.display_name, ', ') FROM group_memberships gm JOIN private_group_categories pgc ON pgc.group_id=gm.group_id WHERE gm.user_id=u.id),'') AS private_groups FROM users u WHERE (?='' OR lower(u.username) LIKE ? OR lower(u.display_name) LIKE ? OR lower(COALESCE(u.email,'')) LIKE ?) AND (?='all' OR u.status=?) ORDER BY u.is_owner DESC,u.created_at DESC LIMIT 100`).bind(query,pattern,pattern,pattern,status,status).all<ManagedUser&{private_groups:string}>();
    return json({ok:true,users:rows.results.map(row=>({id:row.id,username:row.username,displayName:row.display_name,email:row.email,status:row.status,isVerified:Boolean(row.is_verified),isOwner:Boolean(row.is_owner),isAdmin:Boolean(row.is_admin),createdAt:row.created_at,privateGroups:row.private_groups?row.private_groups.split(', '):[]}))});
  }

  const adminUserMatch=path.match(/^\/api\/admin\/users\/([0-9a-f-]+)$/i);
  if(adminUserMatch&&request.method==='GET'){
    const actor=await getSessionUser(request,env);if(!actor?.isAdmin)return json({ok:false,message:'Administrator access required.'},{status:403});
    const userId=adminUserMatch[1]!;if(!UUID_RE.test(userId))return json({ok:false,message:'User not found.'},{status:404});
    const target=await getManagedUser(env,userId);if(!target)return json({ok:false,message:'User not found.'},{status:404});
    const [privateGroups,intentions,roles,auditRows,sessionCount]=await Promise.all([
      env.DB.prepare(`SELECT pgc.group_id,pgc.category_key,pgc.display_name,CASE WHEN gm.user_id IS NULL THEN 0 ELSE 1 END AS assigned FROM private_group_categories pgc LEFT JOIN group_memberships gm ON gm.group_id=pgc.group_id AND gm.user_id=? ORDER BY pgc.sort_order`).bind(userId).all<{group_id:string;category_key:string;display_name:string;assigned:number}>(),
      env.DB.prepare(`SELECT i.id,i.name FROM user_intentions ui JOIN intention_options i ON i.id=ui.intention_id WHERE ui.user_id=? ORDER BY i.sort_order,i.name`).bind(userId).all<{id:string;name:string}>(),
      env.DB.prepare(`SELECT r.id,r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=? ORDER BY r.name`).bind(userId).all<{id:string;name:string}>(),
      env.DB.prepare(`SELECT ae.id,ae.event_type,ae.metadata_json,ae.created_at,actor.username AS actor_username FROM audit_events ae LEFT JOIN users actor ON actor.id=ae.actor_user_id WHERE ae.target_id=? OR ae.actor_user_id=? ORDER BY ae.created_at DESC LIMIT 50`).bind(userId,userId).all<{id:string;event_type:string;metadata_json:string;created_at:number;actor_username:string|null}>(),
      env.DB.prepare(`SELECT COUNT(*) AS total FROM sessions WHERE user_id=? AND revoked_at IS NULL AND expires_at>?`).bind(userId,Math.floor(Date.now()/1000)).first<{total:number}>()
    ]);
    return json({ok:true,user:{id:target.id,username:target.username,displayName:target.display_name,email:target.email,status:target.status,isVerified:Boolean(target.is_verified),isOwner:Boolean(target.is_owner),isAdmin:Boolean(target.is_admin),createdAt:target.created_at,activeSessions:Number(sessionCount?.total??0)},privateGroups:privateGroups.results.map(row=>({id:row.group_id,key:row.category_key,name:row.display_name,assigned:Boolean(row.assigned)})),intentions:intentions.results,roles:roles.results,audit:auditRows.results.map(row=>({id:row.id,type:row.event_type,metadata:safeMetadata(row.metadata_json),createdAt:row.created_at,actorUsername:row.actor_username})),viewer:{isOwner:actor.isOwner},capabilities:{canManage:canManageTarget(actor,target),canManageAdmin:actor.isOwner&&!target.is_owner,canManageStatus:!target.is_owner&&target.id!==actor.id&&(actor.isOwner||!target.is_admin)}});
  }

  const verifyMatch=path.match(/^\/api\/admin\/users\/([0-9a-f-]+)\/verification$/i);
  if(verifyMatch&&request.method==='POST'){
    const actor=await getSessionUser(request,env);if(!actor?.isAdmin)return json({ok:false,message:'Administrator access required.'},{status:403});
    const target=await getManagedUser(env,verifyMatch[1]!);if(!target)return json({ok:false,message:'User not found.'},{status:404});
    if(!canManageTarget(actor,target))return json({ok:false,message:'Only the Owner can change this account.'},{status:403});
    const data=await readBody(request),verified=data.verified===true,now=Math.floor(Date.now()/1000);
    await env.DB.batch([
      env.DB.prepare(`UPDATE users SET is_verified=?,verified_at=?,verified_by=?,updated_at=? WHERE id=?`).bind(verified?1:0,verified?now:null,verified?actor.id:null,now,target.id),
      audit(env,actor.id,verified?'account.verified':'account.unverified','user',target.id,{previous:Boolean(target.is_verified)},now)
    ]);
    return json({ok:true,isVerified:verified,message:verified?'Account verified.':'Account verification removed.'});
  }

  const statusMatch=path.match(/^\/api\/admin\/users\/([0-9a-f-]+)\/status$/i);
  if(statusMatch&&request.method==='POST'){
    const actor=await getSessionUser(request,env);if(!actor?.isAdmin)return json({ok:false,message:'Administrator access required.'},{status:403});
    const target=await getManagedUser(env,statusMatch[1]!);if(!target)return json({ok:false,message:'User not found.'},{status:404});
    if(target.is_owner)return json({ok:false,message:'The Owner account cannot be suspended or disabled.'},{status:403});
    if(target.id===actor.id)return json({ok:false,message:'You cannot change your own account status.'},{status:403});
    if(target.is_admin&&!actor.isOwner)return json({ok:false,message:'Only the Owner can change an administrator account.'},{status:403});
    const data=await readBody(request),status=String(data.status??'');
    if(!['active','suspended','disabled'].includes(status))return json({ok:false,message:'Invalid account status.'},{status:400});
    const now=Math.floor(Date.now()/1000),statements:D1Statement[]=[
      env.DB.prepare(`UPDATE users SET status=?,updated_at=? WHERE id=?`).bind(status,now,target.id),
      audit(env,actor.id,'account.status_changed','user',target.id,{from:target.status,to:status},now)
    ];
    if(status!=='active')statements.push(env.DB.prepare(`UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL`).bind(now,target.id));
    await env.DB.batch(statements);
    return json({ok:true,status,message:`Account status changed to ${status}.`});
  }

  const groupsMatch=path.match(/^\/api\/admin\/users\/([0-9a-f-]+)\/private-groups$/i);
  if(groupsMatch&&request.method==='POST'){
    const actor=await getSessionUser(request,env);if(!actor?.isAdmin)return json({ok:false,message:'Administrator access required.'},{status:403});
    const target=await getManagedUser(env,groupsMatch[1]!);if(!target)return json({ok:false,message:'User not found.'},{status:404});
    if(!canManageTarget(actor,target))return json({ok:false,message:'Only the Owner can change this account.'},{status:403});
    const data=await readBody(request),rawIds=data.groupIds;
    if(!Array.isArray(rawIds)||rawIds.length>20||rawIds.some(value=>typeof value!=='string'))return json({ok:false,message:'Choose valid private groups.'},{status:400});
    const groupIds=[...new Set(rawIds.map(value=>value.trim()).filter(Boolean))];
    const validRows=await env.DB.prepare(`SELECT group_id FROM private_group_categories`).all<{group_id:string}>(),valid=new Set(validRows.results.map(row=>row.group_id));
    if(groupIds.some(id=>!valid.has(id)))return json({ok:false,message:'One or more private groups are invalid.'},{status:400});
    const now=Math.floor(Date.now()/1000),statements:D1Statement[]=[env.DB.prepare(`DELETE FROM group_memberships WHERE user_id=? AND group_id IN (SELECT group_id FROM private_group_categories)`).bind(target.id)];
    for(const groupId of groupIds)statements.push(env.DB.prepare(`INSERT INTO group_memberships(group_id,user_id,assigned_by,assigned_at) VALUES(?,?,?,?)`).bind(groupId,target.id,actor.id,now));
    statements.push(audit(env,actor.id,'account.private_groups_changed','user',target.id,{groupIds},now));
    await env.DB.batch(statements);
    return json({ok:true,groupIds,message:'Private groups updated.'});
  }

  const adminRoleMatch=path.match(/^\/api\/admin\/users\/([0-9a-f-]+)\/administrator$/i);
  if(adminRoleMatch&&request.method==='POST'){
    const actor=await getSessionUser(request,env);if(!actor?.isOwner)return json({ok:false,message:'Owner access required.'},{status:403});
    const target=await getManagedUser(env,adminRoleMatch[1]!);if(!target)return json({ok:false,message:'User not found.'},{status:404});
    if(target.is_owner)return json({ok:false,message:'The Owner account is always an administrator.'},{status:409});
    const data=await readBody(request),isAdmin=data.isAdmin===true,now=Math.floor(Date.now()/1000);
    const statements:D1Statement[]=[];
    if(isAdmin)statements.push(env.DB.prepare(`INSERT OR IGNORE INTO user_roles(user_id,role_id,assigned_by,assigned_at) VALUES(?,'role-admin',?,?)`).bind(target.id,actor.id,now));
    else statements.push(env.DB.prepare(`DELETE FROM user_roles WHERE user_id=? AND role_id='role-admin'`).bind(target.id));
    statements.push(audit(env,actor.id,isAdmin?'account.admin_granted':'account.admin_removed','user',target.id,{},now));
    await env.DB.batch(statements);
    return json({ok:true,isAdmin,message:isAdmin?'Administrator access granted.':'Administrator access removed.'});
  }

  if(path==='/api/account/username'&&request.method==='POST'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const data=await readBody(request),username=String(data.username??'').trim();
    if(!/^[A-Za-z0-9_]{3,24}$/.test(username))return json({ok:false,message:'Usernames must be 3–24 characters using letters, numbers or underscores.'},{status:400});
    const now=Math.floor(Date.now()/1000);
    try{await env.DB.batch([
      env.DB.prepare(`UPDATE users SET username=?,updated_at=? WHERE id=?`).bind(username,now,user.id),
      audit(env,user.id,'account.username_changed','user',user.id,{from:user.username,to:username},now)
    ]);}catch{return json({ok:false,message:'That username is already in use.'},{status:409});}
    return json({ok:true,username,message:'Username updated. Your permanent profile URL has not changed.'});
  }

  return json({ok:false,message:'Not found.'},{status:404});
}

function assetRequest(request:Request,path:string):Request{const url=new URL(request.url);url.pathname=path;url.search='';return new Request(url,request);}
export default{async fetch(request:Request,env:Env):Promise<Response>{
  const path=new URL(request.url).pathname;let response:Response;
  try{
    if(path.startsWith('/api/'))response=await handleApi(request,env,path);
    else if(['/styles.css','/app.js','/admin.js','/favicon.svg'].includes(path))response=await env.ASSETS.fetch(assetRequest(request,path));
    else if(path==='/')response=(await getSessionUser(request,env))?redirect('/dashboard'):await env.ASSETS.fetch(assetRequest(request,'/index.html'));
    else if(path==='/login')response=(await getSessionUser(request,env))?redirect('/dashboard'):await env.ASSETS.fetch(assetRequest(request,'/login.html'));
    else if(path==='/signup')response=(await getSessionUser(request,env))?redirect('/dashboard'):await env.ASSETS.fetch(assetRequest(request,'/signup.html'));
    else if(path==='/dashboard')response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/dashboard.html')):redirect('/login');
    else if(path==='/access')response=redirect('/intentions');
    else if(path==='/intentions')response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/intentions.html')):redirect('/login');
    else if(path==='/owner-setup')response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/owner-setup.html')):redirect('/login');
    else if(path==='/admin'||path==='/admin/users'){const user=await getSessionUser(request,env);response=user?.isAdmin?await env.ASSETS.fetch(assetRequest(request,'/admin.html')):redirect(user?'/dashboard':'/login');}
    else if(/^\/admin\/users\/[0-9a-f-]+$/i.test(path)){const user=await getSessionUser(request,env);response=user?.isAdmin?await env.ASSETS.fetch(assetRequest(request,'/admin-user.html')):redirect(user?'/dashboard':'/login');}
    else if(path==='/admin/access-requests')response=redirect('/admin');
    else if(path==='/profile'){const user=await getSessionUser(request,env);response=user?redirect(`/profile/${encodeURIComponent(user.id)}`):redirect('/login');}
    else if(/^\/profile\/[^/]+$/.test(path))response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/profile.html')):redirect('/login');
    else response=new Response('Not found',{status:404});
  }catch(error){console.error(error);response=json({ok:false,message:'Internal server error.'},{status:500});}
  return secure(response);
}};