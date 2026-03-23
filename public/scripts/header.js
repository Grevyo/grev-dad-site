// public/scripts/header.js

const AUTH_CACHE_KEY = "grevdad_auth_user";
const AUTH_CACHE_EVENT = "grevdad-auth-changed";
const THEME_STORAGE_KEY = "grevdad_theme";

function applyTheme(theme) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;
  const toggleBtn = document.getElementById("theme-toggle-btn");
  if (toggleBtn) {
    const isLight = nextTheme === "light";
    toggleBtn.setAttribute("aria-pressed", String(isLight));
    const icon = toggleBtn.querySelector(".theme-toggle-icon");
    const label = toggleBtn.querySelector(".theme-toggle-label");
    if (icon) icon.textContent = isLight ? "☀️" : "🌙";
    if (label) label.textContent = isLight ? "Light mode" : "Dark mode";
  }
}

function getInitialTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch (error) {
    console.error("Failed to read theme preference:", error);
  }

  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function setupThemeToggle() {
  const toggleBtn = document.getElementById("theme-toggle-btn");
  applyTheme(document.body.dataset.theme || getInitialTheme());
  if (!toggleBtn) return;

  toggleBtn.addEventListener("click", () => {
    const nextTheme = document.body.dataset.theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
      console.error("Failed to save theme preference:", error);
    }
  });
}


async function loadSharedHeader() {
  const mount = document.getElementById("header-mount");
  if (!mount) return;
  try {
    const response = await fetch("/header.html", { cache: "no-store" });
    const html = await response.text();
    mount.innerHTML = html;
    const cachedUser = readCachedAuthUser();
    applyHeaderAuthState(cachedUser);

    const auth = await fetchCurrentUser({ preferCache: !cachedUser });
    applyHeaderAuthState(auth);
    setupThemeToggle();
    window.addEventListener(AUTH_CACHE_EVENT, () => {
      applyHeaderAuthState(readCachedAuthUser());
    });

    const logoutBtn = document.getElementById("header-logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;

        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "same-origin"
          });
        } catch (error) {
          console.error("Logout failed:", error);
        }

        clearCachedAuthUser();
        window.location.href = "/login.html";
      });
    }
  } catch (error) {
    console.error("Failed to load header:", error);
  }
}

async function fetchCurrentUser({ preferCache = false } = {}) {
  const cachedUser = readCachedAuthUser();
  if (preferCache && cachedUser) {
    return cachedUser;
  }

  try {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "same-origin"
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.authenticated) {
      clearCachedAuthUser();
      return null;
    }

    const user = data.user || null;
    writeCachedAuthUser(user);
    return user;
  } catch (error) {
    console.error("Failed to fetch current user:", error);
    return cachedUser;
  }
}

function readCachedAuthUser() {
  try {
    const raw = window.sessionStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("Failed to read cached auth user:", error);
    return null;
  }
}

function writeCachedAuthUser(user) {
  try {
    if (!user) {
      window.sessionStorage.removeItem(AUTH_CACHE_KEY);
    } else {
      window.sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
    }
  } catch (error) {
    console.error("Failed to cache auth user:", error);
  }

  window.dispatchEvent(new Event(AUTH_CACHE_EVENT));
}

function clearCachedAuthUser() {
  writeCachedAuthUser(null);
}

function applyHeaderAuthState(user) {
  const authOnlyItems = document.querySelectorAll("[data-auth-only]");
  const guestOnlyItems = document.querySelectorAll("[data-guest-only]");
  const adminOnlyItems = document.querySelectorAll("[data-admin-only]");

  authOnlyItems.forEach((item) => {
    item.classList.toggle("hidden", !user);
  });

  guestOnlyItems.forEach((item) => {
    item.classList.toggle("hidden", !!user);
  });

  const isAdmin = Boolean(user?.is_admin);
  adminOnlyItems.forEach((item) => {
    item.classList.toggle("hidden", !isAdmin);
  });
}


document.addEventListener("DOMContentLoaded", () => {
  applyTheme(getInitialTheme());
  loadSharedHeader();
});

window.fetchCurrentUser = fetchCurrentUser;
window.readCachedAuthUser = readCachedAuthUser;
window.reportCurrentPresence = async function reportCurrentPresence(payload = {}) {
  try {
    await fetch('/api/presence', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Failed to update presence:', error);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  let area = 'Browsing';
  let detail = 'around the site';
  if (path.startsWith('/gambling/blackjack')) { area = 'Gambling - Blackjack'; detail = 'browsing blackjack tables'; }
  else if (path.startsWith('/gambling')) { area = 'Gambling'; detail = 'in the gambling hub'; }
  else if (path.startsWith('/profile')) { area = 'Profile'; detail = 'viewing profiles'; }
  else if (path.startsWith('/members')) { area = 'Members'; detail = 'checking the members page'; }
  window.reportCurrentPresence({ area, detail, page_path: path });
  window.setInterval(() => window.reportCurrentPresence({ area, detail, page_path: path }), 45000);
});
