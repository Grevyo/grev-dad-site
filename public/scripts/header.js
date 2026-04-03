const AUTH_CACHE_KEY = "grevdad_auth_user";
const AUTH_CACHE_EVENT = "grevdad-auth-changed";
const AUTH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const THEME_STORAGE_KEY = "grevdad_theme";
const CASINO_BALANCE_STORAGE_KEY = "grevdad_casino_balance";
const CASINO_BALANCE_EVENT = "grevdad-casino-balance-changed";
const SITE_META_EVENT = "grevdad-site-meta-changed";

function formatFooterTimestamp(value) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unavailable";
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}, ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false })} UTC`;
}

function applyAutomaticFooter(meta) {
  const footerInner = document.querySelector(".footer-inner");
  if (!footerInner) return;
  const github = meta?.github || {};
  const committedAt = github.committed_at || null;
  const commitText = github.commit_sha ? `${github.commit_sha.slice(0, 7)}` : "unknown";
  const repoLabel = github.repository || "GitHub repository";
  const sourceLabel = meta?.source === "github" ? "Live GitHub metadata" : "Workspace snapshot fallback";
  footerInner.innerHTML = `
    <div class="footer-auto">
      <div class="footer-status">
        <span>GitHub last updated —</span>
        <time datetime="${committedAt || ""}">${formatFooterTimestamp(committedAt)}</time>
      </div>
      <p class="home-footer-copy">${repoLabel} · ${sourceLabel} · Commit ${commitText}${github.commit_url ? ` · <a href="${github.commit_url}" target="_blank" rel="noopener noreferrer">view commit</a>` : ""}</p>
    </div>
  `;
  window.dispatchEvent(new Event(SITE_META_EVENT));
}

async function refreshSiteMeta() {
  try {
    const response = await fetch("/api/site/meta", { credentials: "same-origin" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || "Failed to load footer metadata");
    applyAutomaticFooter(data);
  } catch (error) {
    console.error("Failed to refresh footer metadata:", error);
    applyAutomaticFooter(null);
  }
}


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



function setupNavToggle() {
  const topbar = document.getElementById("site-topbar");
  const toggleBtn = document.getElementById("nav-toggle-btn");
  const nav = document.getElementById("site-nav");
  if (!topbar || !toggleBtn || !nav) return;

  const closeNav = () => {
    topbar.classList.remove("nav-open");
    toggleBtn.setAttribute("aria-expanded", "false");
  };

  toggleBtn.addEventListener("click", () => {
    const isOpen = topbar.classList.toggle("nav-open");
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a, button").forEach((item) => {
    item.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 820px)").matches) closeNav();
    });
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 820px)").matches) closeNav();
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
    setupNavToggle();
    applyCasinoBalance();
    refreshCasinoBalance();
    refreshSiteMeta();
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

let profileChipRefreshToken = 0;

async function refreshProfileChipStyle() {
  const currentToken = ++profileChipRefreshToken;
  const profileLink = document.getElementById("header-profile-link");
  if (!profileLink) return;

  profileLink.style.removeProperty("--profile-chip-bg");
  profileLink.style.removeProperty("--profile-chip-border");
  profileLink.style.removeProperty("--profile-chip-hover-bg");

  try {
    const response = await fetch("/api/profile/me", { credentials: "same-origin" });
    const data = await response.json().catch(() => null);
    if (currentToken !== profileChipRefreshToken) return;
    if (!response.ok || !data?.success || !data?.profile) return;

    const accent = String(data.profile.profile_accent_color || "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(accent)) {
      profileLink.style.setProperty("--profile-chip-bg", `color-mix(in srgb, ${accent} 28%, var(--surface))`);
      profileLink.style.setProperty("--profile-chip-border", `color-mix(in srgb, ${accent} 70%, var(--border))`);
      profileLink.style.setProperty("--profile-chip-hover-bg", `color-mix(in srgb, ${accent} 40%, var(--surface))`);
    }
  } catch (error) {
    console.error("Failed to refresh profile chip style:", error);
  }
}

function applyHeaderAuthState(user) {
  const authOnlyItems = document.querySelectorAll("[data-auth-only]");
  const guestOnlyItems = document.querySelectorAll("[data-guest-only]");
  const adminOnlyItems = document.querySelectorAll("[data-admin-only]");
  const siteAdminOnlyItems = document.querySelectorAll("[data-site-admin-only]");
  const profileName = document.getElementById("header-profile-name");
  const profileAvatar = document.getElementById("header-profile-avatar");
  const profileLink = document.getElementById("header-profile-link");

  authOnlyItems.forEach((item) => {
    item.classList.toggle("hidden", !user);
  });

  guestOnlyItems.forEach((item) => {
    item.classList.toggle("hidden", !!user);
  });

  const canAccessAdminPortal = Boolean(user?.is_admin || user?.gambling_admin);
  adminOnlyItems.forEach((item) => {
    item.classList.toggle("hidden", !canAccessAdminPortal);
  });

  const isSiteAdmin = user?.is_admin === true;
  siteAdminOnlyItems.forEach((item) => {
    item.classList.toggle("hidden", !isSiteAdmin);
  });

  if (profileName) profileName.textContent = user?.username || "Profile";
  if (profileAvatar) {
    const avatarUrl = String(user?.avatar_url || "").trim();
    if (avatarUrl) {
      profileAvatar.src = avatarUrl;
      profileAvatar.alt = `${user?.username || "User"} avatar`;
      profileAvatar.classList.remove("hidden");
    } else {
      profileAvatar.removeAttribute("src");
      profileAvatar.alt = "";
      profileAvatar.classList.add("hidden");
    }
  }

  if (profileLink && user) refreshProfileChipStyle();
}


document.addEventListener("DOMContentLoaded", () => {
  applyTheme(getInitialTheme());
  loadSharedHeader();
});

window.fetchCurrentUser = fetchCurrentUser;
window.readCachedAuthUser = readCachedAuthUser;
window.writeCasinoBalance = writeCasinoBalance;
