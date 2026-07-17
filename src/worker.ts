import app from './index';
import { handleDashboardRequest, type DashboardEnv } from './dashboard';

type AppEnv = Parameters<typeof app.fetch>[1];

function invalidIntentionsResponse(): Response {
  return new Response(JSON.stringify({ ok: false, message: 'Choose at least one intention.' }), {
    status: 400,
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

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);

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

    const dashboardResponse = await handleDashboardRequest(request, env as unknown as DashboardEnv);
    if (dashboardResponse) return dashboardResponse;

    return app.fetch(request, env);
  }
};
