async function loadHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  // 1. Fetch the static HTML structure
  const res = await fetch("/header.html");
  mount.innerHTML = await res.text();

  try {
    // 2. Check authentication with a Cache Buster
    // Adding a timestamp (?t=...) ensures the browser gets a fresh status
    const meRes = await fetch(`/api/me?t=${Date.now()}`, { 
      credentials: "include" 
    });

    // Grab the elements from the freshly injected HTML
    const navLogin = document.getElementById("navLogin");
    const navRegister = document.getElementById("navRegister");
    const navCases = document.getElementById("navCases");
    const navMembers = document.getElementById("navMembers");
    const navProfile = document.getElementById("navProfile");
    const navAdmin = document.getElementById("navAdmin");
    const navLogout = document.getElementById("navLogout");
    const navWelcome = document.getElementById("navWelcome");

    // If NOT logged in (401), ensure auth links are visible and exit
    if (!meRes.ok) {
      if (navLogin) navLogin.classList.remove("hidden");
      if (navRegister) navRegister.classList.remove("hidden");
      return; 
    }

    const data = await meRes.json();
    if (!data || !data.user) return;

    // 3. User is Logged In: Toggle visibility
    if (navLogin) navLogin.classList.add("hidden");
    if (navRegister) navRegister.classList.add("hidden");
    
    if (navCases) navCases.classList.remove("hidden");
    if (navMembers) navMembers.classList.remove("hidden");
    if (navLogout) navLogout.classList.remove("hidden");

    if (navProfile) {
      navProfile.classList.remove("hidden");
      // Matches your profile.html naming
      navProfile.href = `/profile.html?id=${data.user.id}`; 
    }

    if (data.user.is_admin && navAdmin) {
      navAdmin.classList.remove("hidden");
    }

    if (navWelcome) {
      navWelcome.textContent = `Welcome, ${data.user.username}`;
      navWelcome.classList.remove("hidden");
    }

  } catch (err) {
    console.error("Header load failed", err);
  }
}

loadHeader();
