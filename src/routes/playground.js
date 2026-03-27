const RETIRED_PREFIXES = [
  "/api/gambling/admin/",
  "/api/admin/cases",
  "/api/cs2",
  "/api/ygo",
  "/api/blackjack",
  "/api/casino"
];

const RETIRED_EXACT = new Set([
  "/api/gambling/profile",
  "/api/gambling/event",
  "/api/cases",
  "/api/cases/catalog"
]);

export function isRetiredGamblingPath(pathname) {
  if (RETIRED_EXACT.has(pathname)) return true;
  return RETIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function retiredGamblingPayload() {
  return {
    success: false,
    error: "The gambling playground has been cleared out and is being rebuilt from scratch."
  };
}
