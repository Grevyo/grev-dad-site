export function getUserRoutes(handlers) {
  return [
    { path: "/api/profile/me", method: "GET", handler: handlers.handleProfileMe },
    { path: "/api/profile/update", method: "POST", handler: handlers.handleProfileUpdate },
    { path: "/api/profile/view", method: "GET", handler: handlers.handleProfileView },
    { path: "/api/users/members", method: "GET", handler: handlers.handleMembers },
    { path: "/api/presence", method: "POST", handler: handlers.handlePresence }
  ];
}
