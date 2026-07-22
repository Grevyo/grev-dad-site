import app from './index';
import { handleDashboardRequest, type DashboardEnv } from './dashboard';
import { type ProfileEnv } from './profile';
import { handleProfileMediaRequest } from './profile-media';
import { handleProfileCardTilesRequest } from './profile-card-tiles';
import { handleProfileCustomizationHardeningRequest } from './profile-customization-hardening';
import { handleProfileDesignLockNormalizerRequest } from './profile-design-lock-normalizer';
import { handleProfileTileSaveRequest } from './profile-tile-save';
import { handleProfileCardBaselineRequest, type ProfileCardBaselineEnv } from './profile-card-baseline';
import { handleExperienceRequest, type ExperienceEnv } from './experience';
import { handlePlatformRequest, type PlatformEnv } from './platform';
import { handlePlatformCompletionRequest, type PlatformCompletionEnv } from './platform-completion';
import { handleChatProgressionRequest, type ChatProgressionEnv } from './chat-progression';
import { handleAdminCentreRequest, type AdminCentreEnv } from './admin-centre';
import { handleFeedbackCentreRequest, type FeedbackCentreEnv } from './feedback-centre';
import { handleMembersRequest, type MembersEnv } from './members';
import { handleGrevNewsRequest, refreshGrevNewsSources, type GrevNewsEnv } from './grev-news';
import { applyProfilePrivacy } from './profile-privacy-hardening';

type AppEnv = Parameters<typeof app.fetch>[1];

const DASHBOARD_ASSETS = new Set([
  '/dashboard.css','/dashboard.js','/dashboard-experience.css','/dashboard-experience.js','/platform-dashboard.css','/platform-dashboard.js','/dashboard-discovery.css','/dashboard-discovery.js','/dashboard-advanced.css','/dashboard-advanced.js','/dashboard-collaboration.css','/dashboard-collaboration.js','/platform-completion.css','/platform-live-quick.js','/dashboard-freeze-fix.js','/editor-guidance.css','/editor-guidance.js',
  '/admin-dashboard.js','/admin-centre.js','/admin-centre.css','/feature.js','/profile.css','/profile.js','/profile-card.css','/profile-card.js','/profile-card-baseline.css','/profile-card-baseline.js','/profile-card-main-mount.js','/profile-card-shape-lock.js','/profile-card-tiles.css','/profile-card-tiles.js','/profile-customization.css','/profile-customization.js','/profile-canvas.css','/profile-canvas.js','/profile-tile-save-fix.js',
  '/profile-customization-hardening.js','/profile-editor-unified.css','/profile-editor-unified.js','/profile-editor-unified-a11y.js','/profile-editor-focus.css','/profile-editor-focus.js','/profile-experience.css','/profile-experience.js','/profile-guestbook-enhanced.js',
  '/platform-profile.css','/platform-profile.js','/profile-card-popover.css','/profile-card-popover.js','/site-shell.css','/site-shell.js','/site-platform.css','/site-platform.js','/chat-ui.css','/chat-ui.js','/chat-tabs.css','/chat-tabs.js','/feedback-centre.css','/feedback-centre.js','/hub.html','/hub.css','/hub.js','/members.html','/members.css','/members.js',
  '/news.html','/news.css','/news.js','/admin-news.html','/admin-news.css','/admin-news.js','/grev-dad-logo.svg'
]);

