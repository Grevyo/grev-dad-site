export function getMetaRoutes(handlers) {
  return [
    { path: "/api/casino/profile", method: "GET", handler: handlers.handleCasinoProfile },
    { path: "/api/casino/profile/balance", method: "POST", handler: handlers.handleCasinoProfileBalanceUpdate },
    { path: "/api/site/meta", method: "GET", handler: handlers.handleSiteMeta },
    { path: "/api/casino/daily-spin", method: "POST", handler: handlers.handleCasinoDailySpin },
    { path: "/api/casino/classic-spin", method: "POST", handler: handlers.handleCasinoClassicSpin },
    { path: "/api/casino/roulette/state", method: "GET", handler: handlers.handleCasinoRouletteState },
    { path: "/api/casino/roulette/bet", method: "POST", handler: handlers.handleCasinoRouletteBet },
    { path: "/api/casino/crash-sprint/state", method: "GET", handler: handlers.handleCasinoCrashSprintState },
    { path: "/api/casino/crash-sprint/join", method: "POST", handler: handlers.handleCasinoCrashSprintJoin },
    { path: "/api/casino/crash-sprint/cashout", method: "POST", handler: handlers.handleCasinoCrashSprintCashout },
    { path: "/api/health", method: "GET", handler: handlers.handleHealth },
    { path: "/api/hltv/overview", method: "GET", handler: handlers.handleHltvOverview },
    { path: "/api/setup", method: "POST", handler: handlers.handleSetup }
  ];
}
