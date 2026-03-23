const AUTH_CACHE_KEY = "grevdad_auth_user";
const AUTH_CACHE_EVENT = "grevdad-auth-changed";
const AUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = "grevdad_theme";
const CASINO_BALANCE_STORAGE_KEY = "grevdad_casino_balance";
const CASINO_BALANCE_EVENT = "grevdad-casino-balance-changed";

function isCasinoPage(pathname = window.location.pathname) {
  return pathname.startsWith("/gambling");
}

function readCasinoBalance() {
  try {
    const raw = window.localStorage.getItem(CASINO_BALANCE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.formatted !== "string") return null;
    return parsed;
  } catch (error) {
    console.error("Failed to read casino balance:", error);
    return null;
  }
}

function writeCasinoBalance(balance) {
  try {
    if (!balance?.formatted) window.localStorage.removeItem(CASINO_BALANCE_STORAGE_KEY);
    else window.localStorage.setItem(CASINO_BALANCE_STORAGE_KEY, JSON.stringify(balance));
  } catch (error) {
    console.error("Failed to save casino balance:", error);
  }

  window.dispatchEvent(new Event(CASINO_BALANCE_EVENT));
}

function applyCasinoBalance() {
  const balanceWrap = document.getElementById("header-casino-balance");
  const balanceValue = document.getElementById("header-casino-balance-value");
  if (!balanceWrap || !balanceValue) return;

  const balance = readCasinoBalance();
  const visible = isCasinoPage() && Boolean(balance?.formatted);
  balanceWrap.classList.toggle("hidden", !visible);
  if (visible) balanceValue.textContent = balance.formatted;
}

async function refreshCasinoBalance() {
  if (!isCasinoPage()) return;

  try {
    const response = await fetch("/api/casino/profile", { credentials: "same-origin" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || "Failed to load casino balance");
    writeCasinoBalance({
      formatted: `${Number(data?.profile?.grev_coin_balance || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GC`,
      value: Number(data?.profile?.grev_coin_balance || 0),
      updated_at: Date.now()
    });
  } catch (error) {
    console.error(error);
  }
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
    applyCasinoBalance();
    refreshCasinoBalance();
    window.addEventListener(AUTH_CACHE_EVENT, () => {
      applyHeaderAuthState(readCachedAuthUser());
      applyCasinoBalance();
    });
    window.addEventListener(CASINO_BALANCE_EVENT, applyCasinoBalance);

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
  writeCasinoBalance(null);
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
window.writeCasinoBalance = writeCasinoBalance;
