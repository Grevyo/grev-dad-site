async function loadHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  try {
    // 1. Fetch the static HTML structure
    const res = await fetch("/header.html");
    const htmlText = await res.text();
    mount.innerHTML = htmlText;

    // 2. Grab all potential nav elements
    const navLogin = document.getElementById("navLogin");
    const navRegister = document.getElementById("navRegister");
    const navCases = document.getElementById("navCases");
    const navMembers = document.getElementById("navMembers");
    const navProfile = document.getElementById("navProfile");
    const navAdmin = document.getElementById("navAdmin");
    const navLogout = document.getElementById("navLogout");
    const navWelcome = document.getElementById("navWelcome");

    // 3. Check authentication with a Cache Buster
    // This 'nocache' parameter is vital to stop the browser from 
    // showing you a "logged in" state from its memory.
    const meRes = await fetch(`/api/me?nocache=${Date.now()}`, { 
      credentials: "include" 
    });

    // --- CASE A: USER IS NOT LOGGED IN (OR JUST LOGGED OUT) ---
    if (!meRes.ok) {
      // Ensure Guest links are VISIBLE
      if (navLogin) navLogin.classList.remove("hidden");
      if (navRegister) navRegister.classList.remove("hidden");

      // FORCE HIDE all Member/Admin links (The "Safety Scrub")
      if (navCases) navCases.classList.add("hidden");
      if (navMembers) navMembers.classList.add("hidden");
      if (navProfile) navProfile.classList.add("hidden");
      if (navAdmin) navAdmin.classList.add("hidden");
      if (navLogout) navLogout.classList.add("hidden");
      if (navWelcome) navWelcome.classList.add("hidden");
      
      return; 
    }

    // --- CASE B: USER IS LOGGED IN ---
    const data = await meRes.json();
    if (!data || !data.user) return;

    // Hide Guest links
    if (navLogin) navLogin.classList.add("hidden");
    if (navRegister) navRegister.classList.add("hidden");
    
    // Show Member links
    if (navCases) navCases.classList.remove("hidden");
    if (navMembers) navMembers.classList.remove("hidden");
    if (navLogout) navLogout.classList.remove("hidden");

    if (navProfile) {
      navProfile.classList.remove("hidden");
      navProfile.href = `/profile.html?id=${data.user.id}`; 
    }

    // Admin Check
    if (data.user.is_admin && navAdmin) {
      navAdmin.classList.remove("hidden");
    }

    // Welcome Message
    if (navWelcome) {
      navWelcome.textContent = `Welcome, ${data.user.username}`;
      navWelcome.classList.remove("hidden");
    }

  } catch (err) {
    console.error("Header load failed:", err);
  }
}

// Initial Load
loadHeader();
