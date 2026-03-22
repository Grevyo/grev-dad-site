const CACHE = new Map();

export async function getCachedValue(key, ttlMs, loader) {
  const now = Date.now();
  const hit = CACHE.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  const value = await loader();
  CACHE.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function setCachedValue(key, value, ttlMs) {
  CACHE.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateCachedValue(key) {
  CACHE.delete(key);
}

export function invalidateCachedPrefix(prefix) {
  for (const key of CACHE.keys()) {
    if (String(key).startsWith(prefix)) CACHE.delete(key);
  }
}
