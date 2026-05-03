(function () {
  const THEME_KEY = 'grev_theme';
  const DARK = 'dark';
  const LIGHT = 'light';
  const ICONS = { dark: '💡', light: '🌙' };

  function getStoredTheme() { try { const v = localStorage.getItem(THEME_KEY); return v === LIGHT || v === DARK ? v : DARK; } catch { return DARK; } }
  function applyTheme(theme) { const next = theme === LIGHT ? LIGHT : DARK; document.documentElement.dataset.theme = next; return next; }
  function persistTheme(theme) { try { localStorage.setItem(THEME_KEY, theme); } catch {} }
  function syncButton(theme) { const b = document.getElementById('theme-toggle'); if (!b) return; const action = theme === DARK ? 'Switch to light mode' : 'Switch to dark mode'; b.textContent = theme === DARK ? ICONS.dark : ICONS.light; b.setAttribute('aria-label', action); b.title = action; }
  function setTheme(theme, save) { const applied = applyTheme(theme); if (save) persistTheme(applied); syncButton(applied); }
  function toggleTheme() { const current = document.documentElement.dataset.theme === LIGHT ? LIGHT : DARK; setTheme(current === DARK ? LIGHT : DARK, true); }
  window.GREVTheme = { applyTheme: setTheme, toggleTheme, syncButton };
  applyTheme(getStoredTheme());
  document.addEventListener('DOMContentLoaded', () => { syncButton(document.documentElement.dataset.theme || DARK); const b=document.getElementById('theme-toggle'); if (b) b.addEventListener('click', toggleTheme); });
})();
