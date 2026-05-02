import { currentUser } from "./sessions.js";

export async function requireAdmin(request, env) {
  const u = await currentUser(request, env);
  return u && (Number(u.is_admin) === 1 || u.role === "admin") ? u : null;
}
