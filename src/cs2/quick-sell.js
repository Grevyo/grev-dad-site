import { DEFAULT_QUICK_SELL_FEE_PERCENT } from "./constants.js";

export async function getQuickSellFeePercent(env) {
  const row = await env.CASES_DB.prepare(`
    SELECT value FROM cs2_sim_settings WHERE key = 'quick_sell_fee_percent' LIMIT 1
  `).first();
  const n = Number(row?.value);
  if (Number.isInteger(n) && n >= 0 && n < 100) return n;
  return DEFAULT_QUICK_SELL_FEE_PERCENT;
}

export function quickSellPayoutFromMarket(marketPence, feePercent) {
  const m = Number(marketPence);
  if (!m || m <= 0) return 0;
  return Math.max(1, Math.floor((m * (100 - feePercent)) / 100));
}
