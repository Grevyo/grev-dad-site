import { type ProfileEnv } from './profile';
import { handleProfileCustomizationRequest } from './profile-customization';

type ProfilePayload = {
  profile?: {
    id?: unknown;
    design?: { avatarSize?: number };
  };
};

function responseWithPayload(response: Response, payload: unknown): Response {
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function handleProfileCustomizationHardeningRequest(request: Request, env: ProfileEnv): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== '/api/profile' || request.method !== 'PUT') {
    return handleProfileCustomizationRequest(request, env);
  }

  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.clone().json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return handleProfileCustomizationRequest(request, env);
    }
    body = value as Record<string, unknown>;
  } catch {
    return handleProfileCustomizationRequest(request, env);
  }

  const rawDesign = body.design;
  if (!rawDesign || typeof rawDesign !== 'object' || Array.isArray(rawDesign)) {
    return handleProfileCustomizationRequest(request, env);
  }
  const design = rawDesign as Record<string, unknown>;
  if (Number(design.avatarSize) !== 132) {
    return handleProfileCustomizationRequest(request, env);
  }

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete('Content-Length');
  forwardedHeaders.set('Content-Type', 'application/json');
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: forwardedHeaders,
    body: JSON.stringify({
      ...body,
      design: { ...design, avatarSize: 120 }
    }),
    redirect: request.redirect
  });

  const response = await handleProfileCustomizationRequest(forwardedRequest, env);
  if (!response || !response.ok) return response;
  const payload = await response.json() as ProfilePayload;
  const profileId = typeof payload.profile?.id === 'string' ? payload.profile.id : null;
  if (!profileId) return responseWithPayload(response, payload);

  await env.DB.prepare(`UPDATE user_profile_design SET avatar_size=132 WHERE user_id=?`).bind(profileId).run();
  if (payload.profile?.design) payload.profile.design.avatarSize = 132;
  return responseWithPayload(response, payload);
}
