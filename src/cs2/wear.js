/** Steam market wear labels (GBP listings use these exact strings). */
export const WEAR_TIERS = [
  { label: "Factory New", code: "FN", weight: 5 },
  { label: "Minimal Wear", code: "MW", weight: 15 },
  { label: "Field-Tested", code: "FT", weight: 35 },
  { label: "Well-Worn", code: "WW", weight: 25 },
  { label: "Battle-Scarred", code: "BS", weight: 20 }
];

export function pickWearTier() {
  const total = WEAR_TIERS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const tier of WEAR_TIERS) {
    r -= tier.weight;
    if (r <= 0) return tier;
  }
  return WEAR_TIERS[WEAR_TIERS.length - 1];
}

/** Full Steam market_hash_name for a weapon + skin + wear. */
export function buildMarketHashName(weaponName, skinName, wearLabel) {
  const w = String(weaponName || "").trim();
  const s = String(skinName || "").trim();
  return `${w} | ${s} (${wearLabel})`;
}
