import app from './index';
import { handleDashboardRequest, type DashboardEnv } from './dashboard';
import { type ProfileEnv } from './profile';
import { handleProfileMediaRequest } from './profile-media';
import { handleProfileCardTilesRequest } from './profile-card-tiles';
import { handleProfileCustomizationHardeningRequest } from './profile-customization-hardening';

type AppEnv = Parameters<typeof app.fetch>[1];

const DASHBOARD_ASSETS = new Set([
  '/dashboard.css',
  '/dashboard.js',
  '/admin-dashboard.js',
  '/feature.js',
  '/profile.css',
  '/profile.js',
  '/profile-card.js',
  '/profile-card-tiles.css',
  '/profile-card-tiles.js',
  '/profile-customization.css',
  '/profile-customization.js',
  '/profile-customization-hardening.js'
]);

function workerJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  });
}

function invalidIntentionsResponse(): Response {
  return workerJson({ ok: false, message: 'Choose at least one intention.' }, 400);
}

async function bundledProfileCustomization(request: Request, env: AppEnv): Promise<Response> {
  const assets = (env as unknown as DashboardEnv).ASSETS;
  const baseUrl = new URL(request.url);
  const hardeningUrl = new URL('/profile-customization-hardening.js', baseUrl);
  const [baseResponse, hardeningResponse] = await Promise.all([
    assets.fetch(request),
    assets.fetch(new Request(hardeningUrl.toString(), request))
  ]);
  if (!baseResponse.ok) return baseResponse;
  const content = `${await baseResponse.text()}\n${hardeningResponse.ok ? await hardeningResponse.text() : ''}`;
  const headers = new Headers(baseResponse.headers);
  headers.delete('Content-Length');
  headers.set('Content-Type', 'application/javascript; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(content, { status: baseResponse.status, headers });
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/profile-customization.js') {
      return bundledProfileCustomization(request, env);
    }
    if (request.method === 'GET' && DASHBOARD_ASSETS.has(url.pathname)) {
      return (env as unknown as DashboardEnv).ASSETS.fetch(request);
    }

    if (request.method === 'POST' && url.pathname === '/api/onboarding/intentions') {
      try {
        const body = await request.clone().json() as { intentionIds?: unknown };
        if (Array.isArray(body.intentionIds)) {
          const normalized = [...new Set(
            body.intentionIds
              .filter((value): value is string => typeof value === 'string')
              .map(value => value.trim())
              .filter(Boolean)
          )];

          if (normalized.length === 0) return invalidIntentionsResponse();
        }
      } catch {
        // The existing API handler returns the normal invalid-body response.
      }
    }

    try {
      const customizationResponse = await handleProfileCustomizationHardeningRequest(request, env as unknown as ProfileEnv);
      if (customizationResponse) return customizationResponse;
      const cardTileResponse = await handleProfileCardTilesRequest(request, env as unknown as ProfileEnv);
      if (cardTileResponse) return cardTileResponse;
      const profileResponse = await handleProfileMediaRequest(request, env as unknown as ProfileEnv);
      if (profileResponse) return profileResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (message === 'JSON_REQUIRED' || message === 'INVALID_BODY' || error instanceof SyntaxError) {
        return workerJson({ ok: false, message: 'A valid JSON request body is required.' }, 400);
      }
      console.error('Profile request failed', error);
      return workerJson({ ok: false, message: 'The profile request could not be completed.' }, 500);
    }

    try {
      const dashboardResponse = await handleDashboardRequest(request, env as unknown as DashboardEnv);
      if (dashboardResponse) return dashboardResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (message === 'JSON_REQUIRED' || message === 'INVALID_BODY' || error instanceof SyntaxError) {
        return workerJson({ ok: false, message: 'A valid JSON request body is required.' }, 400);
      }
      console.error('Dashboard request failed', error);
      return workerJson({ ok: false, message: 'The dashboard request could not be completed.' }, 500);
    }

    return app.fetch(request, env);
  }
};
