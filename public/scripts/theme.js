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
  function updateRangeProgress(input) {
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value || 0);
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, pct))}%`);
  }
  function initRangeSliders(root = document) {
    root.querySelectorAll('input[type="range"]').forEach((input) => {
      updateRangeProgress(input);
      if (input.dataset.rangeInit === '1') return;
      input.dataset.rangeInit = '1';
      input.addEventListener('input', () => updateRangeProgress(input));
      input.addEventListener('change', () => updateRangeProgress(input));
    });
  }
  window.GREVTheme = { applyTheme: setTheme, toggleTheme, syncButton, updateRangeProgress, initRangeSliders };
  applyTheme(getStoredTheme());
  document.addEventListener('DOMContentLoaded', () => { syncButton(document.documentElement.dataset.theme || DARK); initRangeSliders(); const b=document.getElementById('theme-toggle'); if (b) b.addEventListener('click', toggleTheme); });
})();
