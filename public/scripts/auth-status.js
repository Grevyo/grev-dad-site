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

  function loadScriptOnce(src, marker) {
    return new Promise((resolve, reject) => {
      if (marker && window[marker]) return resolve();
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (marker && window[marker]) return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.append(script);
    });
  }

  async function ensureHeaderDependencies() {
    if (!window.renderPlayerCard) await loadScriptOnce('/scripts/player-card.js', 'renderPlayerCard');
    if (!window.levelBadgeHtml) {
      try { await loadScriptOnce('/scripts/level-badge.js', 'grevDad'); } catch {}
    }
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

  function cleanupHeaderProfileArtifacts(container) {
    const header = container.closest('.site-header');
    if (!header) return;
    header.querySelectorAll('.compact-header-account, .header-player-card, .player-card-header-variant').forEach((el) => {
      if (el.closest('.site-header')) el.remove();
    });
  }

  function createProfileSummary(profile) {
    if (window.renderPlayerCard) {
      const template = document.createElement('template');
      template.innerHTML = String(window.renderPlayerCard(profile, { variant: 'header', showXp: true, useCardSettings: true }) || '').trim();
      if (template.content.firstElementChild) return template.content.firstElementChild;
    }
    const fallback = document.createElement('a');
    fallback.href = '/profile.html';
    fallback.className = 'header-player-card player-card-header-variant';
    fallback.textContent = profile.username || 'Profile';
    return fallback;
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
    const accountProfile = { ...profile,
      username,
      display_name: profile.display_name || username,
      avatar_url: profile.avatar_url || '',
      accountLevel: Number.isFinite(profile.accountLevel) && profile.accountLevel > 0 ? profile.accountLevel : 1
    };

    const header = container.closest('.site-header');
    if (header) {
      cleanupHeaderProfileArtifacts(container);
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
    const displayName = typeof profileUser?.display_name === 'string' && profileUser.display_name.trim() ? profileUser.display_name.trim() : baseName;
    const avatarUrl = typeof profileUser?.avatar_url === 'string' && profileUser.avatar_url.trim() ? profileUser.avatar_url.trim() : '';
    const levelRaw = profileUser?.accountLevel ?? profileUser?.account_level ?? authUser?.account_level ?? profileUser?.level ?? authUser?.level;
    const parsedLevel = Number(levelRaw);
    const rankName = profileUser?.rank?.name || authUser?.rank?.name || '';
    return { ...profileUser, username: baseName, display_name: displayName, avatar_url: avatarUrl, accountLevel: Number.isFinite(parsedLevel) && parsedLevel > 0 ? parsedLevel : 1, rank: { name: typeof rankName === 'string' ? rankName.trim() : '' } };
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

  const PROFILE_CACHE_KEY = 'grev_header_profile_cache_v2';
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
        card_background_url: data.card_background_url || '',
        card_background_colour: data.card_background_colour || '',
        card_accent_colour: data.card_accent_colour || '',
        card_text_colour: data.card_text_colour || '',
        card_border_colour: data.card_border_colour || '',
        card_layout: data.card_layout || 'standard',
        card_show_avatar: Number(data.card_show_avatar ?? 1),
        card_show_display_name: Number(data.card_show_display_name ?? 1),
        card_show_username: Number(data.card_show_username ?? 1),
        card_show_user_id: Number(data.card_show_user_id ?? 0),
        card_show_role: Number(data.card_show_role ?? 1),
        card_show_level: Number(data.card_show_level ?? 1),
        card_show_rank: Number(data.card_show_rank ?? 1),
        card_show_xp: Number(data.card_show_xp ?? 1),
        card_show_status: Number(data.card_show_status ?? 0),
        card_show_steam: Number(data.card_show_steam ?? 0),
        card_show_leetify: Number(data.card_show_leetify ?? 0),
        card_show_leetify_rank: Number(data.card_show_leetify_rank ?? 0),
        card_show_leetify_rating: Number(data.card_show_leetify_rating ?? 0),
        card_show_leetify_steam_id: Number(data.card_show_leetify_steam_id ?? 0),
        card_show_leetify_avatar: Number(data.card_show_leetify_avatar ?? 0),
        card_show_leetify_name: Number(data.card_show_leetify_name ?? 0),
        card_show_leetify_aim: Number(data.card_show_leetify_aim ?? 0),
        card_show_leetify_positioning: Number(data.card_show_leetify_positioning ?? 0),
        card_show_leetify_utility: Number(data.card_show_leetify_utility ?? 0),
        card_show_leetify_clutch: Number(data.card_show_leetify_clutch ?? 0),
        card_show_leetify_opening: Number(data.card_show_leetify_opening ?? 0),
        card_show_leetify_recent_matches: Number(data.card_show_leetify_recent_matches ?? 0),
        card_show_leetify_premier: Number(data.card_show_leetify_premier ?? 0),
        card_show_leetify_map_ranks: Number(data.card_show_leetify_map_ranks ?? 0),
        card_show_leetify_updated: Number(data.card_show_leetify_updated ?? 0),
        timestamp: Date.now()
      }));
    } catch {}
  }

  async function loadAuthStatus() {
    const container = document.getElementById('authStatus');
    if (!container) return;
    const cachedAny = readProfileCache();
    if (cachedAny?.username) { renderLoggedIn(container, { username: cachedAny.username, id: null }, cachedAny); }
    else renderLoggedOut(container);

    try {
      const authStart = performance.now();
      const authFetch = window.GREVApi?.fetchJsonCached ? window.GREVApi.fetchJsonCached('/api/auth/me',{cacheKey:'grev_api_cache:/api/auth/me',ttlMs:15000}) : safeFetchJson('/api/auth/me').then(({data})=>({data}));
      const { data } = await authFetch;
      const response = { ok: true };
      console.debug('[auth-status] /api/auth/me took', Math.round(performance.now() - authStart), 'ms');
      const user = data?.user;
      if (!response.ok || !user || !user.username) {
        cleanupHeaderProfileArtifacts(container);
        teardownChatWidget();
        renderLoggedOut(container);
        return;
      }

      try {
        await ensureHeaderDependencies();
      } catch (error) {
        console.warn('[auth-status] header dependency load failed', error);
      }
      const cached = readProfileCache(user.username);
      const cachedProfile = cached ? { ...cached, username: user.username, rank: { name: cached.rank?.name || cached.rank || 'Unranked' } } : { username: user.username, display_name: user.username, avatar_url: '', accountLevel: 1, rank: { name: 'Unranked' } };
      renderLoggedIn(container, user, cachedProfile);
      ensureChatWidget(user);

      (async function refreshProfile() {
        try {
          const profileStart = performance.now();
          const profileResp = window.GREVApi?.fetchJsonCached ? await window.GREVApi.fetchJsonCached('/api/profile/me',{cacheKey:'grev_api_cache:/api/profile/me',ttlMs:60000}) : await safeFetchJson('/api/profile/me').then((x)=>({data:x.data,response:x.response}));
          console.debug('[auth-status] /api/profile/me took', Math.round(performance.now() - profileStart), 'ms');
          const profileUser = profileResp.data?.profile || profileResp.data?.user || null;
          const parsed = parseProfileData(user, profileUser);
          renderLoggedIn(container, user, parsed);
          writeProfileCache({
            username: user.username,
            display_name: parsed.display_name,
            avatar_url: parsed.avatar_url,
            accountLevel: parsed.accountLevel,
            rank: parsed.rank?.name || ''
          });
        } catch {}
      })();
    } catch {
      cleanupHeaderProfileArtifacts(container);
      teardownChatWidget();
      renderLoggedOut(container);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadAuthStatus);
  else loadAuthStatus();
})();
