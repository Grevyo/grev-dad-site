// Simulated economy: integer pence internally; UI shows Grev Coins with two decimals.

export const STARTING_BALANCE_PENCE = 500000; // 5,000.00 Grev Coins
export const KEY_PRICE_PENCE = 100; // 1.00 Grev Coin
/** Admin can override in DB; default matches "market minus 10%" payout. */
export const DEFAULT_QUICK_SELL_FEE_PERCENT = 10;
export const STEAM_APPID_CS2 = 730;
export const STEAM_CURRENCY_GBP = 2;
export const MARKET_CACHE_TTL_MS = 15 * 60 * 1000;
