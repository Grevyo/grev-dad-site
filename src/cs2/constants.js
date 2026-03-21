// Simulated economy: integer pence internally; UI shows the same numbers as GBP as "Grev Coins" (e.g. 0.30 case, 2.50 key).

export const STARTING_BALANCE_PENCE = 10000;
export const KEY_PRICE_PENCE = 250; // 2.50 Grev Coins (£2.50)
/** Admin can override in DB; default matches "market minus 10%" payout. */
export const DEFAULT_QUICK_SELL_FEE_PERCENT = 10;
export const STEAM_APPID_CS2 = 730;
export const STEAM_CURRENCY_GBP = 2;
export const MARKET_CACHE_TTL_MS = 15 * 60 * 1000;
