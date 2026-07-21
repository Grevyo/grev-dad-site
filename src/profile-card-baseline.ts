interface D1Result<T> { results: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(query: string): D1Statement; }

export interface ProfileCardBaselineEnv { DB: D1Database; }
export type ProfileCardViewer = { id:string; isVerified:boolean; isOwner:boolean; isAdmin:boolean };
type Privacy = { visibility:'all'|'verified'|'groups'|'private'; groupId:string|null };
type Feature = { id:string; name:string; description:string; category:string; route:string; iconText:string; presentation:'action'|'content' };

const COOKIE='grev_session';
const encoder=new TextEncoder();
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH=100;
const CONTRACT='profile-card-baseline-v2';
const CARD_GRID={columns:4,maxTiles:4,maxY:7};
const DEFAULT_CARD={
  backgroundPrimary:'#11161d',backgroundSecondary:'#3157c9',backgroundAngle:135,
  textColour:'#f4f7fb',borderColour:'#526074',showUsername:true,showStatus:true,showMemberSince:true
};
const DEFAULT_DESIGN={
  cardWidth:'full',cardAlignment:'centre',cardSurface:'gradient',coverHeight:180,avatarSize:132,
  cardPadding:28,cardShadow:'large',cardBorderWidth:1,showCover:true,showAvatar:true,
  showHeadline:true,showBio:true,showLocation:true,showWebsite:true,cardTileGap:10,cardTileRowHeight:92
};

