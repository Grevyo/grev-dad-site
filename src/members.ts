import { getProfileCardViewer, loadProfileCardBaselines, type ProfileCardBaselineEnv } from './profile-card-baseline';

export type MembersEnv = ProfileCardBaselineEnv;

function json(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'}});}

export async function handleMembersRequest(request:Request,env:MembersEnv):Promise<Response|null>{
  const url=new URL(request.url);
  if(url.pathname!=='/api/members')return null;
  if(request.method!=='GET')return json({ok:false,message:'Method not allowed.'},405);
  const viewer=await getProfileCardViewer(request,env);
  if(!viewer)return json({ok:false,message:'Authentication required.'},401);

  const rows=await env.DB.prepare(`
    SELECT u.id
    FROM users u
    WHERE u.status='active'
      AND NOT EXISTS(
        SELECT 1 FROM profile_blocks b
        WHERE (b.owner_user_id=? AND b.blocked_user_id=u.id)
           OR (b.owner_user_id=u.id AND b.blocked_user_id=?)
      )
    ORDER BY u.is_owner DESC,
      CASE WHEN u.is_owner=1 OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role_id='role-admin') THEN 1 ELSE 0 END DESC,
      lower(u.display_name),lower(u.username)
    LIMIT 100
  `).bind(viewer.id,viewer.id).all<{id:string}>();

  const members=await loadProfileCardBaselines(env,viewer,rows.results.map(row=>row.id));
  return json({
    ok:true,
    viewer:{id:viewer.id,verified:viewer.isVerified,owner:viewer.isOwner,admin:viewer.isAdmin},
    members,
    total:members.length,
    contract:'profile-card-baseline-v2'
  });
}