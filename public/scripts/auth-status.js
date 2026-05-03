(function () {
  function createLink(href, label, className) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    link.className = className || 'nav-button';
    return link;
  }

  function createButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.className = className || 'nav-button';
    button.addEventListener('click', onClick);
    return button;
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

  function getInitials(displayName, username) {
    const source = (displayName || username || '').trim();
    if (!source) return '?';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }

  function getCurrentPath() {
    return (window.location.pathname || '/').toLowerCase();
  }

  function renderLoggedOut(container) {
    const path = getCurrentPath();
    const isLoginPage = path.endsWith('/login.html');
    const isRegisterPage = path.endsWith('/register.html') || path.endsWith('/unregistered.html');
    container.textContent = '';
    if (!isLoginPage) container.append(createLink('/login.html', 'Login'));
    if (!isRegisterPage) container.append(createLink('/register.html', 'Register'));
    container.append(createThemeToggle());
  }

  function removeProfileSummary(container) {
    const header = container.closest('.site-header');
    if (!header) return;
    const existing = header.querySelector('.compact-header-account');
    if (existing) existing.remove();
  }

  function createProfileSummary(profile) {
    const summaryLink = document.createElement('a');
    summaryLink.href = '/profile.html';
    summaryLink.title = 'Open profile';
    summaryLink.className = 'compact-header-account';

    const avatarWrap = document.createElement('span');
    avatarWrap.className = 'compact-header-avatar';
    if (profile.avatarUrl) {
      const avatarImg = document.createElement('img');
      avatarImg.src = profile.avatarUrl;
      avatarImg.alt = profile.displayName + ' avatar';
      avatarImg.loading = 'lazy';
      avatarWrap.append(avatarImg);
    } else {
      const fallback = document.createElement('span');
      fallback.className = 'compact-header-avatar-fallback';
      fallback.textContent = getInitials(profile.displayName, profile.username);
      avatarWrap.append(fallback);
    }

    const textWrap = document.createElement('span');
    textWrap.className = 'compact-header-text';
    const displayName = document.createElement('span');
    displayName.className = 'compact-header-name';
    displayName.textContent = profile.displayName || profile.username;
    const username = document.createElement('span');
    username.className = 'compact-header-username';
    username.textContent = '@' + profile.username;
    const meta = document.createElement('span');
    meta.className = 'compact-header-meta';
    const lvl = window.renderLevelBadge ? window.renderLevelBadge(profile.level) : null;
    if (lvl) meta.append(lvl, document.createTextNode(' · ' + (profile.rankName || 'Unranked')));
    else meta.textContent = profile.rankName ? ('Level ' + profile.level + ' · ' + profile.rankName) : ('Level ' + profile.level + ' · Unranked');
    textWrap.append(displayName, username, meta);
    summaryLink.append(avatarWrap, textWrap);
    return summaryLink;
  }

  async function handleLogout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        const text = await response.text();
        window.alert('Logout failed. Redirecting to login. ' + (text ? '(' + text.slice(0, 120) + ')' : ''));
      }
    } catch {
      window.alert('Logout request failed. Redirecting to login.');
    } finally {
      window.location.href = '/unregistered.html';
    }
  }

  function renderLoggedIn(container, user, profile) {
    const username = typeof user?.username === 'string' ? user.username.trim() : '';
    if (!username) return renderLoggedOut(container);

    const isAdmin = user?.is_admin === true || Number(user?.is_admin) === 1 || user?.role === 'admin';
    const accountProfile = {
      username,
      displayName: profile.displayName || username,
      avatarUrl: profile.avatarUrl || '',
      level: Number.isFinite(profile.level) && profile.level > 0 ? profile.level : 1,
      rankName: profile.rankName || ''
    };

    const header = container.closest('.site-header');
    if (header) {
      removeProfileSummary(container);
      header.insertBefore(createProfileSummary(accountProfile), container);
    }

    container.textContent = '';
    container.append(createLink('/members.html', 'Members'));
    container.append(createLink('/leaderboard.html', 'Leaderboard'));
    if (isAdmin) container.append(createLink('/admin.html', 'Admin', 'nav-button admin-link'));
    const logoutButton = createButton('🚪➡️', 'nav-button logout-button', handleLogout);
    logoutButton.setAttribute('aria-label', 'Log out');
    logoutButton.title = 'Log out';
    container.append(logoutButton);
    container.append(createThemeToggle());
  }


  function ensureChatWidget(user) {
    if (!user || !user.id) return;
    if (window.location.pathname.endsWith('/login.html') || window.location.pathname.endsWith('/register.html') || window.location.pathname.endsWith('/unregistered.html')) return;
    const mount = function(){ if (window.GREVChat?.mount) { window.GREVChat.currentUserId = Number(user?.id) || null; window.GREVChat.mount(); } };
    if (window.GREVChat?.mount) return mount();
    if (document.querySelector('script[data-chat-widget="1"]')) return;
    const script = document.createElement('script');
    script.src = '/scripts/chat-widget.js';
    script.dataset.chatWidget = '1';
    script.onload = mount;
    document.body.append(script);
  }


  function teardownChatWidget() {
    const launcher = document.getElementById('chat-launcher');
    const popup = document.getElementById('chat-popup');
    if (launcher) launcher.remove();
    if (popup) popup.remove();
    if (window.GREVChat?.destroy) window.GREVChat.destroy();
  }

  function parseProfileData(authUser, profileUser) {
    const baseName = typeof authUser?.username === 'string' ? authUser.username.trim() : '';
    const displayName = typeof profileUser?.display_name === 'string' && profileUser.display_name.trim() ? profileUser.display_name.trim() : (typeof authUser?.display_name === 'string' && authUser.display_name.trim() ? authUser.display_name.trim() : baseName);
    const avatarUrl = typeof profileUser?.avatar_url === 'string' && profileUser.avatar_url.trim() ? profileUser.avatar_url.trim() : (typeof authUser?.avatar_url === 'string' ? authUser.avatar_url.trim() : '');
    const levelRaw = profileUser?.account_level ?? authUser?.account_level ?? profileUser?.level ?? authUser?.level;
    const parsedLevel = Number(levelRaw);
    const rankName = profileUser?.rank?.name || profileUser?.displayed_rank?.name || authUser?.rank?.name || authUser?.displayed_rank?.name || '';
    return { displayName, avatarUrl, level: Number.isFinite(parsedLevel) && parsedLevel > 0 ? parsedLevel : 1, rankName: typeof rankName === 'string' ? rankName.trim() : '' };
  }

  async function safeFetchJson(url) {
    const response = await fetch(url, { method: 'GET' });
    const raw = await response.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }
    return { response, data };
  }

  const PROFILE_CACHE_KEY = 'grev_header_profile_cache';
  const PROFILE_CACHE_TTL_MS = 60 * 1000;

  function readProfileCache(username) {
    try {
      const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.username !== username) return null;
      if (!Number.isFinite(parsed.timestamp) || Date.now() - parsed.timestamp > PROFILE_CACHE_TTL_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeProfileCache(data) {
    try {
      sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        username: data.username,
        display_name: data.display_name || '',
        avatar_url: data.avatar_url || '',
        accountLevel: Number(data.accountLevel) || 1,
        rank: data.rank || '',
        timestamp: Date.now()
      }));
    } catch {}
  }

  async function loadAuthStatus() {
    const container = document.getElementById('authStatus');
    if (!container) return;
    renderLoggedOut(container);

    try {
      const authStart = performance.now();
      const { response, data } = await safeFetchJson('/api/auth/me');
      console.debug('[auth-status] /api/auth/me took', Math.round(performance.now() - authStart), 'ms');
      const user = data?.user;
      if (!response.ok || !user || !user.username) {
        removeProfileSummary(container);
        teardownChatWidget();
        renderLoggedOut(container);
        return;
      }

      const cached = readProfileCache(user.username);
      const cachedProfile = cached ? {
        displayName: cached.display_name || user.username,
        avatarUrl: cached.avatar_url || '',
        level: Number(cached.accountLevel) || 1,
        rankName: cached.rank || ''
      } : { displayName: user.username, avatarUrl: '', level: 1, rankName: '' };
      renderLoggedIn(container, user, cachedProfile);
      ensureChatWidget(user);

      (async function refreshProfile() {
        try {
          const profileStart = performance.now();
          const profileResp = await safeFetchJson('/api/profile/me');
          console.debug('[auth-status] /api/profile/me took', Math.round(performance.now() - profileStart), 'ms');
          if (!profileResp.response.ok) return;
          const profileUser = profileResp.data?.profile || profileResp.data?.user || null;
          const parsed = parseProfileData(user, profileUser);
          renderLoggedIn(container, user, parsed);
          writeProfileCache({
            username: user.username,
            display_name: parsed.displayName,
            avatar_url: parsed.avatarUrl,
            accountLevel: parsed.level,
            rank: parsed.rankName
          });
        } catch {}
      })();
    } catch {
      removeProfileSummary(container);
      teardownChatWidget();
      renderLoggedOut(container);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAuthStatus);
  else loadAuthStatus();
})();
