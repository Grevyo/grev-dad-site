// Shared Worker request/response helpers.
//
// b64/base64Url, sha256, cookie parsing and the security-headers JSON
// response were previously copy-pasted, byte-for-byte identical, into 20+
// files across src/. Import from here instead of redefining them locally.

export function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

// Historical alias: many modules called this `b64`. Same implementation.
export const b64 = base64Url;

const encoder = new TextEncoder();

export async function sha256(value: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export function parseCookies(request: Request): Record<string, string> {
  return Object.fromEntries(
    (request.headers.get('Cookie') ?? '')
      .split(';')
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => {
        const index = value.indexOf('=');
        return index < 0 ? ['', ''] : [value.slice(0, index), decodeURIComponent(value.slice(index + 1))];
      })
      .filter(([key]) => Boolean(key))
  );
}

export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  });
}
