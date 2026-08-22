import existingWorker from './worker';
import { handleGrevHomeRequest, type GrevHomeEnv } from './grev-home';

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

type AppEnv = GrevHomeEnv & {
  ASSETS: AssetsBinding;
};

type ExistingWorker = {
  fetch(request: Request, env: AppEnv): Promise<Response>;
  scheduled?: (
    controller: unknown,
    env: AppEnv,
    ctx: { waitUntil(promise: Promise<unknown>): void }
  ) => Promise<void>;
};

const delegate = existingWorker as unknown as ExistingWorker;

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

async function isBrowserAuthenticated(request: Request, env: AppEnv): Promise<boolean> {
  const sessionUrl = new URL('/api/auth/session', request.url);
  const sessionRequest = new Request(sessionUrl.toString(), {
    method: 'GET',
    headers: request.headers,
    redirect: 'manual'
  });

  try {
    const response = await delegate.fetch(sessionRequest, env);
    if (!response.ok) return false;
    const payload = await response.json() as { authenticated?: boolean };
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/grev-home/')) {
      try {
        const response = await handleGrevHomeRequest(request, env);
        return response ?? workerJson({ ok:false, message:'Unknown Grev Home API route.' }, 404);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'UNKNOWN';
        if (message === 'JSON_REQUIRED' || message === 'INVALID_BODY' || error instanceof SyntaxError) {
          return workerJson({ ok:false, message:'A valid JSON request body is required.' }, 400);
        }
        console.error('Grev Home API request failed', error);
        return workerJson({ ok:false, message:'The Grev Home request could not be completed.' }, 500);
      }
    }

    if (request.method === 'GET' && url.pathname === '/link-grev-home') {
      if (!await isBrowserAuthenticated(request, env)) {
        const login = new URL('/login', url);
        login.searchParams.set('next', `${url.pathname}${url.search}`);
        return Response.redirect(login.toString(), 303);
      }

      const assetUrl = new URL('/link-grev-home.html', url);
      assetUrl.search = url.search;
      return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
    }

    return delegate.fetch(request, env);
  },

  async scheduled(
    controller: unknown,
    env: AppEnv,
    ctx: { waitUntil(promise: Promise<unknown>): void }
  ): Promise<void> {
    if (delegate.scheduled) {
      await delegate.scheduled(controller, env, ctx);
    }
  }
};
