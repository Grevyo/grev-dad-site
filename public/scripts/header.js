// public/scripts/header.js

const AUTH_CACHE_KEY = "grevdad_auth_user";
const AUTH_CACHE_EVENT = "grevdad-auth-changed";
const PAGE_LOAD_BOX_ID = "global-page-load-indicator";

function ensurePageLoadIndicator() {
  if (document.getElementById(PAGE_LOAD_BOX_ID)) return;

  const style = document.createElement("style");
  style.textContent = `
    .global-page-load-indicator { position: fixed; right: 18px; bottom: 18px; width: min(320px, calc(100vw - 36px)); z-index: 3000; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(2,6,23,0.92); box-shadow: 0 20px 50px rgba(0,0,0,0.35); padding: 14px 16px; color: #e2e8f0; transition: opacity 0.18s ease, transform 0.18s ease; }
    .global-page-load-indicator.hidden { opacity: 0; transform: translateY(12px); pointer-events: none; }
    .global-page-load-indicator.error { border-color: rgba(239,68,68,0.45); }
    .global-page-load-title { margin: 0 0 6px; font-size: 0.95rem; font-weight: 800; }
    .global-page-load-text { margin: 0 0 10px; font-size: 0.88rem; color: #94a3b8; }
    .global-page-load-bar { width: 100%; height: 7px; border-radius: 999px; overflow: hidden; background: rgba(148,163,184,0.18); }
    .global-page-load-bar > span { display:block; width: 18%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #38bdf8, #a78bfa); transition: width 0.18s ease; }
  `;
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.id = PAGE_LOAD_BOX_ID;
  box.className = "global-page-load-indicator hidden";
  box.innerHTML = `
    <p class="global-page-load-title">Loading page</p>
    <p class="global-page-load-text">Starting…</p>
    <div class="global-page-load-bar"><span></span></div>
  `;
  document.body.appendChild(box);
}

function setPageLoadStatus(text, percent = 35, { error = false, hold = false } = {}) {
  ensurePageLoadIndicator();
  const box = document.getElementById(PAGE_LOAD_BOX_ID);
  if (!box) return;
  box.classList.remove("hidden");
  box.classList.toggle("error", error);
  box.querySelector(".global-page-load-text").textContent = text;
  box.querySelector(".global-page-load-title").textContent = error ? "Page load issue" : "Loading page";
  box.querySelector(".global-page-load-bar > span").style.width = `${Math.max(6, Math.min(100, percent))}%`;
  if (!hold && !error && percent >= 100) {
    window.setTimeout(() => box.classList.add("hidden"), 450);
  }
}

window.showPageLoadStatus = (text, percent = 35) => setPageLoadStatus(text, percent);
window.showPageLoadError = (text) => setPageLoadStatus(text, 100, { error: true, hold: true });
window.hidePageLoadStatus = () => setPageLoadStatus("Done.", 100);

async function loadSharedHeader() {
  const mount = document.getElementById("header-mount");
  if (!mount) return;
  ensurePageLoadIndicator();
  setPageLoadStatus("Loading header…", 18);

  try {
    const response = await fetch("/header.html", { cache: "no-store" });
    const html = await response.text();
    mount.innerHTML = html;
    setPageLoadStatus("Checking account state…", 40);

    const cachedUser = readCachedAuthUser();
    applyHeaderAuthState(cachedUser);

    const auth = await fetchCurrentUser({ preferCache: !cachedUser });
    applyHeaderAuthState(auth);
    setPageLoadStatus("Header ready…", 72);

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
    window.showPageLoadError("Could not load the page header.");
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

window.addEventListener("load", () => {
  if (!document.querySelector("#profile-load-indicator")) {
    window.hidePageLoadStatus();
  }
});
window.addEventListener("error", () => {
  window.showPageLoadError("A page error occurred while loading.");
});
window.addEventListener("unhandledrejection", () => {
  window.showPageLoadError("A request failed while loading this page.");
});

document.addEventListener("DOMContentLoaded", loadSharedHeader);
