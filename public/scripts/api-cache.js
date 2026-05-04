(function(){
  function readSessionCache(cacheKey){
    try { const raw = sessionStorage.getItem(cacheKey); return raw ? JSON.parse(raw) : null; } catch { return null; }
  }
  function writeSessionCache(cacheKey, data){
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data })); } catch {}
  }
  function clearSessionCache(cacheKey){ try { sessionStorage.removeItem(cacheKey); } catch {} }
  async function fetchJsonCached(url, options = {}) {
    const { cacheKey = `grev_api_cache:${url}`, ttlMs = 30000, useSession = true, force = false } = options;
    const method = String(options.method || 'GET').toUpperCase();
    const canCache = useSession && method === 'GET';
    if (canCache && !force) {
      const cached = readSessionCache(cacheKey);
      if (cached && (Date.now() - Number(cached.at || 0) < ttlMs)) return { data: cached.data, fromCache: true };
    }
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const text = await response.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { throw new Error(`Invalid JSON from ${url}`); } }
    if (!response.ok || !data || data.ok === false) throw new Error(data?.error || `Request failed: ${response.status}`);
    if (canCache) writeSessionCache(cacheKey, data);
    return { data, fromCache: false };
  }
  window.GREVApi = { fetchJsonCached, readSessionCache, writeSessionCache, clearSessionCache };
})();
