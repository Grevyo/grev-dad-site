import { STARTING_BALANCE_PENCE } from "../cs2/constants.js";

export async function getStartingBalancePence(env) {
  if (!env?.DB) return STARTING_BALANCE_PENCE;
  try {
    const row = await env.DB.prepare(`SELECT value FROM gambling_settings WHERE key = 'starting_balance_pence' LIMIT 1`).first();
    const value = Number(row?.value || 0);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : STARTING_BALANCE_PENCE;
  } catch {
    return STARTING_BALANCE_PENCE;
  }
}
