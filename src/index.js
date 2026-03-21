// Hardcoded API Key for the Price Sync
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

// --- FLOAT & WEAR CALCULATOR ---
function calculateSkinQuality(basePrice) {
  const float = Math.random();
  let wear = "Factory New";
  let multiplier = 1.0;

  // Standard CS2 Wear Ranges
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

// ... (Your existing Cookie, Base64, Hash, touchUser, getCurrentUser, getStatus, and Auth helpers go here) ...

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === "/api/ping") return json({ ok: true });

      // --- 1. ADMIN: SYNC LIVE PRICES FROM STEAM ---
      if (path === "/api/admin/sync-prices") {
        const admin = await requireAdminUser(request, env);
        if (!admin) return json({ error: "Forbidden" }, 403);

        const res = await fetch(`https://api.pricempire.com/v1/getPrices?api_key=${SKIN_API_KEY}&sources=steam`);
        const data = await res.json();

        if (data.items) {
          for (const [fullName, details] of Object.entries(data.items)) {
            const price = (details.steam?.price || 0) / 100; // Convert cents to dollars
            if (price > 0) {
              // Update the 'cases' database
              await env.CASES_DB.prepare("UPDATE item_definitions SET base_price = ? WHERE (weapon_type || ' | ' || skin_name) = ?")
                .bind(price, fullName)
                .run();
            }
          }
        }
        return json({ success: true, message: "Steam Market prices synced to CASES_DB." });
      }

      // --- 2. CASE LISTING ---
      if (path === "/api/cases/list") {
        const { results } = await env.CASES_DB.prepare("SELECT DISTINCT case_name FROM item_definitions").all();
        return json({ cases: results });
      }

      // --- 3. GET CASE SKINS ---
      if (path === "/api/cases/skins") {
        const caseName = url.searchParams.get("name");
        const { results } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?")
          .bind(caseName)
          .all();
        return json({ skins: results });
      }

      // --- 4. UNBOXING ROUTE ---
      if (path === "/api/cases/open" && request.method === "POST") {
        const user = await requireApprovedUser(request, env);
        if (!user) return json({ error: "Unauthorized" }, 401);

        const { caseName } = await request.json();
        const { results: skins } = await env.CASES_DB.prepare("SELECT * FROM item_definitions WHERE case_name = ?")
          .bind(caseName)
          .all();

        if (!skins || skins.length === 0) return json({ error: "Case not found" }, 404);

        // Weighted Odds (Blues common, Reds rare)
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

        const quality = calculateSkinQuality(winner.base_price);
        const finalName = `${winner.weapon_type} | ${winner.skin_name} (${quality.wear})`;

        // Save to User's Inventory (Original DB)
        await env.DB.prepare(`
          INSERT INTO inventory (user_id, skin_name, skin_rarity, estimated_value, unboxed_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(user.id, finalName, winner.rarity, quality.price, new Date().toISOString()).run();

        return json({
          success: true,
          item: finalName,
          rarity: winner.rarity,
          price: quality.price,
          float: quality.float
        });
      }

      // ... (Keep the rest of your Auth, Chat, Member, and Forum routes) ...

      return serveAssetOr404(env, request);
    } catch (err) {
      return new Response("Worker error:\n" + err.stack, { status: 500 });
    }
  }
};
