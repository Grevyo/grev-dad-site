export const SESSION_COOKIE = "grevdad_session";
export const SESSION_TTL_DAYS = 30;

export function getSessionToken(request) {
  const match = (request.headers.get("Cookie") || "").match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function createSessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_DAYS * 86400}; SameSite=Lax; Secure`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}
