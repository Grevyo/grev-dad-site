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
    const res = await fetch(`https://api.pricempire.com/v1/items/prices?api_key=${SKIN_API_KEY}&sources=steam`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) grev-dad-site/1.0" }
    });
    
    const data = await res.json();
    if (data) {
      const stmts = [];
      for (const [fullName, details] of Object.entries(data)) {
        const price = (details.steam?.price || details.price || 0) / 100;
        if (price > 0) {
          stmts.push(env.CASES_DB.prepare("UPDATE item_definitions SET base_price = ? WHERE (weapon_type || ' | ' || skin_name) = ?")
            .bind(price, fullName));
        }
      }
      // Process in batches of 50
      for (let i = 0; i < stmts.length; i += 50) {
        await env.CASES_DB.batch(stmts.slice(i, i + 50));
      }
      
      await env.CASES_DB.prepare("INSERT OR REPLACE INTO sync_log (id, last_sync) VALUES (1, ?)")
        .bind(new Date().toISOString()).run();
    }
  } catch (e) { console.error("Sync failed:", e.message); }
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

      // --- ADMIN ROUTES ---
      if (path === "/api/admin/pending") {
        const admin = await requireAdminUser(request, env);
        if (!admin) return json({ error: "Forbidden" }, 403);
        const { results } = await env.DB.prepare("SELECT id, username, created_at FROM users WHERE approved = 0").all();
        return json({ pending: results });
      }

      if (path === "/api/admin/sync-prices" && request.method === "POST") {
        const admin = await requireAdminUser(request, env);
        if (!admin) return json({ error: "Forbidden" }, 403);
        ctx.waitUntil(autoSyncPrices(env));
        return json({ success: true });
      }

      if (path === "/api/cases/list") {
        if (!env.CASES_DB) return json({ error: "CASES_DB binding missing" }, 500);
        const { results } = await env.CASES_DB.prepare("SELECT DISTINCT case_name FROM item_definitions").all();
        return json({ cases: results || [] });
      }

      if (path === "/api/cases/skins") {
        const { results } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?").bind(url.searchParams.get("name")).all();
        return json({ skins: results });
      }

      // --- MEGA SEEDER ---
      if (path === "/api/admin/mega-seed") {
        const admin = await requireAdminUser(request, env);
        if (!admin) return json({ error: "Forbidden" }, 403);

        try {
          const res = await fetch("https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json");
          const allSkins = await res.json();
          const stmts = [];

          for (const skin of allSkins) {
            let rarity = "milspec", weight = 50;
            const rName = skin.rarity.name.toLowerCase();
            if (rName.includes("extraordinary") || skin.type.includes("Gloves") || skin.weapon?.name.includes("Knife")) { 
              rarity = "rare_special"; weight = 1; 
            }
            else if (rName.includes("covert")) { rarity = "covert"; weight = 2; }
            else if (rName.includes("classified")) { rarity = "classified"; weight = 10; }
            else if (rName.includes("restricted")) { rarity = "restricted"; weight = 20; }

            const weaponType = skin.weapon ? skin.weapon.name : "Other";
            const skinName = skin.name.replace(weaponType + " | ", "");

            stmts.push(env.CASES_DB.prepare(`
              INSERT OR IGNORE INTO item_definitions (case_name, weapon_type, skin_name, rarity, base_price, drop_weight)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind("Global Collection", weaponType, skinName, rarity, 0.0, weight));
          }

          for (let i = 0; i < stmts.length; i += 50) {
            await env.CASES_DB.batch(stmts.slice(i, i + 50));
          }

          return json({ success: true, message: `Seeded ${allSkins.length} skins. Running price sync now...` });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      if (path === "/api/admin/create-case" && request.method === "POST") {
        const admin = await requireAdminUser(request, env);
        if (!admin) return json({ error: "Forbidden" }, 403);
        const { name, price, skins } = await request.json();
        for (const s of skins) {
          let weight = (s.rarity === "rare_special") ? 1 : (s.rarity === "covert" ? 2 : (s.rarity === "classified" ? 10 : 20));
          await env.CASES_DB.prepare(`INSERT INTO item_definitions (case_name, weapon_type, skin_name, rarity, base_price, drop_weight) VALUES (?, ?, ?, ?, ?, ?)`).bind(name, s.weapon, s.skin, s.rarity, s.price, weight).run();
        }
        return json({ success: true });
      }

      return await serveAssetOr404(env, request);
    } catch (err) {
      return new Response("Worker error:\n" + err.stack, { status: 500 });
    }
  }
};
