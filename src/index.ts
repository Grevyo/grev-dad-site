interface D1Statement { bind(...values: unknown[]): D1Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; }
interface D1Database { prepare(query: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown[]>; }
interface Env { DB: D1Database; ASSETS: { fetch(request: Request): Promise<Response> }; APP_ENV: 'development' | 'preview' | 'production'; }
type SessionUser = { id: string; username: string; displayName: string; isVerified: boolean; isOwner: boolean };

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
async function readBody(request:Request):Promise<Record<string,unknown>>{if(!(request.headers.get('Content-Type')??'').includes('application/json'))throw new Error('JSON_REQUIRED');const data=await request.json();if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('INVALID_BODY');return data as Record<string,unknown>;}

async function getSessionUser(request:Request,env:Env):Promise<SessionUser|null>{
  const token=parseCookies(request)[COOKIE]; if(!token)return null; const now=Math.floor(Date.now()/1000);
  const row=await env.DB.prepare(`SELECT u.id,u.username,u.display_name,u.is_verified,u.is_owner FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'`).bind(await sha256(token),now).first<{id:string;username:string;display_name:string;is_verified:number;is_owner:number}>();
  return row?{id:row.id,username:row.username,displayName:row.display_name,isVerified:Boolean(row.is_verified),isOwner:Boolean(row.is_owner)}:null;
}
async function createSession(env:Env,userId:string,remember:boolean,userAgent:string|null){
  const token=b64(crypto.getRandomValues(new Uint8Array(32))),now=Math.floor(Date.now()/1000),maxAge=remember?2592000:86400;
  await env.DB.prepare(`INSERT INTO sessions(id,user_id,token_hash,created_at,last_seen_at,expires_at,remember_me,user_agent) VALUES(?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),userId,await sha256(token),now,now,now+maxAge,remember?1:0,userAgent?.slice(0,500)??null).run();
  return {token,maxAge};
}

async function handleApi(request:Request,env:Env,path:string):Promise<Response>{
  if(path==='/api/health'&&request.method==='GET')return json({ok:true,service:'grev-dad',environment:env.APP_ENV});
  if(path==='/api/auth/session'&&request.method==='GET'){const user=await getSessionUser(request,env);return json({ok:true,authenticated:Boolean(user),user});}
  if(!sameOrigin(request))return json({ok:false,message:'Origin rejected.'},{status:403});

  if(path==='/api/auth/signup'&&request.method==='POST'){
    const data=await readBody(request),username=String(data.username??'').trim(),displayName=String(data.displayName??'').trim(),email=String(data.email??'').trim().toLowerCase(),password=String(data.password??'');
    if(!/^[A-Za-z0-9_]{3,24}$/.test(username)||displayName.length<1||displayName.length>60||!/^\S+@\S+\.\S+$/.test(email)||password.length<12)return json({ok:false,message:'Check the sign-up fields. Passwords need at least 12 characters.'},{status:400});
    const id=crypto.randomUUID(),now=Math.floor(Date.now()/1000),hashed=await hashPassword(password);
    try{await env.DB.batch([
      env.DB.prepare(`INSERT INTO users(id,username,email,display_name,status,is_verified,is_owner,created_at,updated_at) VALUES(?,?,?,?,'active',0,0,?,?)`).bind(id,username,email,displayName,now,now),
      env.DB.prepare(`INSERT INTO user_credentials(user_id,password_algorithm,password_iterations,password_salt,password_hash,password_updated_at) VALUES(?,'PBKDF2-SHA256',?,?,?,?)`).bind(id,hashed.iterations,hashed.salt,hashed.hash,now),
      env.DB.prepare(`INSERT INTO user_roles(user_id,role_id,assigned_at) VALUES(?,'role-member',?)`).bind(id,now),
      env.DB.prepare(`INSERT INTO audit_events(id,event_type,target_type,target_id,metadata_json,created_at) VALUES(?,'account.registered','user',?,'{}',?)`).bind(crypto.randomUUID(),id,now)
    ]);}catch{return json({ok:false,message:'That username or email is already in use.'},{status:409});}
    return json({ok:true,message:'Account created. Sign in for limited unverified access.'},{status:201});
  }

  if(path==='/api/auth/login'&&request.method==='POST'){
    const data=await readBody(request),identifier=String(data.identifier??'').trim().toLowerCase(),password=String(data.password??''),remember=Boolean(data.rememberMe);
    const row=await env.DB.prepare(`SELECT u.id,u.status,c.password_iterations,c.password_salt,c.password_hash FROM users u JOIN user_credentials c ON c.user_id=u.id WHERE lower(u.username)=? OR lower(u.email)=?`).bind(identifier,identifier).first<{id:string;status:string;password_iterations:number;password_salt:string;password_hash:string}>();
    if(!row||row.status!=='active'||!(await verifyPassword(password,row.password_salt,row.password_hash,row.password_iterations)))return json({ok:false,message:'Invalid username/email or password.'},{status:401});
    const created=await createSession(env,row.id,remember,request.headers.get('User-Agent'));
    return json({ok:true},{headers:{'Set-Cookie':sessionCookie(created.token,created.maxAge,env.APP_ENV==='production')}});
  }

  if(path==='/api/auth/logout'&&request.method==='POST'){
    const token=parseCookies(request)[COOKIE];if(token)await env.DB.prepare(`UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL`).bind(Math.floor(Date.now()/1000),await sha256(token)).run();
    return json({ok:true},{headers:{'Set-Cookie':clearCookie(env.APP_ENV==='production')}});
  }
  return json({ok:false,message:'Not found.'},{status:404});
}

function assetRequest(request:Request,path:string):Request{const url=new URL(request.url);url.pathname=path;url.search='';return new Request(url,request);}
export default{async fetch(request:Request,env:Env):Promise<Response>{
  const path=new URL(request.url).pathname;let response:Response;
  try{
    if(path.startsWith('/api/'))response=await handleApi(request,env,path);
    else if(['/styles.css','/app.js','/favicon.svg'].includes(path))response=await env.ASSETS.fetch(assetRequest(request,path));
    else if(['/', '/login','/signup'].includes(path))response=(await getSessionUser(request,env))?redirect('/dashboard'):await env.ASSETS.fetch(assetRequest(request,'/index.html'));
    else if(path==='/dashboard')response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/dashboard.html')):redirect('/');
    else response=new Response('Not found',{status:404});
  }catch(error){console.error(error);response=json({ok:false,message:'Internal server error.'},{status:500});}
  return secure(response);
}};