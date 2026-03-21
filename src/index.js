const SKIN_API_KEY = "395cf104-25ac-4093-8417-d9e58f936d48";

// --- HELPER FUNCTIONS ---
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      "Content-Type": "application/json; charset=utf-8",
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
  return `session_v3=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`;
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

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname.toLowerCase().replace(/\/$/, "");

      if (path === "/cases") return redirect(request, "/cases.html");
      if (path === "/api/ping") return json({ ok: true });

      // --- AUTH: ME ---
      if (path === "/api/me") {
        const user = await getCurrentUser(request, env);
        if (!user) return json({ authenticated: false }, 401);
        return json({ authenticated: true, user });
      }

      // --- AUTH: LOGIN ---
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

      // --- PROFILE API (Fixes your /profile?id=4 issue) ---
      if (path === "/api/profile") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "No ID" }, 400);

        const user = await env.DB.prepare(`SELECT id, username, last_seen_at, created_at FROM users WHERE id = ?`).bind(id).first();
        if (!user) return json({ error: "User not found" }, 404);

        const { results: inventory } = await env.CASES_DB.prepare(`SELECT * FROM user_inventory WHERE user_id = ? ORDER BY unboxed_at DESC`).bind(id).all();

        return json({
          username: user.username,
          status: getStatus(user.last_seen_at),
          created_at: user.created_at,
          inventory: inventory || []
        });
      }

      // --- CASE OPENING (Saves to Database) ---
      if (path === "/api/cases/open" && request.method === "POST") {
        const user = await requireApprovedUser(request, env);
        if (!user) return json({ error: "Please log in" }, 401);

        const { caseName } = await request.json();
        const { results: skins } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?").bind(caseName).all();
        if (!skins || skins.length === 0) return json({ error: "Case empty" }, 404);

        const totalWeight = skins.reduce((sum, s) => sum + s.drop_weight, 0);
        let random = Math.random() * totalWeight;
        let selected = skins[0];
        for (const s of skins) {
          if (random < s.drop_weight) { selected = s; break; }
          random -= s.drop_weight;
        }

        const quality = calculateSkinQuality(selected.base_price);
        
        // SAVE TO INVENTORY
        await env.CASES_DB.prepare(`
          INSERT INTO user_inventory (user_id, skin_name, rarity, wear, price)
          VALUES (?, ?, ?, ?, ?)
        `).bind(user.id, `${selected.weapon_type} | ${selected.skin_name}`, selected.rarity, quality.wear, quality.price).run();

        return json({ success: true, item: selected, quality });
      }

      // --- CASE ROUTES ---
      if (path === "/api/cases/list") {
        const { results } = await env.CASES_DB.prepare("SELECT DISTINCT case_name FROM item_definitions").all();
        return json({ cases: results || [] });
      }

      if (path === "/api/cases/skins") {
        const name = url.searchParams.get("name");
        const { results } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?").bind(name).all();
        return json({ skins: results });
      }

      // --- ADMIN: MEGA SEEDER ---
      if (path === "/api/admin/mega-seed") {
        const admin = await requireAdminUser(request, env);
        if (!admin) return json({ error: "Forbidden" }, 403);
        await env.CASES_DB.prepare("DELETE FROM item_definitions WHERE case_name = 'Global Collection'").run();
        const res = await fetch("https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json");
        const allSkins = await res.json();
        const stmts = [];
        for (const skin of allSkins) {
          let rarity = "milspec", weight = 50;
          const rName = (skin.rarity?.name || "").toLowerCase();
          if (rName.includes("extraordinary") || skin.weapon?.name?.includes("Knife") || skin.type?.includes("Gloves")) { rarity = "rare_special"; weight = 1; }
          else if (rName.includes("covert")) { rarity = "covert"; weight = 2; }
          else if (rName.includes("classified")) { rarity = "classified"; weight = 10; }
          else if (rName.includes("restricted")) { rarity = "restricted"; weight = 20; }
          const weaponType = skin.weapon ? skin.weapon.name : "Other";
          const skinName = skin.name.replace(weaponType + " | ", "");
          stmts.push(env.CASES_DB.prepare(`INSERT INTO item_definitions (case_name, weapon_type, skin_name, rarity, base_price, drop_weight) VALUES (?, ?, ?, ?, ?, ?)`).bind("Global Collection", weaponType, skinName, rarity, 0.0, weight));
        }
        for (let i = 0; i < stmts.length; i += 50) { await env.CASES_DB.batch(stmts.slice(i, i + 50)); }
        return json({ success: true, count: allSkins.length });
      }

      return await serveAssetOr404(env, request);
    } catch (err) {
      return new Response("Worker error:\n" + err.stack, { status: 500 });
    }
  }
};
