/**
 * Shared Grev Coins strip for all gambling pages (/gambling/*).
 * Uses GET /api/gambling/profile — same wallet everywhere (cases, future blackjack, etc.).
 */
(function () {
  function formatGrevCoins(pence) {
    const n = Number(pence || 0) / 100;
    return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}GC`;
  }

  async function refreshGamblingWallet() {
    const mount = document.getElementById("gambling-wallet-mount");
    if (!mount) return;

    mount.innerHTML = `<span class="balance-pill">Grev Coins: —</span><span class="balance-pill">🔑 Keys: —</span><span class="balance-pill">Inventory (ref.): —</span>`;

    try {
      const response = await fetch("/api/gambling/profile", { credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        mount.innerHTML =
          `<span class="balance-pill muted">Grev Coins — <a href="/login.html">sign in</a> to view</span>`;
        return;
      }
      const p = data.profile || {};
      const bal = formatGrevCoins(p.balance);
      const keys = Number(p.key_balance ?? 0);
      const inv = formatGrevCoins(p.total_inventory_value);
      mount.innerHTML = `
        <span class="balance-pill">Grev Coins: ${bal}</span>
        <span class="balance-pill">🔑 ${keys} keys</span>
        <span class="balance-pill">Inventory (ref.): ${inv}</span>
      `;
    } catch {
      mount.innerHTML = `<span class="balance-pill muted">Wallet unavailable</span>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    refreshGamblingWallet();
    setInterval(() => {
      if (document.visibilityState === "visible") refreshGamblingWallet();
    }, 60000);
  });

  window.refreshGamblingWallet = refreshGamblingWallet;
})();
