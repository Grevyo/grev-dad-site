import { getAuthRoutes } from "./auth.js";

function matchesRoute(route, pathname, method) {
  return route.path === pathname && route.method === method;
}

export async function dispatchCoreRoute(request, env, ctx, handlers) {
  const { pathname } = new URL(request.url);
  const routes = [...getAuthRoutes(handlers)];
  const route = routes.find((candidate) => matchesRoute(candidate, pathname, request.method));
  if (!route) return null;
  return route.handler(request, env, ctx);
}
