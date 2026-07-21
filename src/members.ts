interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1Statement; }

export interface MembersEnv { DB: D1Database; }

type Viewer = { id:string; isVerified:boolean; isAdmin:boolean };
type Privacy = { visibility:'all'|'verified'|'groups'|'private'; groupId:string|null };

const COOKIE='grev_session';
const encoder=new TextEncoder();

const DEFAULT_CARD={
  backgroundPrimary:'#11161d',backgroundSecondary:'#3157c9',backgroundAngle:135,
  textColour:'#f4f7fb',borderColour:'#526074',showUsername:true,showStatus:true,showMemberSince:true
};
const DEFAULT_DESIGN={
  cardWidth:'full',cardAlignment:'centre',cardSurface:'gradient',coverHeight:180,avatarSize:132,
  cardPadding:28,cardShadow:'large',cardBorderWidth:1,showCover:true,showAvatar:true,
  showHeadline:true,showBio:true,showLocation:true,showWebsite:true
};

function base64Url(bytes:Uint8Array):string{return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
async function sha256(value:string):Promise<string>{return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
function cookies(request:Request):Record<string,string>{return Object.fromEntries((request.headers.get('Cookie')??'').split(';').map(value=>value.trim()).filter(Boolean).map(value=>{const index=value.indexOf('=');return index<0?['','']:[value.slice(0,index),decodeURIComponent(value.slice(index+1))];}).filter(([key])=>key));}
function json(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'}});}
function text(value:unknown,fallback:string|null=null):string|null{return value===null||value===undefined||value===''?fallback:String(value);}
function number(value:unknown,fallback:number):number{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}
function bool(value:unknown,fallback:boolean):boolean{return value===null||value===undefined?fallback:Boolean(value);}

async function viewerFromRequest(request:Request,env:MembersEnv):Promise<Viewer|null>{
  const token=cookies(request)[COOKIE];if(!token)return null;
  const row=await env.DB.prepare(`
    SELECT u.id,u.is_verified,
      CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token),Math.floor(Date.now()/1000)).first<{id:string;is_verified:number;is_admin:number}>();
  return row?{id:row.id,isVerified:Boolean(row.is_verified),isAdmin:Boolean(row.is_admin)}:null;
}

function canSee(viewer:Viewer,targetId:string,record:Privacy|undefined,viewerGroups:Set<string>):boolean{
  if(viewer.id===targetId||viewer.isAdmin)return true;
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
        p.headline,p.bio,p.location,p.website_url,p.avatar_media,p.cover_media,
        p.background_primary,p.background_secondary,p.background_angle,p.text_colour,p.border_colour,
        p.show_username,p.show_status,p.show_member_since,
        d.card_width,d.card_alignment,d.card_surface,d.cover_height,d.avatar_size,d.card_padding,
        d.card_shadow,d.card_border_width,d.show_cover,d.show_avatar,d.show_headline,d.show_bio,d.show_location,d.show_website,
        pr.availability,pr.status_text,pr.activity_type,pr.activity_text,pr.updated_at AS presence_updated_at
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id=u.id
      LEFT JOIN user_profile_design d ON d.user_id=u.id
      LEFT JOIN user_presence pr ON pr.user_id=u.id
      WHERE u.status='active'
        AND NOT EXISTS(SELECT 1 FROM profile_blocks b WHERE (b.owner_user_id=? AND b.blocked_user_id=u.id) OR (b.owner_user_id=u.id AND b.blocked_user_id=?))
      ORDER BY u.is_owner DESC,is_admin DESC,lower(u.display_name),lower(u.username)
      LIMIT 500
    `).bind(viewer.id,viewer.id).all<Record<string,unknown>>(),
    env.DB.prepare(`SELECT user_id,field_key,visibility,group_id FROM user_profile_field_privacy WHERE field_key IN ('username','headline','bio','location','website','avatar','cover','status','memberSince')`).all<{user_id:string;field_key:string;visibility:Privacy['visibility'];group_id:string|null}>(),
    env.DB.prepare(`SELECT group_id FROM group_memberships WHERE user_id=?`).bind(viewer.id).all<{group_id:string}>()
  ]);
  const viewerGroups=new Set(groupRows.results.map(row=>row.group_id));
  const privacy=new Map<string,Privacy>();
  privacyRows.results.forEach(row=>privacy.set(`${row.user_id}:${row.field_key}`,{visibility:row.visibility,groupId:row.group_id}));
  const visible=(targetId:string,key:string)=>canSee(viewer,targetId,privacy.get(`${targetId}:${key}`),viewerGroups);

  const members=rows.results.map(row=>{
    const id=String(row.id);
    const usernameVisible=visible(id,'username');
    const statusVisible=visible(id,'status');
    const memberSinceVisible=visible(id,'memberSince');
    const headlineVisible=visible(id,'headline');
    const bioVisible=visible(id,'bio');
    const locationVisible=visible(id,'location');
    const websiteVisible=visible(id,'website');
    const avatarVisible=visible(id,'avatar');
    const coverVisible=visible(id,'cover');
    const showStatus=bool(row.show_status,DEFAULT_CARD.showStatus)&&statusVisible;
    const showMemberSince=bool(row.show_member_since,DEFAULT_CARD.showMemberSince)&&memberSinceVisible;
    const availability=statusVisible?String(row.availability??'offline'):'hidden';
    const verified=showStatus?Boolean(row.is_verified):null;
    const owner=showStatus?Boolean(row.is_owner):null;
    const admin=showStatus?Boolean(row.is_admin):null;

    return {
      id,
      displayName:String(row.display_name??row.username??'Member'),
      username:usernameVisible?String(row.username??''):null,
      verified,owner,admin,
      memberSince:showMemberSince?Number(row.created_at??0):null,
      profile:{
        card:{
          displayName:String(row.display_name??row.username??'Member'),
          headline:headlineVisible&&row.headline?String(row.headline):null,
          bio:bioVisible&&row.bio?String(row.bio):null,
          location:locationVisible&&row.location?String(row.location):null,
          websiteUrl:websiteVisible&&row.website_url?String(row.website_url):null,
          avatarMedia:avatarVisible&&row.avatar_media?String(row.avatar_media):null,
          coverMedia:coverVisible&&row.cover_media?String(row.cover_media):null,
          backgroundPrimary:text(row.background_primary,DEFAULT_CARD.backgroundPrimary),
          backgroundSecondary:text(row.background_secondary,DEFAULT_CARD.backgroundSecondary),
          backgroundAngle:number(row.background_angle,DEFAULT_CARD.backgroundAngle),
          textColour:text(row.text_colour,DEFAULT_CARD.textColour),
          borderColour:text(row.border_colour,DEFAULT_CARD.borderColour),
          showUsername:bool(row.show_username,DEFAULT_CARD.showUsername)&&usernameVisible,
          showStatus,
          showMemberSince
        },
        design:{
          cardWidth:text(row.card_width,DEFAULT_DESIGN.cardWidth),
          cardAlignment:text(row.card_alignment,DEFAULT_DESIGN.cardAlignment),
          cardSurface:text(row.card_surface,DEFAULT_DESIGN.cardSurface),
          coverHeight:number(row.cover_height,DEFAULT_DESIGN.coverHeight),
          avatarSize:number(row.avatar_size,DEFAULT_DESIGN.avatarSize),
          cardPadding:number(row.card_padding,DEFAULT_DESIGN.cardPadding),
          cardShadow:text(row.card_shadow,DEFAULT_DESIGN.cardShadow),
          cardBorderWidth:number(row.card_border_width,DEFAULT_DESIGN.cardBorderWidth),
          showCover:bool(row.show_cover,DEFAULT_DESIGN.showCover)&&coverVisible,
          showAvatar:bool(row.show_avatar,DEFAULT_DESIGN.showAvatar)&&avatarVisible,
          showHeadline:bool(row.show_headline,DEFAULT_DESIGN.showHeadline)&&headlineVisible,
          showBio:bool(row.show_bio,DEFAULT_DESIGN.showBio)&&bioVisible,
          showLocation:bool(row.show_location,DEFAULT_DESIGN.showLocation)&&locationVisible,
          showWebsite:bool(row.show_website,DEFAULT_DESIGN.showWebsite)&&websiteVisible
        }
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
  return json({ok:true,viewer:{id:viewer.id,verified:viewer.isVerified,admin:viewer.isAdmin},members,total:members.length});
}