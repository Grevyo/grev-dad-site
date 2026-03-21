const SKIN_API_KEY = "395cf104-25ac-4093-8417-d9e58f936d48";

// --- HELPER FUNCTIONS ---
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function redirect(request, location) {
  return Response.redirect(new URL(location, request.url), 302);
}

// ... (Keep your existing Cookie, Base64, and Hash functions here) ...

// --- NEW: SKIN QUALITY & FLOAT CALCULATOR ---
function calculateSkinQuality(basePrice) {
  const float = Math.random();
  let wear = "Factory New";
  let multiplier = 1.0;

  if (float > 0.07 && float <= 0.15) { wear = "Minimal Wear"; multiplier = 0.85; }
  else if (float > 0.15 && float <= 0.38) { wear = "Field-Tested"; multiplier = 0.70; }
  else if (float > 0.38 && float <= 0.45) { wear = "Well-Worn"; multiplier = 0.55; }
  else if (float > 0.45) { wear = "Battle-Scarred"; multiplier = 0.40; }

  return {
    wear,
    float: float.toFixed(5),
    price: (basePrice * multiplier).toFixed(2)
  };
}

// ... (Keep touchUser, getCurrentUser, getStatus, requireApprovedUser, requireAdminUser) ...

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/api/ping") return json({ ok: true });

      // --- 1. ADMIN: SYNC LIVE PRICES ---
      if (path === "/api/admin/sync-prices") {
        const admin = await requireAdminUser(request, env);
        if (!admin) return json({ error: "Forbidden" }, 403);

        // Fetching from PriceEmpire (Steam Source)
        const res = await fetch(`https://api.pricempire.com/v1/getPrices?api_key=${SKIN_API_KEY}&sources=steam`);
        const data = await res.json();

        if (data.items) {
          for (const [fullName, details] of Object.entries(data.items)) {
            const price = details.steam?.price / 100 || 0; // Convert cents to dollars
            if (price > 0) {
              await env.CASES_DB.prepare("UPDATE item_definitions SET base_price = ? WHERE (weapon_type || ' | ' || skin_name) = ?")
                .bind(price, fullName)
                .run();
            }
          }
        }
        return json({ success: true, message: "Live prices updated from Steam Market." });
      }

      // --- 2. CASE LISTING ---
      if (path === "/api/cases/list") {
        const user = await requireApprovedUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401);

        const { results } = await env.CASES_DB.prepare("SELECT DISTINCT case_name FROM item_definitions").all();
        return json({ cases: results });
      }

      // --- 3. GET CASE SKINS (PREVIEW) ---
      if (path === "/api/cases/skins") {
        const caseName = url.searchParams.get("name");
        if (!caseName) return json({ error: "Missing case name" }, 400);

        const { results } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?")
          .bind(caseName)
          .all();
        return json({ skins: results });
      }

      // --- 4. THE UNBOXING CORE ---
      if (path === "/api/cases/open" && request.method === "POST") {
        const user = await requireApprovedUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401);

        const { caseName } = await request.json();
        const { results: skins } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?")
          .bind(caseName)
          .all();

        if (!skins || skins.length === 0) return json({ error: "Case is empty or not found" }, 404);

        // Weighted Random Roll
        const totalWeight = skins.reduce((sum, s) => sum + s.drop_weight, 0);
        let random = Math.random() * totalWeight;
        let winner = skins[0];

        for (const skin of skins) {
          if (random < skin.drop_weight) {
            winner = skin;
            break;
          }
          random -= skin.drop_weight;
        }

        // Calculate Float/Wear/Price
        const quality = calculateSkinQuality(winner.base_price);
        const finalFullName = `${winner.weapon_type} | ${winner.skin_name} (${quality.wear})`;

        // Insert into the User's Inventory (Original DB)
        await env.DB.prepare(`
          INSERT INTO inventory (user_id, skin_name, skin_rarity, estimated_value, unboxed_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(user.id, finalFullName, winner.rarity, quality.price, new Date().toISOString()).run();

        return json({
          success: true,
          item: finalFullName,
          rarity: winner.rarity,
          price: quality.price,
          float: quality.float,
          weapon: winner.weapon_type,
          skin: winner.skin_name
        });
      }

      // ... (Rest of your existing Auth, Chat, Member, and Forum routes) ...

      // --- Ensure assets are served if no API route matches ---
      return serveAssetOr404(env, request);
    } catch (err) {
      return new Response("Worker crash:\n\n" + (err && err.stack ? err.stack : String(err)), {
        status: 500, headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }
  }
};
