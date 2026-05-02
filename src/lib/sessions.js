import { getSessionToken } from "./cookies.js";
import { hashToken } from "./auth.js";

export async function currentUser(request, env) {
  const token = getSessionToken(request);
  if (!token) return null;
  return env.DB.prepare(`SELECT u.id, u.username, u.role, u.is_admin, b.balance_cents FROM sessions s JOIN users u ON u.id = s.user_id LEFT JOIN balances b ON b.user_id=u.id WHERE s.token=? AND s.expires_at>? LIMIT 1`).bind(hashToken(token), new Date().toISOString()).first();
}
