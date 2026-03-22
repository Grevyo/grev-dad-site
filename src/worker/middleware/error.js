import { json } from "../lib/response.js";

// Centralized error handling makes the worker entry point small and keeps unexpected failures consistent.
export async function withErrorHandling(handler, request, env, ctx) {
  try {
    return await handler(request, env, ctx);
  } catch (error) {
    console.error("Unhandled worker error:", error);
    return json({ success: false, error: error?.message || "Internal server error" }, 500);
  }
}
