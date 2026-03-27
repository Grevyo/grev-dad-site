export function getAuthRoutes(handlers) {
  return [
    { path: "/api/auth/register", method: "POST", handler: handlers.handleRegister },
    { path: "/api/auth/login", method: "POST", handler: handlers.handleLogin },
    { path: "/api/auth/logout", method: "POST", handler: handlers.handleLogout },
    { path: "/api/auth/me", method: "GET", handler: handlers.handleMe }
  ];
}
