import legacyWorker from "./legacy-router.js";
import { handleContact } from "./handlers/contact.js";
import { handleHealth } from "./handlers/health.js";

// This router owns the new modular entry points and delegates older routes to the preserved legacy worker.
export async function routeRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (url.pathname === "/api/health" && request.method === "GET") {
    return handleHealth();
  }

  if (url.pathname === "/api/contact" && request.method === "POST") {
    return handleContact(request, env, ctx);
  }

  return legacyWorker.fetch(request, env, ctx);
}
