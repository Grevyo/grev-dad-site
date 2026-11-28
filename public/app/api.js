// Small fetch wrapper for the v2 API: JSON in and out, friendly errors, and a redirect to log in
// when the session has ended.
export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const init = { method, credentials: 'same-origin', headers: {}, signal, cache: 'no-store' };
  if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
  let response;
  try { response = await fetch(path, init); }
  catch { throw new ApiError("Couldn't reach grev.dad. Check your connection and try again.", 0); }
  let data = {};
  try { data = await response.json(); } catch {}
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new ApiError('Please log in again.', 401);
  }
  if (!response.ok || data.ok === false) throw new ApiError(data.message || 'Something went wrong. Please try again.', response.status);
  return data;
}

export const uuid = () => crypto.randomUUID();
