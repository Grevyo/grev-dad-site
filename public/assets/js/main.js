// Shared header loader and auth-state synchronizer used by every page that mounts the top navigation.
// public/scripts/header.js

const AUTH_CACHE_KEY = "grevdad_auth_user";
const AUTH_CACHE_EVENT = "grevdad-auth-changed";

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

document.addEventListener("DOMContentLoaded", loadSharedHeader);
