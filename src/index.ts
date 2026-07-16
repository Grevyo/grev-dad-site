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

const COOKIE = 'grev_session';
const encoder = new TextEncoder();

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

async function handleApi(request:Request,env:Env,path:string):Promise<Response>{
  if(path==='/api/health'&&request.method==='GET')return json({ok:true,service:'grev-dad',environment:env.APP_ENV});
  if(path==='/api/auth/session'&&request.method==='GET'){const user=await getSessionUser(request,env);return json({ok:true,authenticated:Boolean(user),user});}

  if(path.startsWith('/api/profiles/')&&request.method==='GET'){
    const viewer=await getSessionUser(request,env);if(!viewer)return json({ok:false,message:'Authentication required.'},{status:401});
    const profileId=decodeURIComponent(path.slice('/api/profiles/'.length));
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId))return json({ok:false,message:'Profile not found.'},{status:404});
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
    return json({ok:true,next:'/access',message:'Account created. Choose the access you would like.'},{status:201,headers:{'Set-Cookie':sessionCookie(created.token,created.maxAge,usesSecureCookies(env))}});
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

  if(path==='/api/access/catalog'&&request.method==='GET'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const rows=await env.DB.prepare(`SELECT a.id,a.slug,a.name,a.description,a.access_type,CASE WHEN gm.user_id IS NOT NULL THEN 'granted' ELSE COALESCE(ar.status,'available') END AS request_status FROM access_areas a LEFT JOIN group_memberships gm ON gm.group_id=a.group_id AND gm.user_id=? LEFT JOIN access_requests ar ON ar.access_area_id=a.id AND ar.user_id=? WHERE a.is_active=1 ORDER BY a.sort_order,a.name`).bind(user.id,user.id).all<{id:string;slug:string;name:string;description:string;access_type:'public'|'private';request_status:string}>();
    return json({ok:true,areas:rows.results.map(row=>({id:row.id,slug:row.slug,name:row.name,description:row.description,type:row.access_type,status:row.request_status}))});
  }

  if(path==='/api/access/request'&&request.method==='POST'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const data=await readBody(request),accessId=String(data.accessId??'');
    const area=await env.DB.prepare(`SELECT id,name,access_type,group_id FROM access_areas WHERE id=? AND is_active=1`).bind(accessId).first<{id:string;name:string;access_type:'public'|'private';group_id:string}>();
    if(!area)return json({ok:false,message:'Access area not found.'},{status:404});
    const membership=await env.DB.prepare(`SELECT user_id FROM group_memberships WHERE group_id=? AND user_id=?`).bind(area.group_id,user.id).first<{user_id:string}>();
    if(membership)return json({ok:true,status:'granted',message:`You already have ${area.name}.`});
    const now=Math.floor(Date.now()/1000),requestId=crypto.randomUUID();
    if(area.access_type==='public'){
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO group_memberships(group_id,user_id,assigned_by,assigned_at) VALUES(?,?,?,?) ON CONFLICT(group_id,user_id) DO NOTHING`).bind(area.group_id,user.id,user.id,now),
        env.DB.prepare(`INSERT INTO access_requests(id,user_id,access_area_id,status,requested_at,decided_at,decided_by) VALUES(?,?,?,'approved',?,?,?) ON CONFLICT(user_id,access_area_id) DO UPDATE SET status='approved',requested_at=excluded.requested_at,decided_at=excluded.decided_at,decided_by=excluded.decided_by`).bind(requestId,user.id,area.id,now,now,user.id),
        env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,'access.public_granted','access_area',?,'{}',?)`).bind(crypto.randomUUID(),user.id,area.id,now)
      ]);
      return json({ok:true,status:'granted',message:`${area.name} has been granted.`});
    }
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO access_requests(id,user_id,access_area_id,status,requested_at,decided_at,decided_by) VALUES(?,?,?,'pending',?,NULL,NULL) ON CONFLICT(user_id,access_area_id) DO UPDATE SET status=CASE WHEN access_requests.status='approved' THEN 'approved' ELSE 'pending' END,requested_at=excluded.requested_at,decided_at=NULL,decided_by=NULL`).bind(requestId,user.id,area.id,now),
      env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,'access.private_requested','access_area',?,'{}',?)`).bind(crypto.randomUUID(),user.id,area.id,now)
    ]);
    return json({ok:true,status:'pending',message:`${area.name} has been sent to an administrator for approval.`},{status:202});
  }

  if(path==='/api/admin/access-requests'&&request.method==='GET'){
    const admin=await getSessionUser(request,env);if(!admin?.isAdmin)return json({ok:false,message:'Administrator access required.'},{status:403});
    const rows=await env.DB.prepare(`SELECT ar.id,ar.requested_at,u.id AS user_id,u.username,u.display_name,a.id AS access_area_id,a.name AS access_name,a.description FROM access_requests ar JOIN users u ON u.id=ar.user_id JOIN access_areas a ON a.id=ar.access_area_id WHERE ar.status='pending' AND a.access_type='private' ORDER BY ar.requested_at`).all<{id:string;requested_at:number;user_id:string;username:string;display_name:string;access_area_id:string;access_name:string;description:string}>();
    return json({ok:true,requests:rows.results.map(row=>({id:row.id,requestedAt:row.requested_at,user:{id:row.user_id,username:row.username,displayName:row.display_name},access:{id:row.access_area_id,name:row.access_name,description:row.description}}))});
  }

  const decisionMatch=path.match(/^\/api\/admin\/access-requests\/([0-9a-f-]+)\/decision$/i);
  if(decisionMatch&&request.method==='POST'){
    const admin=await getSessionUser(request,env);if(!admin?.isAdmin)return json({ok:false,message:'Administrator access required.'},{status:403});
    const data=await readBody(request),decision=String(data.decision??'');
    if(decision!=='approved'&&decision!=='denied')return json({ok:false,message:'Decision must be approved or denied.'},{status:400});
    const requestId=decisionMatch[1]!;
    const accessRequest=await env.DB.prepare(`SELECT ar.id,ar.user_id,ar.access_area_id,ar.status,a.group_id,a.name FROM access_requests ar JOIN access_areas a ON a.id=ar.access_area_id WHERE ar.id=? AND a.access_type='private'`).bind(requestId).first<{id:string;user_id:string;access_area_id:string;status:string;group_id:string;name:string}>();
    if(!accessRequest)return json({ok:false,message:'Access request not found.'},{status:404});
    if(accessRequest.status!=='pending')return json({ok:false,message:'This request has already been decided.'},{status:409});
    const now=Math.floor(Date.now()/1000),statements:D1Statement[]=[
      env.DB.prepare(`UPDATE access_requests SET status=?,decided_at=?,decided_by=? WHERE id=? AND status='pending'`).bind(decision,now,admin.id,requestId),
      env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,'access_request',?,?,?)`).bind(crypto.randomUUID(),admin.id,decision==='approved'?'access.private_approved':'access.private_denied',requestId,JSON.stringify({accessAreaId:accessRequest.access_area_id,userId:accessRequest.user_id}),now)
    ];
    if(decision==='approved')statements.push(env.DB.prepare(`INSERT INTO group_memberships(group_id,user_id,assigned_by,assigned_at) VALUES(?,?,?,?) ON CONFLICT(group_id,user_id) DO NOTHING`).bind(accessRequest.group_id,accessRequest.user_id,admin.id,now));
    await env.DB.batch(statements);
    return json({ok:true,status:decision,message:`${accessRequest.name} request ${decision}.`});
  }

  if(path==='/api/account/username'&&request.method==='POST'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const data=await readBody(request),username=String(data.username??'').trim();
    if(!/^[A-Za-z0-9_]{3,24}$/.test(username))return json({ok:false,message:'Usernames must be 3–24 characters using letters, numbers or underscores.'},{status:400});
    const now=Math.floor(Date.now()/1000);
    try{await env.DB.batch([
      env.DB.prepare(`UPDATE users SET username=?,updated_at=? WHERE id=?`).bind(username,now,user.id),
      env.DB.prepare(`INSERT INTO audit_events(id,actor_user_id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,?,'account.username_changed','user',?,?,?)`).bind(crypto.randomUUID(),user.id,user.id,JSON.stringify({from:user.username,to:username}),now)
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
    else if(['/styles.css','/app.js','/favicon.svg'].includes(path))response=await env.ASSETS.fetch(assetRequest(request,path));
    else if(path==='/'){response=(await getSessionUser(request,env))?redirect('/dashboard'):await env.ASSETS.fetch(assetRequest(request,'/index.html'));}
    else if(path==='/login')response=(await getSessionUser(request,env))?redirect('/dashboard'):await env.ASSETS.fetch(assetRequest(request,'/login.html'));
    else if(path==='/signup')response=(await getSessionUser(request,env))?redirect('/dashboard'):await env.ASSETS.fetch(assetRequest(request,'/signup.html'));
    else if(path==='/dashboard')response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/dashboard.html')):redirect('/login');
    else if(path==='/access')response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/access.html')):redirect('/login');
    else if(path==='/admin/access-requests'){const user=await getSessionUser(request,env);response=user?.isAdmin?await env.ASSETS.fetch(assetRequest(request,'/admin-access.html')):redirect(user?'/dashboard':'/login');}
    else if(path==='/profile'){const user=await getSessionUser(request,env);response=user?redirect(`/profile/${encodeURIComponent(user.id)}`):redirect('/login');}
    else if(/^\/profile\/[^/]+$/.test(path))response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/profile.html')):redirect('/login');
    else response=new Response('Not found',{status:404});
  }catch(error){console.error(error);response=json({ok:false,message:'Internal server error.'},{status:500});}
  return secure(response);
}};
