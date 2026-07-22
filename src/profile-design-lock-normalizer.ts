import { type ProfileEnv } from './profile';
import { handleProfileCustomizationHardeningRequest } from './profile-customization-hardening';

const LOCKED_SERVER_GEOMETRY = Object.freeze({
  cardWidth: 'full',
  cardAlignment: 'centre',
  coverHeight: 180,
  avatarSize: 132,
  cardPadding: 28,
  cardBorderWidth: 1,
  cardTileGap: 10,
  cardTileRowHeight: 92
});

export async function handleProfileDesignLockNormalizerRequest(request: Request, env: ProfileEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/profile' || request.method !== 'PUT') return null;

  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.clone().json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    body = value as Record<string, unknown>;
  } catch {
    return null;
  }

  const design = body.design;
  if (!design || typeof design !== 'object' || Array.isArray(design)) return null;

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete('Content-Length');
  forwardedHeaders.set('Content-Type', 'application/json');
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: forwardedHeaders,
    body: JSON.stringify({
      ...body,
      design: { ...(design as Record<string, unknown>), ...LOCKED_SERVER_GEOMETRY }
    }),
    redirect: request.redirect
  });
  return handleProfileCustomizationHardeningRequest(forwardedRequest, env);
}
