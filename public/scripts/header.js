const AUTH_CACHE_KEY = "grevdad_auth_user";
const AUTH_CACHE_EVENT = "grevdad-auth-changed";
const THEME_STORAGE_KEY = "grevdad_theme";
const PLAYGROUND_NAV_STORAGE_KEY = "grevdad_playground_nav";

const PLAYGROUND_PAGE_PREFIXES = [
  "/gambling/cs-cases",
  "/gambling/blackjack",
  "/gambling/casino",
  "/gambling/yugioh",
  "/j-playground",
  "/dkpg"
];

function shouldShowPlaygroundNav(pathname = window.location.pathname) {
  return !PLAYGROUND_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function readPlaygroundNavPrefs() {
  try {
    const raw = window.localStorage.getItem(PLAYGROUND_NAV_STORAGE_KEY);
    if (!raw) return { open: true, collapsed: false, pinned: false };
    const parsed = JSON.parse(raw);
    return {
      open: parsed?.open !== false,
      collapsed: Boolean(parsed?.collapsed),
      pinned: Boolean(parsed?.pinned)
    };
  } catch (error) {
    console.error("Failed to read playground nav prefs:", error);
    return { open: true, collapsed: false, pinned: false };
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
  const expandBtn = document.getElementById("playground-side-nav-expand");
  const collapseBtn = document.getElementById("playground-side-nav-collapse");
  const pinBtn = document.getElementById("playground-side-nav-pin");
  const closeBtn = document.getElementById("playground-side-nav-close");
  if (!nav || !expandBtn || !collapseBtn || !pinBtn || !closeBtn) return;

  if (!shouldShowPlaygroundNav()) {
    nav.classList.add("hidden");
    return;
  }

  nav.classList.remove("hidden");
  let state = readPlaygroundNavPrefs();

  const applyState = () => {
    nav.dataset.state = state.open ? "open" : "closed";
    nav.dataset.collapsed = state.collapsed ? "true" : "false";
    nav.dataset.pinned = state.pinned ? "true" : "false";
    nav.setAttribute("aria-hidden", String(!state.open));
    expandBtn.setAttribute("aria-label", state.open ? "Show minimized playground navigation" : "Expand playground navigation");
    expandBtn.setAttribute("aria-expanded", String(state.open));
    expandBtn.textContent = state.open ? "⇤" : "⇥";
    collapseBtn.setAttribute("aria-label", state.collapsed ? "Expand playground navigation details" : "Minimize playground navigation");
    collapseBtn.textContent = state.collapsed ? "⇥" : "⇤";
    pinBtn.setAttribute("aria-pressed", String(state.pinned));
    pinBtn.setAttribute("aria-label", state.pinned ? "Unpin playground navigation" : "Pin playground navigation");
    pinBtn.textContent = state.pinned ? "📌" : "📍";
    writePlaygroundNavPrefs(state);
  };

  const updateState = (patch) => {
    state = { ...state, ...patch };
    applyState();
  };

  expandBtn.addEventListener("click", () => {
    if (state.open && !state.collapsed) {
      updateState({ open: true, collapsed: true });
      return;
    }

    updateState({ open: true, collapsed: false });
  });

  collapseBtn.addEventListener("click", () => {
    if (state.collapsed) {
      updateState({ open: true, collapsed: false });
      return;
    }

    updateState({ open: true, collapsed: true });
  });

  pinBtn.addEventListener("click", () => {
    updateState({ pinned: !state.pinned, open: true });
  });

  closeBtn.addEventListener("click", () => {
    updateState({ open: false, collapsed: true });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.open && !state.pinned) {
      updateState({ open: false, collapsed: true });
    }
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (!state.pinned) {
        updateState({ open: false, collapsed: true });
      }
    });
  });

  nav.addEventListener("mouseleave", () => {
    if (!state.pinned && state.open && state.collapsed) {
      updateState({ open: false, collapsed: true });
    }
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
