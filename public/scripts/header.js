const AUTH_CACHE_KEY = "grevdad_auth_user";
const AUTH_CACHE_EVENT = "grevdad-auth-changed";
const AUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = "grevdad_theme";
const PLAYGROUND_NAV_STORAGE_KEY = "grevdad_playground_nav";

const PLAYGROUND_PAGE_PREFIXES = [
  "/gambling",
  "/j-playground",
  "/dkpg"
];

function shouldShowPlaygroundNav(pathname = window.location.pathname) {
  return !PLAYGROUND_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function readPlaygroundNavPrefs() {
  try {
    const raw = window.localStorage.getItem(PLAYGROUND_NAV_STORAGE_KEY);
    if (!raw) return { collapsed: false };
    const parsed = JSON.parse(raw);
    return {
      collapsed: Boolean(parsed?.collapsed)
    };
  } catch (error) {
    console.error("Failed to read playground nav prefs:", error);
    return { collapsed: false };
  }
}

function writePlaygroundNavPrefs(prefs) {
  try {
    window.localStorage.setItem(PLAYGROUND_NAV_STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.error("Failed to save playground nav prefs:", error);
  }
}

function setupPlaygroundSideNav() {
  const nav = document.getElementById("playground-side-nav");
  const collapseBtn = document.getElementById("playground-side-nav-collapse");
  if (!nav || !collapseBtn) return;

  if (!shouldShowPlaygroundNav()) {
    nav.classList.add("hidden");
    return;
  }

  nav.classList.remove("hidden");
  let state = readPlaygroundNavPrefs();

  const applyState = () => {
    nav.dataset.state = "open";
    nav.dataset.collapsed = state.collapsed ? "true" : "false";
    nav.setAttribute("aria-hidden", "false");
    collapseBtn.setAttribute("aria-label", state.collapsed ? "Expand playground navigation" : "Minimize playground navigation");
    collapseBtn.textContent = state.collapsed ? "⇥" : "⇤";
    writePlaygroundNavPrefs(state);
  };

  collapseBtn.addEventListener("click", () => {
    state = { ...state, collapsed: !state.collapsed };
    applyState();
  });

  applyState();
}


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
    setupPlaygroundSideNav();
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
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const cachedAt = Number(parsed?.cached_at || 0);
    if (!cachedAt || (Date.now() - cachedAt) > AUTH_CACHE_TTL_MS) {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }

    return parsed?.user || null;
  } catch (error) {
    console.error("Failed to read cached auth user:", error);
    return null;
  }
}

function writeCachedAuthUser(user) {
  try {
    if (!user) {
      window.localStorage.removeItem(AUTH_CACHE_KEY);
    } else {
      window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
        user,
        cached_at: Date.now()
      }));
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
