async function loadHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  const res = await fetch("/header.html", { credentials: "include" });
  const html = await res.text();
  mount.innerHTML = html;

  try {
    const meRes = await fetch("/api/me", { credentials: "include" });
    if (!meRes.ok) return;

    const data = await meRes.json();
    if (!data.loggedIn) return;

    const navLogin = document.getElementById("navLogin");
    const navRegister = document.getElementById("navRegister");
    const navMembers = document.getElementById("navMembers");
    const navProfile = document.getElementById("navProfile");
    const navAdmin = document.getElementById("navAdmin");
    const navLogout = document.getElementById("navLogout");

    if (navLogin) navLogin.classList.add("hidden");
    if (navRegister) navRegister.classList.add("hidden");
    if (navMembers) navMembers.classList.remove("hidden");
    if (navProfile) navProfile.classList.remove("hidden");
    if (navLogout) navLogout.classList.remove("hidden");

    if (data.user.is_admin && navAdmin) {
      navAdmin.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Header load failed", err);
  }
}

loadHeader();