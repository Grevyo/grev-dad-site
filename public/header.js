async function loadHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  // 1. Fetch the static HTML structure
  const res = await fetch("/header.html");
  mount.innerHTML = await res.text();

  try {
    // 2. Check if the user is authenticated
    const meRes = await fetch("/api/me", { credentials: "include" });
    
    // If not logged in, we just leave the header as-is (showing Login/Register)
    if (!meRes.ok) return;

    const data = await meRes.json();
    
    // Check if the user object exists in the response
    if (!data || !data.user) return;

    // 3. Grab the elements from the freshly injected HTML
    const navLogin = document.getElementById("navLogin");
    const navRegister = document.getElementById("navRegister");
    const navCases = document.getElementById("navCases"); // Added this
    const navMembers = document.getElementById("navMembers");
    const navProfile = document.getElementById("navProfile");
    const navAdmin = document.getElementById("navAdmin");
    const navLogout = document.getElementById("navLogout");
    const navWelcome = document.getElementById("navWelcome");

    // 4. Toggle visibility - HIDE auth links
    if (navLogin) navLogin.classList.add("hidden");
    if (navRegister) navRegister.classList.add("hidden");
    
    // 5. Toggle visibility - SHOW member links
    if (navCases) navCases.classList.remove("hidden"); // Reveal Case Opener
    if (navMembers) navMembers.classList.remove("hidden");
    if (navLogout) navLogout.classList.remove("hidden");

    if (navProfile) {
      navProfile.classList.remove("hidden");
      // Updated to match your profile.html naming convention
      navProfile.href = `/profile.html?id=${data.user.id}`; 
    }

    // 6. Admin Check
    if (data.user.is_admin && navAdmin) {
      navAdmin.classList.remove("hidden");
    }

    // 7. Set the Welcome message
    if (navWelcome) {
      navWelcome.textContent = `Welcome, ${data.user.username}`;
      navWelcome.classList.remove("hidden");
    }

  } catch (err) {
    console.error("Header load failed", err);
  }
}

loadHeader();
