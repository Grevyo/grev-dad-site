export function getAdminRoutes(handlers) {
  return [
    { path: "/api/admin/users", method: "GET", handler: handlers.handleAdminUsers },
    { path: "/api/admin/user", method: "GET", handler: handlers.handleAdminUser },
    { path: "/api/admin/user/update", method: "POST", handler: handlers.handleAdminUpdateUser },
    { path: "/api/admin/user/delete", method: "POST", handler: handlers.handleAdminDeleteUser },
    { path: "/api/admin/pending-users", method: "GET", handler: handlers.handleAdminPendingUsers },
    { path: "/api/admin/casino/read-database", method: "POST", handler: handlers.handleAdminReadCasinoDatabase }
  ];
}
