// grev.dad v2: the Grev Home companion site. Serves the sign-in pages, the single app page for
// Home / Profile / Friends / Grev Home / Settings / Admin, the v2 API, and the few account APIs it
// keeps from the original site (sign-in, sign-up, sign-out, owner set-up, admin accounts).
// Grev Home's own /api/grev-home/* routes are handled before this, in worker-grev-home.ts.
import legacyApi from './index';
import { handleSiteApiRequest, type SiteEnv } from './site-api';
import { handleWebSocialRequest, sessionUser, type GrevHomeEnv } from './grev-home';
import { handleWebMessages } from './grev-home-messages';
import { json } from './shared/http-security';

interface AssetsBinding { fetch(request: Request): Promise<Response> }
type Env = SiteEnv & { ASSETS: AssetsBinding };
type LegacyWorker = { fetch(request: Request, env: unknown): Promise<Response> };

const GREV_HOME_INSTALLER_URL = 'https://github.com/Grevyo/Grev-Home/releases/latest/download/GrevHomeSetup.exe';

/** Account APIs kept from the original site. Everything else it offered is retired. */
const KEPT_API = [
  /^\/api\/health$/, /^\/api\/auth\/(session|login|logout|signup)$/, /^\/api\/bootstrap\/(owner|owner-status)$/,
  /^\/api\/account\/username$/, /^\/api\/admin\/summary$/, /^\/api\/admin\/users(\/[0-9a-f-]+(\/(verification|status|administrator))?)?$/i
];

const STATIC_PREFIXES = ['/app/', '/achievement-badges/'];
const STATIC_FILES = new Set(['/lock-screen.js', '/lock-screen.css', '/grev-ambient.js', '/grev-home-logo.png', '/grev-dad-logo.svg', '/favicon.svg']);

/** App sections, each served by the one app page; the client router draws the right view. */
const APP_ROUTES = [/^\/home$/, /^\/profile(\/[^/]+)?$/, /^\/friends(\/[0-9a-f-]{36})?$/i, /^\/grev-home$/, /^\/settings$/, /^\/admin$/];

/** Pages from the original site, sent to their nearest new home. */
const LEGACY_REDIRECTS: [RegExp, string][] = [
  [/^\/dashboard$/, '/home'], [/^\/members$/, '/friends'], [/^\/(hub|news|intentions|access|feature(\/.*)?)$/, '/home'],
  [/^\/admin\/.+$/, '/admin'], [/^\/admin\/news$/, '/admin'], [/^\/owner-setup$/, '/settings']
];

function withPageHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if ((headers.get('Content-Type') ?? '').includes('text/html')) headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function asset(env: Env, request: Request, path: string): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = path;
  url.search = '';
  return env.ASSETS.fetch(new Request(url.toString(), request));
}

const redirect = (to: string, status = 302) => new Response(null, { status, headers: { Location: to, 'Cache-Control': 'no-store' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path.startsWith('/api/')) {
        const v2 = await handleWebSocialRequest(request, env as unknown as GrevHomeEnv)
          ?? await handleWebMessages(request, env as unknown as GrevHomeEnv)
          ?? await handleSiteApiRequest(request, env);
        if (v2) return v2;
        if (KEPT_API.some(pattern => pattern.test(path))) return (legacyApi as unknown as LegacyWorker).fetch(request, env);
        return json({ ok: false, message: 'Not found.' }, 404);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, message: 'Method not allowed.' }, 405);

      if (path === '/download/grev-home') return redirect(GREV_HOME_INSTALLER_URL);
      if (path === '/grev-dad-logo-full.png') return asset(env, request, '/0E07EA15-2E29-46CD-B7BE-437938DDC552.png');
      if (STATIC_FILES.has(path) || STATIC_PREFIXES.some(prefix => path.startsWith(prefix))) return env.ASSETS.fetch(request);

      const user = await sessionUser(request, env as unknown as GrevHomeEnv);
      if (path === '/' || path === '/login') return user ? redirect(safeNext(url) ?? '/home') : withPageHeaders(await asset(env, request, '/login.html'));
      if (path === '/signup') return user ? redirect('/home') : withPageHeaders(await asset(env, request, '/signup.html'));
      if (path === '/profile' && user) return redirect(`/profile/${encodeURIComponent(user.username)}`);
      if (APP_ROUTES.some(pattern => pattern.test(path))) {
        if (!user) return redirect(`/login?next=${encodeURIComponent(path + url.search)}`);
        if (path === '/admin' && !user.isAdmin) return redirect('/home');
        return withPageHeaders(await asset(env, request, '/app/app.html'));
      }
      for (const [pattern, to] of LEGACY_REDIRECTS) if (pattern.test(path)) return redirect(to, 301);
      return withPageHeaders(new Response(await (await asset(env, request, '/app/404.html')).text(), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      if (message === 'JSON_REQUIRED' || message === 'INVALID_BODY' || error instanceof SyntaxError) return json({ ok: false, message: 'A valid JSON request body is required.' }, 400);
      console.error('grev.dad request failed', error);
      return json({ ok: false, message: 'Something went wrong. Please try again.' }, 500);
    }
  }
};

/** ?next= only ever sends people to a path on this site. */
function safeNext(url: URL): string | null {
  const next = url.searchParams.get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}
