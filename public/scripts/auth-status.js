(function () {
  function createLink(href, label) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    return link;
  }

  function createSeparator() {
    return document.createTextNode(' | ');
  }

  function renderLoggedOut(container) {
    container.textContent = '';
    container.append(createLink('/login.html', 'Login'));
    container.append(createSeparator());
    container.append(createLink('/register.html', 'Register'));
  }

  function renderLoggedIn(container, user) {
    const username = typeof user?.username === 'string' ? user.username.trim() : '';
    if (!username) {
      renderLoggedOut(container);
      return;
    }

    const isAdmin = user?.is_admin === true || user?.role === 'admin';

    container.textContent = '';
    container.append(document.createTextNode('Logged in as: ' + username));
    if (isAdmin) {
      container.append(createSeparator());
      container.append(createLink('/admin.html', 'Admin'));
    }
    container.append(createSeparator());

    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
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
