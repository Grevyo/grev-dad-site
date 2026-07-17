const encoder = new TextEncoder();

function b64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

async function runPbkdf2(iterations: number): Promise<{ iterations: number; elapsedMs: number; hashLength: number }> {
  const password = 'diagnostic-password-not-an-account';
  const salt = encoder.encode('grev-dad-diag1');
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const started = performance.now();
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256
  );
  return {
    iterations,
    elapsedMs: Math.round((performance.now() - started) * 100) / 100,
    hashLength: b64(new Uint8Array(bits)).length
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/api/diagnostic/pbkdf2') {
      return json({ ok: true, diagnostic: 'PBKDF2 runtime isolation', endpoint: '/api/diagnostic/pbkdf2?iterations=20000' });
    }

    const requested = Number(url.searchParams.get('iterations') ?? '20000');
    if (!Number.isInteger(requested) || requested < 1 || requested > 310000) {
      return json({ ok: false, message: 'iterations must be an integer from 1 to 310000' }, 400);
    }

    try {
      const result = await runPbkdf2(requested);
      return json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      return json({ ok: false, stage: 'pbkdf2', error: message }, 500);
    }
  }
};