function workerJson(value: unknown, status = 200): Response { return new Response(JSON.stringify(value), { status, headers: {
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'
}}); }
function invalidIntentionsResponse(): Response { return workerJson({ ok: false, message: 'Choose at least one intention.' }, 400); }
async function bundledAsset(request: Request, env: AppEnv, appendedPaths: string[], contentType: string): Promise<Response> {
  const assets = (env as unknown as DashboardEnv).ASSETS;
  const baseUrl = new URL(request.url);
  const responses = await Promise.all([assets.fetch(request), ...appendedPaths.map(path => assets.fetch(new Request(new URL(path, baseUrl).toString(), request)))]);
  const [baseResponse, ...appendedResponses] = responses;
  if (!baseResponse?.ok) return baseResponse;
  const content = [await baseResponse.text(), ...await Promise.all(appendedResponses.filter(response => response.ok).map(response => response.text()))].join('\n');
  const headers = new Headers(baseResponse.headers); headers.delete('Content-Length'); headers.set('Content-Type', contentType); headers.set('Cache-Control','no-store');
  return new Response(content, { status: baseResponse.status, headers });
}

const PROFILE_CARD_JS=['/profile-card.js','/profile-card-baseline.js','/profile-card-popover.js'];
const PROFILE_CARD_CSS=['/profile-card.css','/profile-card-tiles.css','/profile-card-baseline.css','/profile-card-popover.css'];

