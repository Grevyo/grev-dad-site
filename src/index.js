const SKIN_API_KEY = "395cf104-25ac-4093-8417-d9e58f936d48";

// --- HELPER FUNCTIONS ---
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Credentials": "true"
    }
  });
}

function redirect(request, location) {
  return Response.redirect(new URL(location, request.url), 302);
}

function getCookieValue(cookieHeader, name) {
  const cookies = String(cookieHeader || "").split(";");
  for (const part of cookies) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function buildSessionCookie(token) {
  const maxAge = 60 * 60 * 24 * 7;
  return `session_v3=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

// --- PASSWORD & CRYPTO ---
function symbolsToSafe(str) { return str.replace(/[^a-zA-Z0-9]/g, '-'); }

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function hashPassword(password, saltBase64, iterations = 100000) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltBase64), iterations }, key, 256);
  return toBase64(new Uint8Array(bits));
}

function parseStoredHash(stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4) return null;
  return { algorithm: parts[0], iterations: Number(parts[1]), saltBase64: parts[2], hashBase64: parts[3] };
}

// --- USER & SESSION HELPERS ---
async function touchUser(env, userId) {
  await env.DB.prepare(`UPDATE users SET last_seen_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), userId)
    .run();
}

async function getCurrentUser(request, env) {
  const token = getCookieValue(request.headers.get("Cookie"), "session_v3");
  if (!token) return null;
  return await env.DB.prepare(`
    SELECT users.id, users.username, users.approved, users.is_admin, users.created_at, users.last_seen_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.session_token = ? AND sessions.expires_at > ? LIMIT 1
  `).bind(token, new Date().toISOString()).first();
}

async function requireApprovedUser(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user || !user.approved) return null;
  await touchUser(env, user.id);
  return user;
}

async function requireAdminUser(request, env) {
  const user = await requireApprovedUser(request, env);
  if (!user || !user.is_admin) return null;
  return user;
}

function getStatus(lastSeenAt) {
  if (!lastSeenAt) return "offline";
  const diff = (Date.now() - new Date(lastSeenAt).getTime()) / 60000;
  if (diff <= 5) return "online";
  if (diff <= 30) return "away";
  return "offline";
}

// --- FLOAT & WEAR LOGIC ---
function calculateSkinQuality(basePrice) {
  const float = Math.random();
  let wear = "Factory New";
  let multiplier = 1.0;
  if (float > 0.07 && float <= 0.15) { wear = "Minimal Wear"; multiplier = 0.85; }
  else if (float > 0.15 && float <= 0.38) { wear = "Field-Tested"; multiplier = 0.70; }
  else if (float > 0.38 && float <= 0.45) { wear = "Well-Worn"; multiplier = 0.55; }
  else if (float > 0.45) { wear = "Battle-Scarred"; multiplier = 0.40; }
  return { wear, float: float.toFixed(5), price: (basePrice * multiplier).toFixed(2) };
}

// --- BACKGROUND SYNC LOGIC ---
async function autoSyncPrices(env) {
  try {
    const log = await env.DB.prepare("SELECT last_sync FROM sync_log WHERE id = 1").first();
    if (!log) return;
    const lastSync = new Date(log.last_sync).getTime();
    if (Date.now() - lastSync > (6 * 60 * 60 * 1000)) {
      const res = await fetch(`https://api.pricempire.com/v1/getPrices?api_key=${SKIN_API_KEY}&sources=steam`);
      const data = await res.json();
      if (data.items) {
        // Logic to update prices would go here - simplified for brevity
        await env.DB.prepare("UPDATE sync_log SET last_sync = ? WHERE id = 1").bind(new Date().toISOString()).run();
      }
    }
  } catch (e) { console.error("Sync Error:", e); }
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.toLowerCase().replace(/\/$/, "");

      // --- 1. CORE AUTH ---
      if (path === "/api/me") {
        const user = await getCurrentUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401);
        return json({ user });
      }

      if (path === "/api/login" && request.method === "POST") {
        const form = await request.formData();
        const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(form.get("username")).first();
        if (!user) return redirect(request, "/login.html?msg=Invalid");
        
        const parsed = parseStoredHash(user.password_hash);
        const calc = await hashPassword(form.get("password"), parsed.saltBase64, parsed.iterations);
        if (calc !== parsed.hashBase64) return redirect(request, "/login.html?msg=Invalid");
        if (!user.approved) return redirect(request, "/login.html?msg=Pending");

        const token = crypto.randomUUID();
        const expires = new Date(Date.now() + 7 * 86400000).toISOString();
        await env.DB.prepare(`INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)`).bind(token, user.id, expires).run();
        
        return new Response(null, { status: 302, headers: { "Location": "/members.html", "Set-Cookie": buildSessionCookie(token) } });
      }

      // --- 2. LEADERBOARD ---
      if (path === "/api/members") {
        const user = await requireApprovedUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const { results } = await env.DB.prepare(`
          SELECT u.id, u.username, u.is_admin, u.last_seen_at, 
          COUNT(i.id) as item_count, COALESCE(SUM(i.estimated_value), 0) as total_wealth 
          FROM users u LEFT JOIN inventory i ON u.id = i.user_id 
          WHERE u.approved = 1 GROUP BY u.id ORDER BY total_wealth DESC
        `).all();
        return json({ members: results.map(m => ({ ...m, status: getStatus(m.last_seen_at) })) });
      }

      // --- 3. INVENTORY & PROFILES ---
      if (path === "/api/user/inventory") {
        const targetId = url.searchParams.get("id");
        if (!targetId) return json({ error: "Missing ID" }, 400);

        const user = await env.DB.prepare("SELECT id, username, last_seen_at FROM users WHERE id = ?").bind(targetId).first();
        if (!user) return json({ error: "User Not Found" }, 404);

        const { results: inventory } = await env.DB.prepare("SELECT * FROM inventory WHERE user_id = ? ORDER BY unboxed_at DESC").bind(targetId).all();
        
        return json({ 
          user: { ...user, status: getStatus(user.last_seen_at) }, 
          inventory 
        });
      }

      // --- 4. CASE OPENING ---
      if (path === "/api/cases/open" && request.method === "POST") {
        const user = await requireApprovedUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401);
        
        const { caseName } = await request.json();
        const { results: skins } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?").bind(caseName).all();
        
        const totalWeight = skins.reduce((s, x) => s + x.drop_weight, 0);
        let rnd = Math.random() * totalWeight;
        let win = skins[0];
        for (const s of skins) { if (rnd < s.drop_weight) { win = s; break; } rnd -= s.drop_weight; }
        
        const qual = calculateSkinQuality(win.base_price);
        const fullName = `${win.weapon_type} | ${win.skin_name} (${qual.wear})`;
        
        await env.DB.prepare(`INSERT INTO inventory (user_id, skin_name, skin_rarity, estimated_value) VALUES (?, ?, ?, ?)`).bind(user.id, fullName, win.rarity, qual.price).run();
        
        return json({ success: true, item: fullName, rarity: win.rarity, price: qual.price });
      }

      // Default to static assets
      return await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response(e.stack, { status: 500 });
    }
  }
};
