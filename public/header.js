async function loadHeader() {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  // 1. Fetch the static HTML structure
  const res = await fetch("/header.html", { credentials: "include" });
  mount.innerHTML = await res.text();

  try {
    // 2. Check if the user is authenticated
    const meRes = await fetch("/api/me", { credentials: "include" });
    if (!meRes.ok) return;

    const data = await meRes.json();
    
    // Check if the user object exists in the response
    if (!data.user) return;

    // 3. Grab the elements from the freshly injected HTML
    const navLogin = document.getElementById("navLogin");
    const navRegister = document.getElementById("navRegister");
    const navMembers = document.getElementById("navMembers");
    const navProfile = document.getElementById("navProfile");
    const navAdmin = document.getElementById("navAdmin");
    const navLogout = document.getElementById("navLogout");
    const navWelcome = document.getElementById("navWelcome"); // Add this to your header.html if you want "Welcome, Name"

    // 4. Toggle visibility
    if (navLogin) navLogin.classList.add("hidden");
    if (navRegister) navRegister.classList.add("hidden");
    
    if (navMembers) navMembers.classList.remove("hidden");
    if (navProfile) {
      navProfile.classList.remove("hidden");
      navProfile.href = `/user.html?id=${data.user.id}`; // Dynamic link to their own profile
    }
    if (navLogout) navLogout.classList.remove("hidden");

    if (data.user.is_admin && navAdmin) {
      navAdmin.classList.remove("hidden");
    }

    // 5. Set the Welcome message
    if (navWelcome) {
      navWelcome.textContent = `Welcome, ${data.user.username}`;
      navWelcome.classList.remove("hidden");
    }

  } catch (err) {
    console.error("Header load failed", err);
  }
}

loadHeader();
