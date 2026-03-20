function getCookieValue(cookieHeader, name) {
  const cookies = String(cookieHeader || "").split(";");
  for (const part of cookies) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

const PROTECTED_PATHS = ["/members.html", "/profile.html","/admin.html"];

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!PROTECTED_PATHS.includes(url.pathname)) {
    return context.next();
  }

  const sessionToken = getCookieValue(request.headers.get("Cookie"), "session_token");
  if (!sessionToken) {
    return Response.redirect(new URL("/login.html?msg=Please%20log%20in.", request.url), 302);
  }

  const row = await env.DB.prepare(`
    SELECT users.id
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.session_token = ?
      AND sessions.expires_at > ?
      AND users.approved = 1
  `)
    .bind(sessionToken, new Date().toISOString())
    .first();

  if (!row) {
    return Response.redirect(new URL("/login.html?msg=Please%20log%20in.", request.url), 302);
  }

  return context.next();
}