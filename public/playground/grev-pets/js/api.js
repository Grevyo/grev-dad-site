export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data;
}

export async function requireAuthOrRedirect() {
  const meRes = await fetch("/api/auth/me", { credentials: "include" });
  const me = await meRes.json().catch(() => ({ success: false }));

  if (!me.success || !me.authenticated) {
    window.location.href = "/login.html";
    return null;
  }

  if (!me.user?.approved) {
    throw new Error("Your account is pending approval by admins.");
  }

  return me.user;
}

export function byId(id) {
  return document.getElementById(id);
}

export function safeText(text) {
  return String(text || "").replace(/[<>]/g, "");
}
