export function getChatRoutes(handlers) {
  return [
    { path: "/api/chat/global", method: "GET", handler: handlers.handleGetGlobalChat },
    { path: "/api/chat/global", method: "POST", handler: handlers.handlePostGlobalChat },
    { path: "/api/chat/casino", method: "GET", handler: handlers.handleGetCasinoChat },
    { path: "/api/chat/casino", method: "POST", handler: handlers.handlePostCasinoChat },
    { path: "/api/chat/private", method: "GET", handler: handlers.handlePrivateChatPlaceholderGet },
    { path: "/api/chat/private", method: "POST", handler: handlers.handlePrivateChatPlaceholderPost }
  ];
}