export default {
  async fetch(request: Request, env: AppEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/profile-customization.js') return bundledAsset(request, env, ['/profile-customization-hardening.js'], 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/profile-card-tiles.js') return bundledAsset(request, env, ['/profile-card-baseline.js'], 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/profile-card-tiles.css') return bundledAsset(request, env, ['/profile-card-baseline.css'], 'text/css; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/dashboard.js') return bundledAsset(request, env, ['/dashboard-experience.js','/platform-dashboard.js','/dashboard-discovery.js','/dashboard-advanced.js','/dashboard-collaboration.js','/platform-live-quick.js','/feedback-centre.js'], 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/dashboard.css') return bundledAsset(request, env, ['/dashboard-experience.css','/platform-dashboard.css','/dashboard-discovery.css','/dashboard-advanced.css','/dashboard-collaboration.css','/platform-completion.css','/feedback-centre.css'], 'text/css; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/profile-editor-unified.js') return bundledAsset(request, env, ['/profile-canvas.js','/profile-editor-unified-a11y.js','/profile-experience.js','/platform-profile.js','/site-shell.js','/site-platform.js',...PROFILE_CARD_JS,'/chat-ui.js','/chat-tabs.js','/platform-live-quick.js','/profile-guestbook-enhanced.js','/feedback-centre.js'], 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/profile-editor-unified.css') return bundledAsset(request, env, ['/profile-experience.css','/platform-profile.css','/site-shell.css','/site-platform.css',...PROFILE_CARD_CSS,'/chat-ui.css','/chat-tabs.css','/platform-completion.css','/feedback-centre.css','/profile-canvas.css'], 'text/css; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/admin.js') return bundledAsset(request, env, ['/site-shell.js','/site-platform.js',...PROFILE_CARD_JS,'/chat-ui.js','/chat-tabs.js','/feedback-centre.js'], 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/admin-dashboard.js') return bundledAsset(request, env, ['/site-shell.js','/site-platform.js',...PROFILE_CARD_JS,'/chat-ui.js','/chat-tabs.js','/feedback-centre.js'], 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/feature.js') return bundledAsset(request, env, ['/site-shell.js','/site-platform.js',...PROFILE_CARD_JS,'/chat-ui.js','/chat-tabs.js','/feedback-centre.js'], 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/app.js') return bundledAsset(request, env, ['/site-shell.js','/site-platform.js',...PROFILE_CARD_JS,'/chat-ui.js','/chat-tabs.js','/feedback-centre.js'], 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/styles.css') return bundledAsset(request, env, ['/site-shell.css','/site-platform.css',...PROFILE_CARD_CSS,'/chat-ui.css','/chat-tabs.css','/feedback-centre.css'], 'text/css; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/hub.js') return bundledAsset(request, env, ['/site-shell.js','/site-platform.js',...PROFILE_CARD_JS,'/chat-ui.js','/chat-tabs.js','/feedback-centre.js'], 'application/javascript; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/hub.css') return bundledAsset(request, env, ['/site-shell.css','/site-platform.css',...PROFILE_CARD_CSS,'/chat-ui.css','/chat-tabs.css','/feedback-centre.css'], 'text/css; charset=utf-8');
    if (request.method === 'GET' && url.pathname === '/members.css') return bundledAsset(request, env, ['/profile-card.css','/profile-card-tiles.css','/profile-card-baseline.css'], 'text/css; charset=utf-8');
    if (request.method === 'GET' && (DASHBOARD_ASSETS.has(url.pathname) || url.pathname.startsWith('/achievement-badges/'))) return (env as unknown as DashboardEnv).ASSETS.fetch(request);

    if (request.method === 'GET' && ['/hub','/members','/news','/admin/news'].includes(url.pathname)) {
      const sessionRequest = new Request(new URL('/api/auth/session', url).toString(), request);
      const session = await app.fetch(sessionRequest, env).then(response => response.json()).catch(() => ({ authenticated: false })) as { authenticated?: boolean; user?: { isAdmin?: boolean } };
      if (!session.authenticated) return Response.redirect(new URL('/login', url).toString(), 303);
      if (url.pathname === '/admin/news' && !session.user?.isAdmin) return Response.redirect(new URL('/dashboard', url).toString(), 303);
      const page = url.pathname === '/members' ? '/members.html' : url.pathname === '/hub' ? '/hub.html' : url.pathname === '/admin/news' ? '/admin-news.html' : '/news.html';
      return (env as unknown as DashboardEnv).ASSETS.fetch(new Request(new URL(page, url).toString(), request));
    }

    if (request.method === 'POST' && url.pathname === '/api/onboarding/intentions') {
      try { const payload = await request.clone().json() as { intentionIds?: unknown }; if (Array.isArray(payload.intentionIds)) { const normalized=[...new Set(payload.intentionIds.filter((value):value is string=>typeof value==='string').map(value=>value.trim()).filter(Boolean))]; if (!normalized.length) return invalidIntentionsResponse(); } } catch {}
    }

    try { const response = await handleGrevNewsRequest(request, env as unknown as GrevNewsEnv); if (response) return response; }
    catch (error) { console.error('Grev News request failed', error); return workerJson({ ok:false, message:'Grev News could not be loaded.' }, 500); }
    try { const response = await handleProfileCardBaselineRequest(request, env as unknown as ProfileCardBaselineEnv); if (response) return response; }
    catch (error) { console.error('Profile card baseline request failed',error); return workerJson({ok:false,message:'The profile card could not be loaded.'},500); }
    try { const response = await handleMembersRequest(request, env as unknown as MembersEnv); if (response) return response; }
    catch (error) { console.error('Members request failed',error); return workerJson({ok:false,message:'The members directory could not be loaded.'},500); }
    try { const response = await handleFeedbackCentreRequest(request, env as unknown as FeedbackCentreEnv); if (response) return response; }
    catch (error) { const message=error instanceof Error?error.message:'UNKNOWN'; if (message==='JSON_REQUIRED'||message==='INVALID_BODY'||error instanceof SyntaxError) return workerJson({ok:false,message:'A valid JSON request body is required.'},400); console.error('Feedback centre request failed',error); return workerJson({ok:false,message:'The feedback or release request could not be completed.'},500); }
    try { const response = await handleAdminCentreRequest(request, env as unknown as AdminCentreEnv); if (response) return response; }
    catch (error) { const message=error instanceof Error?error.message:'UNKNOWN'; if (message==='JSON_REQUIRED'||message==='INVALID_BODY'||error instanceof SyntaxError) return workerJson({ok:false,message:'A valid JSON request body is required.'},400); console.error('Admin centre request failed',error); return workerJson({ok:false,message:'The admin centre request could not be completed.'},500); }
    try { const response = await handleChatProgressionRequest(request, env as unknown as ChatProgressionEnv); if (response) return response; }
    catch (error) { const message=error instanceof Error?error.message:'UNKNOWN'; if (message==='JSON_REQUIRED'||message==='INVALID_BODY'||error instanceof SyntaxError) return workerJson({ok:false,message:'A valid JSON request body is required.'},400); console.error('Chat/progression request failed',error); return workerJson({ok:false,message:'The chat or progression request could not be completed.'},500); }
    try { const response = await handlePlatformCompletionRequest(request, env as unknown as PlatformCompletionEnv); if (response) return response; }
    catch (error) { const message=error instanceof Error?error.message:'UNKNOWN'; if (message==='JSON_REQUIRED'||message==='INVALID_BODY'||error instanceof SyntaxError) return workerJson({ok:false,message:'A valid JSON request body is required.'},400); console.error('Platform completion request failed',error); return workerJson({ok:false,message:'The live dashboard or profile interaction request could not be completed.'},500); }
    try { const response = await handlePlatformRequest(request, env as unknown as PlatformEnv); if (response) return response; }
    catch (error) { const message=error instanceof Error?error.message:'UNKNOWN'; if (message==='JSON_REQUIRED'||message==='INVALID_BODY'||error instanceof SyntaxError) return workerJson({ok:false,message:'A valid JSON request body is required.'},400); console.error('Platform request failed',error); return workerJson({ok:false,message:'The content, layout or community request could not be completed.'},500); }
    try { const response = await handleExperienceRequest(request, env as unknown as ExperienceEnv); if (response) return response; }
    catch (error) { const message=error instanceof Error?error.message:'UNKNOWN'; if (message==='JSON_REQUIRED'||message==='INVALID_BODY'||error instanceof SyntaxError) return workerJson({ok:false,message:'A valid JSON request body is required.'},400); console.error('Experience request failed',error); return workerJson({ok:false,message:'The dashboard or profile experience request could not be completed.'},500); }
    try {
      const profileEnv = env as unknown as ProfileEnv;
      const tileSaveResponse = await handleProfileTileSaveRequest(request, profileEnv); if (tileSaveResponse) return applyProfilePrivacy(request, profileEnv, tileSaveResponse);
      const normalizedCustomizationResponse = await handleProfileDesignLockNormalizerRequest(request, profileEnv); if (normalizedCustomizationResponse) return applyProfilePrivacy(request, profileEnv, normalizedCustomizationResponse);
      const customizationResponse = await handleProfileCustomizationHardeningRequest(request, profileEnv); if (customizationResponse) return applyProfilePrivacy(request, profileEnv, customizationResponse);
      const cardTileResponse = await handleProfileCardTilesRequest(request, profileEnv); if (cardTileResponse) return applyProfilePrivacy(request, profileEnv, cardTileResponse);
      const profileResponse = await handleProfileMediaRequest(request, profileEnv); if (profileResponse) return applyProfilePrivacy(request, profileEnv, profileResponse);
    } catch (error) { const message=error instanceof Error?error.message:'UNKNOWN'; if (message==='JSON_REQUIRED'||message==='INVALID_BODY'||error instanceof SyntaxError) return workerJson({ok:false,message:'A valid JSON request body is required.'},400); console.error('Profile request failed',error); return workerJson({ok:false,message:'The profile request could not be completed.'},500); }
    try { const response = await handleDashboardRequest(request, env as unknown as DashboardEnv); if (response) return response; }
    catch (error) { const message=error instanceof Error?error.message:'UNKNOWN'; if (message==='JSON_REQUIRED'||message==='INVALID_BODY'||error instanceof SyntaxError) return workerJson({ok:false,message:'A valid JSON request body is required.'},400); console.error('Dashboard request failed',error); return workerJson({ok:false,message:'The dashboard request could not be completed.'},500); }
    return app.fetch(request, env);
  },
  async scheduled(_controller: unknown, env: AppEnv, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(refreshGrevNewsSources(env as unknown as GrevNewsEnv));
  }
};
