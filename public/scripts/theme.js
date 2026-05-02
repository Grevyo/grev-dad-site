(function () {
  const THEME_KEY = 'grev_theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  function getStoredTheme() {
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === LIGHT || value === DARK ? value : DARK;
    } catch {
      return DARK;
    }
  }

  function applyTheme(theme) {
    const next = theme === LIGHT ? LIGHT : DARK;
    document.documentElement.dataset.theme = next;
    return next;
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage errors.
    }
  }

  function getButton() {
    return document.getElementById('theme-toggle');
  }

  function syncButtonText(theme) {
    const button = getButton();
    if (!button) return;
    button.textContent = theme === DARK ? 'Light mode' : 'Dark mode';
  }

  function setTheme(theme, shouldPersist) {
    const applied = applyTheme(theme);
    if (shouldPersist) persistTheme(applied);
    syncButtonText(applied);
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme === LIGHT ? LIGHT : DARK;
    setTheme(current === DARK ? LIGHT : DARK, true);
  }

  window.GREVTheme = { applyTheme: setTheme, toggleTheme };

  const initialTheme = getStoredTheme();
  applyTheme(initialTheme);

  function initToggle() {
    const button = getButton();
    if (!button) return;
    syncButtonText(document.documentElement.dataset.theme || DARK);
    button.addEventListener('click', toggleTheme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle);
  } else {
    initToggle();
  }
})();
