(function () {
  function createLink(href, label, className) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    link.className = className || 'nav-button';
    return link;
  }

  function createThemeToggle() {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'theme-toggle';
    button.className = 'nav-button icon-button theme-toggle';
    button.textContent = document.documentElement.dataset.theme === 'light' ? '🌙' : '💡';

    const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const action = current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    button.setAttribute('aria-label', action);
    button.title = action;

    button.addEventListener('click', function () { if (window.GREVTheme?.toggleTheme) { window.GREVTheme.toggleTheme(); } });

    return button;
  }

  function renderLoggedOut(container) {
    container.textContent = '';
    container.append(createLink('/login.html', 'Login'));
    container.append(createLink('/register.html', 'Register'));
    container.append(createThemeToggle());
  }

  function renderLoggedIn(container, user) {
    const username = typeof user?.username === 'string' ? user.username.trim() : '';
    if (!username) {
      renderLoggedOut(container);
      return;
    }

    const isAdmin = user?.is_admin === true || Number(user?.is_admin) === 1 || user?.role === 'admin';

    container.textContent = '';
    container.append(createLink('/members.html', 'Members'));
    container.append(createLink('/account.html', 'Account'));

    if (isAdmin) {
      container.append(createLink('/admin.html', 'Admin', 'nav-button admin-link'));
    }

    container.append(createThemeToggle());
    container.append(createLink('/profile.html', username, 'nav-button user-button'));

    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.className = 'nav-button logout-button';
    logoutButton.textContent = 'Logout';
    logoutButton.addEventListener('click', async function () {
      logoutButton.disabled = true;
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Ignore network errors and still move user to login.
      }
      window.location.href = '/login.html';
    });

    container.append(logoutButton);
  }

  async function loadAuthStatus() {
    var container = document.getElementById('authStatus');
    if (!container) {
      return;
    }

    container.textContent = 'Checking login...';

    try {
      const response = await fetch('/api/auth/me', { method: 'GET' });
      const text = await response.text();

      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          renderLoggedOut(container);
          return;
        }
      }

      const user = data?.user;
      if (!response.ok || !user || !user.username) {
        renderLoggedOut(container);
        return;
      }

      renderLoggedIn(container, user);
    } catch {
      renderLoggedOut(container);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAuthStatus);
  } else {
    loadAuthStatus();
  }
})();
