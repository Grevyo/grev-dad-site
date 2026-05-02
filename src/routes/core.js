import { getAdminRoutes } from "./admin.js";
import { getAuthRoutes } from "./auth.js";
import { getChatRoutes } from "./chat.js";
import { getForumRoutes } from "./forum.js";
import { getMetaRoutes } from "./meta.js";
import { getUserRoutes } from "./users.js";

function matchesRoute(route, pathname, method) {
  return route.path === pathname && route.method === method;
}

export async function dispatchCoreRoute(request, env, ctx, handlers) {
  const { pathname } = new URL(request.url);

  const routes = [
    ...getMetaRoutes(handlers),
    ...getAuthRoutes(handlers),
    ...getUserRoutes(handlers),
    ...getChatRoutes(handlers),
    ...getForumRoutes(handlers),
    ...getAdminRoutes(handlers)
  ];

  const route = routes.find((candidate) => matchesRoute(candidate, pathname, request.method));
  if (!route) return null;

  return await route.handler(request, env, ctx);
}

export function isLegacyCasesPath(pathname) {
  return pathname.startsWith("/api/cases");
}
