interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1Statement; }

export interface MembersEnv { DB: D1Database; }

type Viewer = { id:string; isVerified:boolean };
type Privacy = { visibility:'all'|'verified'|'groups'|'private'; groupId:string|null };

const COOKIE='grev_session';
const encoder=new TextEncoder();

function base64Url(bytes:Uint8Array):string{return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
async function sha256(value:string):Promise<string>{return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
function cookies(request:Request):Record<string,string>{return Object.fromEntries((request.headers.get('Cookie')??'').split(';').map(value=>value.trim()).filter(Boolean).map(value=>{const index=value.indexOf('=');return index<0?['','']:[value.slice(0,index),decodeURIComponent(value.slice(index+1))];}).filter(([key])=>key));}
function json(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'}});}

async function viewerFromRequest(request:Request,env:MembersEnv):Promise<Viewer|null>{
  const token=cookies(request)[COOKIE];if(!token)return null;
  const row=await env.DB.prepare(`SELECT u.id,u.is_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'`).bind(await sha256(token),Math.floor(Date.now()/1000)).first<{id:string;is_verified:number}>();
  return row?{id:row.id,isVerified:Boolean(row.is_verified)}:null;
}

function canSee(viewer:Viewer,targetId:string,record:Privacy|undefined,viewerGroups:Set<string>):boolean{
  if(viewer.id===targetId)return true;
  if(!record||record.visibility==='all')return true;
  if(record.visibility==='verified')return viewer.isVerified;
  if(record.visibility==='groups')return Boolean(record.groupId&&viewerGroups.has(record.groupId));
  return false;
}

export async function handleMembersRequest(request:Request,env:MembersEnv):Promise<Response|null>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/members')return null;
  if(request.method!=='GET')return json({ok:false,message:'Method not allowed.'},405);
  const viewer=await viewerFromRequest(request,env);
  if(!viewer)return json({ok:false,message:'Authentication required.'},401);

  const [rows,privacyRows,groupRows]=await Promise.all([
    env.DB.prepare(`
      SELECT u.id,u.username,u.display_name,u.is_verified,u.is_owner,u.created_at,
        CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin,
        p.headline,p.bio,p.location,p.avatar_media,p.background_primary,p.background_secondary,p.text_colour,p.border_colour,
        pr.availability,pr.status_text,pr.activity_type,pr.activity_text,pr.updated_at AS presence_updated_at
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id=u.id
      LEFT JOIN user_presence pr ON pr.user_id=u.id
      WHERE u.status='active'
        AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE (b.owner_user_id=? AND b.blocked_user_id=u.id) OR (b.owner_user_id=u.id AND b.blocked_user_id=?))
      ORDER BY u.is_owner DESC,is_admin DESC,lower(u.display_name),lower(u.username)
      LIMIT 500
    `).bind(viewer.id,viewer.id).all<Record<string,unknown>>(),
    env.DB.prepare(`SELECT user_id,field_key,visibility,group_id FROM user_profile_field_privacy WHERE field_key IN ('username','headline','bio','location','avatar','status','memberSince')`).all<{user_id:string;field_key:string;visibility:Privacy['visibility'];group_id:string|null}>(),
    env.DB.prepare(`SELECT group_id FROM group_memberships WHERE user_id=?`).bind(viewer.id).all<{group_id:string}>()
  ]);
  const viewerGroups=new Set(groupRows.results.map(row=>row.group_id));
  const privacy=new Map<string,Privacy>();
  privacyRows.results.forEach(row=>privacy.set(`${row.user_id}:${row.field_key}`,{visibility:row.visibility,groupId:row.group_id}));
  const visible=(targetId:string,key:string)=>canSee(viewer,targetId,privacy.get(`${targetId}:${key}`),viewerGroups);

  const members=rows.results.map(row=>{
    const id=String(row.id);
    const availability=visible(id,'status')?String(row.availability??'offline'):'hidden';
    return {
      id,
      displayName:String(row.display_name??row.username??'Member'),
      username:visible(id,'username')?String(row.username??''):null,
      verified:Boolean(row.is_verified),
      owner:Boolean(row.is_owner),
      admin:Boolean(row.is_admin),
      memberSince:visible(id,'memberSince')?Number(row.created_at??0):null,
      profile:{
        headline:visible(id,'headline')&&row.headline?String(row.headline):null,
        bio:visible(id,'bio')&&row.bio?String(row.bio):null,
        location:visible(id,'location')&&row.location?String(row.location):null,
        avatar:visible(id,'avatar')&&row.avatar_media?String(row.avatar_media):null,
        colours:{primary:String(row.background_primary??'#11161d'),secondary:String(row.background_secondary??'#3157c9'),text:String(row.text_colour??'#f4f7fb'),border:String(row.border_colour??'#394657')}
      },
      presence:{
        availability,
        statusText:availability!=='hidden'&&row.status_text?String(row.status_text):null,
        activityType:availability!=='hidden'&&row.activity_type?String(row.activity_type):null,
        activityText:availability!=='hidden'&&row.activity_text?String(row.activity_text):null,
        updatedAt:availability!=='hidden'?Number(row.presence_updated_at??0):null
      }
    };
  });
  return json({ok:true,viewer:{id:viewer.id,verified:viewer.isVerified},members,total:members.length});
}