function base64Url(bytes:Uint8Array):string{return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
async function sha256(value:string):Promise<string>{return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
function cookies(request:Request):Record<string,string>{return Object.fromEntries((request.headers.get('Cookie')??'').split(';').map(value=>value.trim()).filter(Boolean).map(value=>{const index=value.indexOf('=');return index<0?['','']:[value.slice(0,index),decodeURIComponent(value.slice(index+1))];}).filter(([key])=>key));}
function json(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'}});}
function text(value:unknown,fallback:string|null=null):string|null{return value===null||value===undefined||value===''?fallback:String(value);}
function number(value:unknown,fallback:number):number{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}
function bool(value:unknown,fallback:boolean):boolean{return value===null||value===undefined?fallback:Boolean(value);}
function placeholders(values:unknown[]):string{return values.map(()=>'?').join(',');}

export async function getProfileCardViewer(request:Request,env:ProfileCardBaselineEnv):Promise<ProfileCardViewer|null>{
  const token=cookies(request)[COOKIE];if(!token)return null;
  const row=await env.DB.prepare(`
    SELECT u.id,u.is_verified,u.is_owner,
      CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.status='active'
  `).bind(await sha256(token),Math.floor(Date.now()/1000)).first<{id:string;is_verified:number;is_owner:number;is_admin:number}>();
  return row?{id:row.id,isVerified:Boolean(row.is_verified),isOwner:Boolean(row.is_owner),isAdmin:Boolean(row.is_admin)}:null;
}

function canSee(viewer:ProfileCardViewer,targetId:string,record:Privacy|undefined,viewerGroups:Set<string>):boolean{
  if(viewer.id===targetId||viewer.isAdmin)return true;
  if(!record||record.visibility==='all')return true;
  if(record.visibility==='verified')return viewer.isVerified;
  if(record.visibility==='groups')return Boolean(record.groupId&&viewerGroups.has(record.groupId));
  return false;
}

async function accessibleFeatures(env:ProfileCardBaselineEnv,viewer:ProfileCardViewer):Promise<Map<string,Feature>>{
  const rows=await env.DB.prepare(`
    SELECT f.id,f.name,f.description,f.category,f.route,f.icon_text,f.tile_presentation
    FROM dashboard_features f
    WHERE f.is_active=1 AND (
      ?=1 OR f.audience='all'
      OR (f.audience='admin' AND ?=1)
      OR (f.audience='owner' AND ?=1)
      OR (f.audience='groups' AND EXISTS(
        SELECT 1 FROM dashboard_feature_group_grants fg
        JOIN group_memberships gm ON gm.group_id=fg.group_id
        WHERE fg.feature_id=f.id AND gm.user_id=?
      ))
    )
  `).bind(viewer.isOwner?1:0,viewer.isAdmin?1:0,viewer.isOwner?1:0,viewer.id).all<Record<string,unknown>>();
  return new Map(rows.results.map(row=>[String(row.id),{
    id:String(row.id),name:String(row.name??''),description:String(row.description??''),category:String(row.category??''),
    route:String(row.route??''),iconText:String(row.icon_text??''),presentation:row.tile_presentation==='content'?'content':'action'
  }]));
}

export async function loadProfileCardBaselines(env:ProfileCardBaselineEnv,viewer:ProfileCardViewer,requestedIds:string[]):Promise<Record<string,unknown>[]>{
  const ids=[...new Set(requestedIds.filter(id=>UUID_RE.test(id)))].slice(0,MAX_BATCH);
  if(!ids.length)return [];
  const marks=placeholders(ids);
  const [rows,privacyRows,groupRows,tileRows,mediaRows,features]=await Promise.all([
    env.DB.prepare(`
      SELECT u.id,u.username,u.display_name,u.is_verified,u.is_owner,u.created_at,
        CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END AS is_admin,
        p.headline,p.bio,p.location,p.website_url,p.avatar_media,p.cover_media,
        p.background_primary,p.background_secondary,p.background_angle,p.text_colour,p.border_colour,
        p.show_username,p.show_status,p.show_member_since,
        d.card_width,d.card_alignment,d.card_surface,d.cover_height,d.avatar_size,d.card_padding,
        d.card_shadow,d.card_border_width,d.show_cover,d.show_avatar,d.show_headline,d.show_bio,d.show_location,d.show_website,
        d.card_tile_gap,d.card_tile_row_height,
        pr.availability,pr.status_text,pr.activity_type,pr.activity_text,pr.updated_at AS presence_updated_at
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id=u.id
      LEFT JOIN user_profile_design d ON d.user_id=u.id
      LEFT JOIN user_presence pr ON pr.user_id=u.id
      WHERE u.status='active' AND u.id IN (${marks})
    `).bind(...ids).all<Record<string,unknown>>(),
    env.DB.prepare(`SELECT user_id,field_key,visibility,group_id FROM user_profile_field_privacy WHERE user_id IN (${marks}) AND field_key IN ('username','headline','bio','location','website','avatar','cover','status','memberSince')`).bind(...ids).all<{user_id:string;field_key:string;visibility:Privacy['visibility'];group_id:string|null}>(),
    env.DB.prepare(`SELECT group_id FROM group_memberships WHERE user_id=?`).bind(viewer.id).all<{group_id:string}>(),
    env.DB.prepare(`
      SELECT user_id,tile_id,tile_kind,feature_id,position,grid_x,grid_y,tile_width,tile_height,title,description,
        link_label,link_url,content_mode,custom_title,custom_icon,background_type,background_primary,
        background_secondary,background_angle,text_colour,font_family,border_colour,media_fit,media_overlay,
        icon_mode,icon_label,icon_text_colour,icon_background_colour,icon_border_colour,icon_media_fit
      FROM user_profile_card_tiles WHERE user_id IN (${marks}) ORDER BY user_id,position
    `).bind(...ids).all<Record<string,unknown>>(),
    env.DB.prepare(`SELECT user_id,tile_id,media_slot,media_data FROM user_profile_card_tile_media WHERE user_id IN (${marks})`).bind(...ids).all<Record<string,unknown>>(),
    accessibleFeatures(env,viewer)
  ]);

  const viewerGroups=new Set(groupRows.results.map(row=>row.group_id));
  const privacy=new Map<string,Privacy>();
  privacyRows.results.forEach(row=>privacy.set(`${row.user_id}:${row.field_key}`,{visibility:row.visibility,groupId:row.group_id}));
  const media=new Map(mediaRows.results.map(row=>[`${row.user_id}:${row.tile_id}:${row.media_slot}`,String(row.media_data??'')]));
  const tilesByUser=new Map<string,Record<string,unknown>[]>();
  tileRows.results.forEach(row=>{
    const userId=String(row.user_id),featureId=row.feature_id?String(row.feature_id):null;
    const feature=featureId?features.get(featureId)??null:null;
    if(row.tile_kind==='feature'&&!feature)return;
    const tile={
      tileId:String(row.tile_id),tileKind:String(row.tile_kind),featureId,position:Number(row.position),
      x:Number(row.grid_x),y:Number(row.grid_y),width:Number(row.tile_width),height:Number(row.tile_height),
      title:text(row.title),description:text(row.description),linkLabel:text(row.link_label),linkUrl:text(row.link_url),
      contentMode:String(row.content_mode??'standard'),customTitle:text(row.custom_title),customIcon:text(row.custom_icon),
      backgroundType:String(row.background_type??'solid'),backgroundPrimary:String(row.background_primary??'#11161d'),
      backgroundSecondary:String(row.background_secondary??'#5268aa'),backgroundAngle:number(row.background_angle,135),
      backgroundMedia:media.get(`${userId}:${row.tile_id}:background`)||null,textColour:String(row.text_colour??'#f4f7fb'),
      fontFamily:String(row.font_family??'system'),borderColour:String(row.border_colour??'#394657'),
      mediaFit:String(row.media_fit??'cover'),mediaOverlay:String(row.media_overlay??'dark'),iconMode:String(row.icon_mode??'text'),
      iconLabel:text(row.icon_label),iconMedia:media.get(`${userId}:${row.tile_id}:icon`)||null,
      iconTextColour:String(row.icon_text_colour??'#090b0f'),iconBackgroundColour:String(row.icon_background_colour??'#f3f5f8'),
      iconBorderColour:String(row.icon_border_colour??'#667181'),iconMediaFit:String(row.icon_media_fit??'cover'),feature
    };
    const list=tilesByUser.get(userId)??[];list.push(tile);tilesByUser.set(userId,list);
  });

  const order=new Map(ids.map((id,index)=>[id,index]));
  return rows.results.map(row=>{
    const id=String(row.id);
    const visible=(key:string)=>canSee(viewer,id,privacy.get(`${id}:${key}`),viewerGroups);
    const usernameVisible=visible('username'),statusVisible=visible('status'),memberSinceVisible=visible('memberSince');
    const headlineVisible=visible('headline'),bioVisible=visible('bio'),locationVisible=visible('location'),websiteVisible=visible('website');
    const avatarVisible=visible('avatar'),coverVisible=visible('cover');
    const showStatus=bool(row.show_status,DEFAULT_CARD.showStatus)&&statusVisible;
    const showMemberSince=bool(row.show_member_since,DEFAULT_CARD.showMemberSince)&&memberSinceVisible;
    const availability=statusVisible?String(row.availability??'offline'):'hidden';
    return {
      contract:CONTRACT,
      id,displayName:String(row.display_name??row.username??'Member'),username:usernameVisible?String(row.username??''):null,
      isVerified:showStatus?Boolean(row.is_verified):null,isOwner:showStatus?Boolean(row.is_owner):null,isAdmin:showStatus?Boolean(row.is_admin):null,
      createdAt:showMemberSince?Number(row.created_at??0):null,
      card:{
        displayName:String(row.display_name??row.username??'Member'),headline:headlineVisible&&row.headline?String(row.headline):null,
        bio:bioVisible&&row.bio?String(row.bio):null,location:locationVisible&&row.location?String(row.location):null,
        websiteUrl:websiteVisible&&row.website_url?String(row.website_url):null,avatarMedia:avatarVisible&&row.avatar_media?String(row.avatar_media):null,
        coverMedia:coverVisible&&row.cover_media?String(row.cover_media):null,backgroundPrimary:text(row.background_primary,DEFAULT_CARD.backgroundPrimary),
        backgroundSecondary:text(row.background_secondary,DEFAULT_CARD.backgroundSecondary),backgroundAngle:number(row.background_angle,DEFAULT_CARD.backgroundAngle),
        textColour:text(row.text_colour,DEFAULT_CARD.textColour),borderColour:text(row.border_colour,DEFAULT_CARD.borderColour),
        showUsername:bool(row.show_username,DEFAULT_CARD.showUsername)&&usernameVisible,showStatus,showMemberSince
      },
      design:{
        cardWidth:text(row.card_width,DEFAULT_DESIGN.cardWidth),cardAlignment:text(row.card_alignment,DEFAULT_DESIGN.cardAlignment),
        cardSurface:text(row.card_surface,DEFAULT_DESIGN.cardSurface),coverHeight:number(row.cover_height,DEFAULT_DESIGN.coverHeight),
        avatarSize:number(row.avatar_size,DEFAULT_DESIGN.avatarSize),cardPadding:number(row.card_padding,DEFAULT_DESIGN.cardPadding),
        cardShadow:text(row.card_shadow,DEFAULT_DESIGN.cardShadow),cardBorderWidth:number(row.card_border_width,DEFAULT_DESIGN.cardBorderWidth),
        showCover:bool(row.show_cover,DEFAULT_DESIGN.showCover)&&coverVisible,showAvatar:bool(row.show_avatar,DEFAULT_DESIGN.showAvatar)&&avatarVisible,
        showHeadline:bool(row.show_headline,DEFAULT_DESIGN.showHeadline)&&headlineVisible,showBio:bool(row.show_bio,DEFAULT_DESIGN.showBio)&&bioVisible,
        showLocation:bool(row.show_location,DEFAULT_DESIGN.showLocation)&&locationVisible,showWebsite:bool(row.show_website,DEFAULT_DESIGN.showWebsite)&&websiteVisible,
        cardTileGap:number(row.card_tile_gap,DEFAULT_DESIGN.cardTileGap),cardTileRowHeight:number(row.card_tile_row_height,DEFAULT_DESIGN.cardTileRowHeight)
      },
      cardTiles:(tilesByUser.get(id)??[]).sort((a,b)=>Number(a.position)-Number(b.position)),
      cardTileGrid:CARD_GRID,
      presence:{availability,statusText:availability!=='hidden'&&row.status_text?String(row.status_text):null,activityType:availability!=='hidden'&&row.activity_type?String(row.activity_type):null,activityText:availability!=='hidden'&&row.activity_text?String(row.activity_text):null,updatedAt:availability!=='hidden'?Number(row.presence_updated_at??0):null}
    };
  }).sort((a,b)=>(order.get(String(a.id))??999)-(order.get(String(b.id))??999));
}

export async function handleProfileCardBaselineRequest(request:Request,env:ProfileCardBaselineEnv):Promise<Response|null>{
  const url=new URL(request.url);
  const single=url.pathname.match(/^\/api\/profile-cards\/([^/]+)$/);
  const batch=url.pathname==='/api/profile-cards/batch';
  if(!single&&!batch)return null;
  const viewer=await getProfileCardViewer(request,env);
  if(!viewer)return json({ok:false,message:'Authentication required.'},401);
  if(single){
    if(request.method!=='GET')return json({ok:false,message:'Method not allowed.'},405);
    const id=decodeURIComponent(single[1]??'');
    if(!UUID_RE.test(id))return json({ok:false,message:'Profile card not found.'},404);
    const [profileCard]=await loadProfileCardBaselines(env,viewer,[id]);
    return profileCard?json({ok:true,contract:CONTRACT,profileCard}):json({ok:false,message:'Profile card not found.'},404);
  }
  if(request.method!=='POST')return json({ok:false,message:'Method not allowed.'},405);
  let body:unknown;try{body=await request.json();}catch{return json({ok:false,message:'A valid JSON request body is required.'},400);}
  const ids=body&&typeof body==='object'&&!Array.isArray(body)&&Array.isArray((body as {ids?:unknown}).ids)?(body as {ids:unknown[]}).ids.filter((value):value is string=>typeof value==='string'):[];
  if(!ids.length||ids.length>MAX_BATCH)return json({ok:false,message:`Choose between 1 and ${MAX_BATCH} profile cards.`},400);
  const cards=await loadProfileCardBaselines(env,viewer,ids);
  return json({ok:true,contract:CONTRACT,cards});
}