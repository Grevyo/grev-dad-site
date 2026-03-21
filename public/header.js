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
    const meRes = await fetch(`/api/me?nocache=${Date.now()}`, { 
      credentials: "include" 
    });

    // --- CASE A: USER IS NOT LOGGED IN ---
    if (!meRes.ok) {
      if (navLogin) navLogin.classList.remove("hidden");
      if (navRegister) navRegister.classList.remove("hidden");

      // Hide all Member/Admin links
      [navCases, navMembers, navProfile, navAdmin, navLogout, navWelcome].forEach(el => {
        if (el) el.classList.add("hidden");
      });
      
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

    // UPDATED: Set Profile link to profile.html
    if (navProfile) {
      navProfile.classList.remove("hidden");
      navProfile.setAttribute("href", `/profile.html?id=${data.user.id}`);
    }

    // Admin Check
    if (data.user.is_admin && navAdmin) {
      navAdmin.classList.remove("hidden");
    }

    // Welcome Message - Make it a clickable shortcut to profile
    if (navWelcome) {
      navWelcome.textContent = `Welcome, ${data.user.username}`;
      navWelcome.classList.remove("hidden");
      // Optional: if your welcome element is an <a> tag, this makes it clickable
      if (navWelcome.tagName === 'A') {
        navWelcome.setAttribute("href", `/profile.html?id=${data.user.id}`);
      }
    }

  } catch (err) {
    console.error("Header load failed:", err);
  }
}

// Initial Load
loadHeader();
