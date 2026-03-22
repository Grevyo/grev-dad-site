import { json } from "../lib/response.js";

// A tiny health endpoint gives CI and uptime checks a stable place to verify the worker.
export function handleHealth() {
  return json({ success: true, message: "grev.dad worker is running" });
}
