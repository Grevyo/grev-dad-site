const SKIN_API_KEY = "395cf104-25ac-4093-8417-d9e58f936d48";

// --- HELPER FUNCTIONS ---
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
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

async function serveAssetOr404(env, request) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return new Response("ASSETS binding missing.", { status: 500 });
  }
  return await env.ASSETS.fetch(request);
}

function getStatus(lastSeenAt) {
  if (!lastSeenAt) return "offline";
  const diff = (Date.now() - new Date(lastSeenAt).getTime()) / 60000;
  if (diff <= 5) return "online";
  if (diff <= 30) return "away";
  return "offline";
}

// --- FLOAT & WEAR ---
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
    const log = await env.CASES_DB.prepare("SELECT last_sync FROM sync_log WHERE id = 1").first();
    if (!log) return;
    const lastSync = new Date(log.last_sync).getTime();
    const sixHours = 6 * 60 * 60 * 1000;
    if (Date.now() - lastSync > sixHours) {
      const res = await fetch(`https://api.pricempire.com/v1/items/prices?api_key=${SKIN_API_KEY}&sources=steam`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) grev-dad-site/1.0" }
      });
      
      const data = await res.json();
      if (data) {
        // Handle object structure: keys are the full skin names
        for (const [fullName, details] of Object.entries(data)) {
          const price = (details.steam?.price || details.price || 0) / 100;
          if (price > 0) {
            await env.CASES_DB.prepare("UPDATE item_definitions SET base_price = ? WHERE (weapon_type || ' | ' || skin_name) = ?")
              .bind(price, fullName).run();
          }
        }
        await env.CASES_DB.prepare("UPDATE sync_log SET last_sync = ? WHERE id = 1")
          .bind(new Date().toISOString()).run();
      }
    }
  } catch (e) { console.error("Background sync failed:", e.message); }
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.toLowerCase().replace(/\/$/, "");

      if (path === "/cases") return redirect(request, "/cases.html");

      if (path === "/api/ping") return json({ ok: true });
      if (path === "/api/me") {
        const user = await requireApprovedUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401);
        return json({ user });
      }

      if (path === "/api/register" && request.method === "POST") {
        const form = await request.formData();
        const username = String(form.get("username") || "").trim();
        const password = String(form.get("password") || "");
        if (password !== form.get("password2")) return redirect(request, "/register.html?msg=Passwords%20match%20error");
        const saltBase64 = toBase64(crypto.getRandomValues(new Uint8Array(16)));
        const hash = await hashPassword(password, saltBase64);
        const finalHash = `pbkdf2_sha256$100000$${saltBase64}$${hash}`;
        await env.DB.prepare(`INSERT INTO users (username, password_hash, approved, is_admin, created_at) VALUES (?, ?, 0, 0, ?)`).bind(username, finalHash, new Date().toISOString()).run();
        return redirect(request, "/login.html?msg=Pending%20Approval");
      }

      if (path === "/api/login" && request.method === "POST") {
        const form = await request.formData();
        const user = await env.DB.prepare(`SELECT * FROM users WHERE username = ?`).bind(form.get("username")).first();
        if (!user) return redirect(request, "/login.html?msg=Invalid%20Credentials");
        const parsed = parseStoredHash(user.password_hash);
        const calc = await hashPassword(form.get("password"), parsed.saltBase64, parsed.iterations);
        if (calc !== parsed.hashBase64) return redirect(request, "/login.html?msg=Invalid%20Credentials");
        if (!user.approved) return redirect(request, "/login.html?msg=Not%20Approved");
        const token = crypto.randomUUID();
        const now = new Date().toISOString();
        const expires = new Date(Date.now() + 7 * 86400000).toISOString();
        await env.DB.prepare(`INSERT INTO sessions (session_token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`).bind(token, user.id, now, expires).run();
        return new Response(null, { status: 302, headers: { "Location": "/members.html", "Set-Cookie": buildSessionCookie(token) } });
      }

      if (path === "/api/logout") {
        const token = getCookieValue(request.headers.get("Cookie"), "session_v3");
        if (token) { 
          await env.DB.prepare("DELETE FROM sessions WHERE session_token = ?").bind(token).run(); 
        }
        const response = json({ success: true, message: "Logged out" });
        response.headers.append("Set-Cookie", "session_v3=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
        return response;
      }

      if (path === "/api/members") {
        const user = await requireApprovedUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const members = await env.DB.prepare(`
          SELECT u.id, u.username, u.is_admin, u.last_seen_at, COUNT(i.id) as item_count, COALESCE(SUM(i.estimated_value), 0) as total_wealth 
          FROM users u LEFT JOIN inventory i ON u.id = i.user_id 
          WHERE u.approved = 1 GROUP BY u.id ORDER BY total_wealth DESC
        `).all();
        return json({ members: members.results.map(m => ({ ...m, status: getStatus(m.last_seen_at) })) });
      }

      if (path === "/api/admin/pending") {
        const admin = await requireAdminUser(request, env);
        if (!admin) return json({ error: "Forbidden" }, 403);
        const { results } = await env.DB.prepare("SELECT id, username, created_at FROM users WHERE approved = 0").all();
        return json({ pending: results });
      }

      if (path === "/api/cases/list") {
        if (!env.CASES_DB) return json({ error: "CASES_DB binding missing" }, 500);
        ctx.waitUntil(autoSyncPrices(env));
        const { results } = await env.CASES_DB.prepare("SELECT DISTINCT case_name FROM item_definitions").all();
        return json({ cases: results || [] });
      }

      if (path === "/api/cases/skins") {
        const { results } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?").bind(url.searchParams.get("name")).all();
        return json({ skins: results });
      }

      if (path === "/api/cases/open" && request.method === "POST") {
        const user = await requireApprovedUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401);
        const { caseName } = await request.json();
        const { results: skins } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?").bind(caseName).all();
        if (!skins || skins.length === 0) return json({ error: "Case not found or empty" }, 404);
        const totalWeight = skins.reduce((sum, s) => sum + s.drop_weight, 0);
        let random = Math.random() * totalWeight;
        let winner = skins[0];
        for (const s of skins) { if (random < s.drop_weight) { winner = s; break; } random -= s.drop_weight; }
        const qual = calculateSkinQuality(winner.base_price);
        const fullName = `${winner.weapon_type} | ${winner.skin_name} (${qual.wear})`;
        await env.DB.prepare(`INSERT INTO inventory (user_id, skin_name, skin_rarity, estimated_value, unboxed_at) VALUES (?, ?, ?, ?, ?)`).bind(user.id, fullName, winner.rarity, qual.price, new Date().toISOString()).run();
        return json({ success: true, item: fullName, rarity: winner.rarity, price: qual.price, float: qual.float, weapon: winner.weapon_type, skin: winner.skin_name });
      }

      if (path === "/api/inventory/recent-global") {
        const { results } = await env.DB.prepare(`SELECT i.*, u.username FROM inventory i JOIN users u ON i.user_id = u.id ORDER BY i.unboxed_at DESC LIMIT 10`).all();
        return json({ recent: results });
      }

      // --- 5. ADMIN & MAINTENANCE: MEGA SEEDER ---
      if (path === "/api/admin/mega-seed") {
        const admin = await requireAdminUser(request, env);
        if (!admin) return json({ error: "Forbidden" }, 403);

        try {
          // Changed to use the v1 prices endpoint with a stronger User-Agent
          const apiUrl = `https://api.pricempire.com/v1/items/prices?api_key=${SKIN_API_KEY}&sources=steam`;
          const res = await fetch(apiUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) grev-dad-site/1.0" }
          });
          
          const data = await res.json();
          const skinEntries = Object.entries(data); // Important: Convert object to array for counting
          
          if (skinEntries.length === 0) return json({ error: "API returned no items" }, 500);

          let addedCount = 0;
          for (const [fullName, details] of skinEntries) {
            if (!fullName.includes(" | ")) continue;

            const parts = fullName.split(" | ");
            const weaponType = parts[0];
            const skinAndWear = parts[1];
            // Split "Head Shot (Field-Tested)" -> "Head Shot"
            const skinName = skinAndWear.split(" (")[0]; 
            const price = (details.steam?.price || details.price || 0) / 100;

            if (price > 0) {
              let rarity = "milspec";
              let weight = 50;
              if (price > 200 || weaponType.includes("Knife") || weaponType.includes("Gloves")) { rarity = "rare_special"; weight = 1; }
              else if (price > 100) { rarity = "covert"; weight = 2; }
              else if (price > 30) { rarity = "classified"; weight = 10; }
              else if (price > 10) { rarity = "restricted"; weight = 20; }

              await env.CASES_DB.prepare(`
                INSERT OR IGNORE INTO item_definitions (case_name, weapon_type, skin_name, rarity, base_price, drop_weight)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind("Global Collection", weaponType, skinName, rarity, price, weight).run();
              addedCount++;
            }
          }
          return json({ success: true, message: `Seeded ${addedCount} skins into 'Global Collection'` });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      if (path === "/api/user/inventory") {
        const targetUserId = url.searchParams.get("id");
        if (!targetUserId) return json({ error: "No User ID provided" }, 400);
        const userBase = await env.DB.prepare(`SELECT id, username, created_at, last_seen_at FROM users WHERE id = ?`).bind(targetUserId).first();
        if (!userBase) return json({ error: "User not found" }, 404);
        const { results: items } = await env.DB.prepare(`SELECT * FROM inventory WHERE user_id = ? ORDER BY unboxed_at DESC`).bind(targetUserId).all();
        return json({ user: { ...userBase, status: getStatus(userBase.last_seen_at) }, inventory: items });
      }

      return await serveAssetOr404(env, request);
    } catch (err) {
      return new Response("Worker error:\n" + err.stack, { status: 500 });
    }
  }
};
