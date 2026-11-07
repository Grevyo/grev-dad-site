// Live widget tiles on the grev.dad profile page: recent games, game activity, most played,
// favourite games, best friends, bio, stats, achievements and RetroAchievements. The same tiles
// show in Grev Home; the data comes from /api/profile/widgets/{id} (src/profile-unified.ts) and is
// already filtered for whoever is viewing.
//
// Also adds the editor panel for the things widgets show (favourites, best friends, a linked
// RetroAchievements account) and a best-friend toggle on a friend's profile.
(() => {
  'use strict';
  if (typeof profileState === 'undefined' || typeof profileTileElement !== 'function') return;

  const WIDGETS = {
    'recent-games': { label: 'Recent games', hint: 'What you played last, newest first.', size: [4, 2], list: true },
    'game-activity': { label: 'Game activity', hint: 'Now playing plus your latest sessions.', size: [4, 2], list: true },
    'most-played': { label: 'Most played', hint: 'Your games ranked by play time.', size: [3, 2], list: true },
    'favourite-games': { label: 'Favourite games', hint: 'Games you starred here or in Grev Home.', size: [4, 2], list: true },
    'best-friends': { label: 'Best friends', hint: 'Up to twelve friends you pick.', size: [4, 2], list: true },
    bio: { label: 'Bio', hint: 'Your headline and bio from the profile card.', size: [3, 2], list: false },
    stats: { label: 'Stats', hint: 'Level, XP, play time and sessions.', size: [3, 2], list: false },
    achievements: { label: 'Achievements', hint: 'Your latest grev.dad achievements.', size: [3, 2], list: true },
    retroachievements: { label: 'RetroAchievements', hint: 'Points, rank and recent unlocks from RetroAchievements.', size: [4, 3], list: true }
  };
  const DEFAULT_COUNT = { 'recent-games': 6, 'game-activity': 5, 'most-played': 5, 'favourite-games': 6, 'best-friends': 6, achievements: 6, retroachievements: 5 };

  const state = { profileId: null, data: {}, relationship: null, isBestFriend: false, loading: null, manage: null };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  function duration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function ago(epochSeconds) {
    if (!epochSeconds) return '';
    const seconds = Math.max(0, Date.now() / 1000 - Number(epochSeconds));
    if (seconds < 90) return 'just now';
    if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
    return `${Math.round(seconds / 86400)} d ago`;
  }

  function list(rows) {
    const ul = el('ul', 'profile-widget-list');
    for (const row of rows) ul.append(row);
    return ul;
  }

  function row(title, detail, image) {
    const li = el('li', 'profile-widget-row');
    if (image) {
      const img = el('img', 'profile-widget-thumb');
      img.src = image;
      img.alt = '';
      img.loading = 'lazy';
      li.append(img);
    }
    const text = el('div', 'profile-widget-row-text');
    text.append(el('strong', '', title));
    if (detail) text.append(el('span', '', detail));
    li.append(text);
    return li;
  }

  function empty(text) { return el('p', 'profile-widget-empty', text); }

  function renderWidgetBody(tile, data) {
    const body = el('div', 'profile-widget-body');
    if (!data) {
      body.append(empty(profileState.editing ? 'Save your profile to load this widget.' : 'Loading…'));
      return body;
    }
    if (data.hidden) {
      body.append(empty('Shared with friends only.'));
      return body;
    }
    switch (tile.widget) {
      case 'recent-games':
      case 'most-played':
        if (!data.items?.length) body.append(empty('No games played in Grev Home yet.'));
        else body.append(list(data.items.map(item => row(item.title,
          tile.widget === 'most-played'
            ? `${duration(item.totalSeconds)} · ${item.sessions} session${item.sessions === 1 ? '' : 's'}`
            : `${item.title !== item.appName ? `${item.appName} · ` : ''}${ago(item.lastPlayedAt)}`))));
        break;
      case 'game-activity': {
        if (data.nowPlaying) {
          const now = el('p', 'profile-widget-now');
          now.append(el('span', 'profile-widget-live', 'Now playing'), document.createTextNode(` ${data.nowPlaying.title}`));
          body.append(now);
        }
        if (!data.sessions?.length && !data.nowPlaying) body.append(empty('No recent activity.'));
        else body.append(list((data.sessions ?? []).map(item => row(item.title, `${duration(item.durationSeconds)} · ${ago(item.endedAt)}`))));
        break;
      }
      case 'favourite-games':
        if (!data.items?.length) body.append(empty(profileState.profile?.isSelf ? 'Star games in Grev Home or add them while editing.' : 'No favourites yet.'));
        else body.append(list(data.items.map(item => row(item.title, item.platform))));
        break;
      case 'best-friends': {
        if (!data.items?.length) { body.append(empty('No best friends picked yet.')); break; }
        const strip = el('div', 'profile-widget-friends');
        for (const friend of data.items) {
          const link = el('a', `profile-widget-friend availability-${friend.availability ?? 'offline'}`);
          link.href = `/profile/${encodeURIComponent(friend.userId)}`;
          const avatar = el('span', 'profile-widget-avatar');
          if (friend.avatarMedia) avatar.style.backgroundImage = `url("${friend.avatarMedia.replaceAll('"', '\\"')}")`;
          else avatar.textContent = (friend.displayName || '?').slice(0, 1).toUpperCase();
          link.append(avatar, el('strong', '', friend.displayName));
          if (friend.activityText) link.append(el('span', '', friend.activityText));
          strip.append(link);
        }
        body.append(strip);
        break;
      }
      case 'bio':
        if (data.headline) body.append(el('strong', 'profile-widget-headline', data.headline));
        body.append(data.bio ? el('p', '', data.bio) : empty('No bio yet.'));
        break;
      case 'stats': {
        const grid = el('div', 'profile-widget-stats');
        const add = (label, value) => {
          if (value === null || value === undefined) return;
          const stat = el('div', 'profile-widget-stat');
          stat.append(el('strong', '', value), el('span', '', label));
          grid.append(stat);
        };
        add('Level', data.level);
        add('XP', data.totalXp?.toLocaleString());
        add('Played', data.totalTrackedSeconds === null ? null : duration(data.totalTrackedSeconds));
        add('Sessions', data.completedSessions?.toLocaleString());
        add('Games', data.uniqueApps);
        add('Achievements', data.achievements);
        body.append(grid);
        break;
      }
      case 'achievements':
        body.append(el('span', 'profile-widget-meta', `${data.earned} of ${data.available} earned`));
        if (!data.items?.length) body.append(empty('No achievements yet.'));
        else body.append(list(data.items.map(item => row(item.name, item.description, item.imageUrl))));
        break;
      case 'retroachievements': {
        if (!data.linked) { body.append(empty(profileState.profile?.isSelf ? 'Link your RetroAchievements account while editing.' : 'No RetroAchievements account linked.')); break; }
        const summary = data.summary;
        if (!summary) { body.append(empty(data.error || `Linked as ${data.username}. Waiting for RetroAchievements.`)); break; }
        const head = el('a', 'profile-widget-ra-head');
        head.href = summary.profileUrl;
        head.target = '_blank';
        head.rel = 'noopener noreferrer';
        if (summary.avatarUrl) { const img = el('img', 'profile-widget-thumb'); img.src = summary.avatarUrl; img.alt = ''; head.append(img); }
        const meta = el('div', 'profile-widget-row-text');
        meta.append(el('strong', '', summary.username), el('span', '', `${summary.totalPoints.toLocaleString()} points${summary.rank ? ` · rank ${summary.rank.toLocaleString()}` : ''}`));
        head.append(meta);
        body.append(head);
        if (summary.richPresence) body.append(el('p', 'profile-widget-now', summary.richPresence));
        if (summary.recentAchievements.length) {
          body.append(list(summary.recentAchievements.map(item => row(item.title, `${item.gameTitle} · ${item.points} pts${item.hardcore ? ' · hardcore' : ''}`, item.badgeUrl))));
        } else if (summary.recentlyPlayed.length) {
          body.append(list(summary.recentlyPlayed.map(item => row(item.title, `${item.console} · ${item.achieved}/${item.total}`, item.iconUrl))));
        }
        break;
      }
      default:
        body.append(empty('This widget needs a newer version of grev.dad.'));
    }
    return body;
  }

  // --- tile rendering ------------------------------------------------------------------------
  const baseTileElement = profileTileElement;
  profileTileElement = function profileWidgetTileElement(tile) {
    const element = baseTileElement(tile);
    if (!tile.widget) return element;
    element.classList.add('profile-widget-tile');
    element.dataset.widget = tile.widget;
    const content = element.querySelector('.profile-tile-content');
    if (!content) return element;
    const info = WIDGETS[tile.widget];
    const kind = el('span', 'profile-tile-kind', info?.label ?? 'Widget');
    const title = el('h2', '', tile.title || info?.label || 'Widget');
    content.replaceChildren(kind, title, renderWidgetBody(tile, state.data[tile.tileId]));
    return element;
  };

  async function loadWidgets(force = false) {
    const id = profileState.profile?.id;
    if (!id || (!force && state.profileId === id)) return;
    state.profileId = id;
    const request = fetch(`/api/profile/widgets/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null);
    state.loading = request;
    const payload = await request;
    if (state.loading !== request || !payload?.ok) return;
    state.data = payload.widgets ?? {};
    state.relationship = payload.relationship;
    state.isBestFriend = Boolean(payload.isBestFriend);
    renderBestFriendToggle();
    if (typeof renderProfileGrid === 'function') renderProfileGrid();
  }

  const baseRenderProfile = renderProfile;
  renderProfile = function profileWidgetsRenderProfile(...args) {
    const result = baseRenderProfile.apply(this, args);
    syncManagePanel();
    queueMicrotask(() => loadWidgets());
    return result;
  };

  // A save can change which widget tiles exist; reload their data afterwards.
  const baseLeave = leaveProfileEditor;
  leaveProfileEditor = function profileWidgetsLeaveEditor(saved = false, ...rest) {
    const result = baseLeave.call(this, saved, ...rest);
    if (saved) loadWidgets(true);
    return result;
  };

  // --- adding widget tiles -------------------------------------------------------------------
  function addWidgetTile(widget) {
    if (!profileState.working) return;
    if (profileState.working.tiles.length >= PROFILE_MAX_TILES) {
      profileEditorMessage(`A profile can have up to ${PROFILE_MAX_TILES} tiles.`, 'error');
      return;
    }
    const info = WIDGETS[widget];
    const tile = profileTileDefaults('text');
    const placement = firstFreeProfilePlacement(info.size[0], info.size[1]);
    Object.assign(tile, placement, { title: info.label, body: null, widget, widgetConfig: {} });
    profileState.working.tiles.push(tile);
    profileState.selectedId = tile.tileId;
    renderProfileGrid();
    openProfileTileSettings(tile.tileId);
    profileEditorMessage(`${info.label} widget added. Save your profile to fill it with live data.`);
  }

  function installCatalogue() {
    const catalogue = document.querySelector('#profile-catalogue');
    if (!catalogue || catalogue.querySelector('.profile-widget-catalogue')) return;
    const section = el('div', 'profile-widget-catalogue');
    const heading = el('div');
    heading.append(el('p', 'eyebrow', 'Live widgets'), el('p', '', 'Tiles that fill themselves from Grev Home and grev.dad. They show in Grev Home too.'));
    section.append(heading);
    for (const [widget, info] of Object.entries(WIDGETS)) {
      const button = el('button');
      button.type = 'button';
      button.dataset.addProfileWidget = widget;
      button.append(el('strong', '', info.label), el('span', '', info.hint));
      button.addEventListener('click', () => addWidgetTile(widget));
      section.append(button);
    }
    catalogue.append(section);
    catalogue.append(buildManagePanel());
  }

  // Count control in the tile dialog for list widgets; widget tiles have no free text.
  function installTileDialogControls() {
    const titleControl = document.querySelector('#profile-tile-title')?.closest('label');
    if (!titleControl || document.querySelector('#profile-widget-count-control')) return;
    const label = el('label');
    label.id = 'profile-widget-count-control';
    label.hidden = true;
    label.append(document.createTextNode('Items shown'));
    const select = el('select');
    select.id = 'profile-widget-count';
    for (let count = 1; count <= 12; count += 1) {
      const option = el('option', '', count);
      option.value = String(count);
      select.append(option);
    }
    select.addEventListener('change', () => {
      const tile = selectedTile();
      if (!tile?.widget) return;
      tile.widgetConfig = { ...(tile.widgetConfig ?? {}), count: Number(select.value) };
      renderProfileGrid();
    });
    label.append(select);
    titleControl.after(label);

    const basePopulate = populateTileDialog;
    populateTileDialog = function profileWidgetsPopulateTileDialog(...args) {
      const result = basePopulate.apply(this, args);
      const tile = selectedTile();
      const info = tile?.widget ? WIDGETS[tile.widget] : null;
      label.hidden = !info?.list;
      if (info?.list) select.value = String(tile.widgetConfig?.count ?? DEFAULT_COUNT[tile.widget] ?? 6);
      const bodyControl = document.querySelector('#profile-tile-body-control');
      if (bodyControl && tile?.widget) bodyControl.hidden = true;
      const typeLabel = document.querySelector('#profile-tile-type-label');
      if (typeLabel && info) typeLabel.textContent = `${info.label} widget`;
      return result;
    };
  }

  // --- favourites, best friends, RetroAchievements ------------------------------------------
  async function api(method, path, body) {
    const response = await fetch(`/api/profile/${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'That did not work. Try again.');
    return payload;
  }

  function buildManagePanel() {
    const panel = el('section', 'profile-widget-manage');
    panel.hidden = true;
    panel.append(el('p', 'eyebrow', 'Widget content'));
    const status = el('p', 'profile-widget-manage-status');
    status.setAttribute('role', 'status');

    const ra = el('div', 'profile-widget-manage-group');
    ra.append(el('h3', '', 'RetroAchievements'));
    const raState = el('p', 'profile-widget-manage-note');
    const raForm = el('form', 'profile-widget-inline-form');
    const raInput = el('input');
    raInput.type = 'text'; raInput.maxLength = 32; raInput.placeholder = 'RetroAchievements username'; raInput.autocomplete = 'off';
    const raLink = el('button', '', 'Link'); raLink.type = 'submit';
    const raUnlink = el('button', '', 'Unlink'); raUnlink.type = 'button';
    raForm.append(raInput, raLink, raUnlink);
    ra.append(raState, raForm);

    const favourites = el('div', 'profile-widget-manage-group');
    favourites.append(el('h3', '', 'Favourite games'));
    const favouriteList = el('ul', 'profile-widget-manage-list');
    const favouriteForm = el('form', 'profile-widget-inline-form');
    const favouriteTitle = el('input'); favouriteTitle.type = 'text'; favouriteTitle.maxLength = 160; favouriteTitle.placeholder = 'Game title'; favouriteTitle.required = true;
    const favouritePlatform = el('input'); favouritePlatform.type = 'text'; favouritePlatform.maxLength = 60; favouritePlatform.placeholder = 'Platform';
    const favouriteAdd = el('button', '', 'Add'); favouriteAdd.type = 'submit';
    favouriteForm.append(favouriteTitle, favouritePlatform, favouriteAdd);
    favourites.append(favouriteList, favouriteForm);

    const best = el('div', 'profile-widget-manage-group');
    best.append(el('h3', '', 'Best friends'));
    const bestList = el('ul', 'profile-widget-manage-list');
    const bestForm = el('form', 'profile-widget-inline-form');
    const bestSelect = el('select');
    const bestAdd = el('button', '', 'Add'); bestAdd.type = 'submit';
    bestForm.append(bestSelect, bestAdd);
    best.append(bestList, bestForm, el('p', 'profile-widget-manage-note', 'Best friends come from your Grev Home friends list.'));

    panel.append(ra, favourites, best, status);
    const say = (text, type = '') => { status.textContent = text; status.className = `profile-widget-manage-status${type ? ` ${type}` : ''}`; };
    const run = async (task, done) => {
      try { await task(); say(done, 'success'); loadWidgets(true); } catch (error) { say(error.message, 'error'); }
    };
    const removeButton = (label, onClick) => { const button = el('button', '', 'Remove'); button.type = 'button'; button.setAttribute('aria-label', `Remove ${label}`); button.addEventListener('click', onClick); return button; };

    const showRa = value => {
      if (!value?.linked) raState.textContent = value?.configured === false ? 'Not linked. (RetroAchievements is not switched on for this site yet.)' : 'Not linked.';
      else raState.textContent = value.summary
        ? `Linked as ${value.username} · ${value.summary.totalPoints.toLocaleString()} points`
        : `Linked as ${value.username}${value.error ? ` · ${value.error}` : ''}`;
      raUnlink.hidden = !value?.linked;
      if (value?.linked) raInput.value = value.username;
    };
    const showFavourites = items => favouriteList.replaceChildren(...items.map(item => {
      const li = el('li', '', item.platform ? `${item.title} · ${item.platform}` : item.title);
      li.append(removeButton(item.title, () => run(async () => showFavourites((await api('DELETE', `favourites/${encodeURIComponent(item.itemKey)}`)).items), 'Favourite removed.')));
      return li;
    }));
    const showBest = payload => {
      bestList.replaceChildren(...payload.items.map(friend => {
        const li = el('li', '', friend.displayName);
        li.append(removeButton(friend.displayName, () => run(async () => showBest(await api('DELETE', `best-friends/${friend.userId}`)), 'Best friend removed.')));
        return li;
      }));
      const picked = new Set(payload.items.map(friend => friend.userId));
      const candidates = (payload.friends ?? []).filter(friend => !picked.has(friend.userId));
      bestSelect.replaceChildren(...candidates.map(friend => { const option = el('option', '', friend.displayName); option.value = friend.userId; return option; }));
      bestForm.hidden = !candidates.length;
    };

    raForm.addEventListener('submit', event => {
      event.preventDefault();
      run(async () => showRa((await api('PUT', 'retroachievements', { username: raInput.value.trim() })).retroAchievements), 'RetroAchievements linked.');
    });
    raUnlink.addEventListener('click', () => run(async () => { showRa((await api('DELETE', 'retroachievements')).retroAchievements); raInput.value = ''; }, 'RetroAchievements unlinked.'));
    favouriteForm.addEventListener('submit', event => {
      event.preventDefault();
      const title = favouriteTitle.value.trim();
      if (!title) return;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'game';
      run(async () => {
        showFavourites((await api('POST', 'favourites', { item: { itemKey: `web:${slug}`, title, platform: favouritePlatform.value.trim() } })).items);
        favouriteTitle.value = ''; favouritePlatform.value = '';
      }, 'Favourite added.');
    });
    bestForm.addEventListener('submit', event => {
      event.preventDefault();
      if (bestSelect.value) run(async () => showBest(await api('POST', 'best-friends', { userId: bestSelect.value })), 'Best friend added.');
    });

    state.manage = {
      panel,
      async load() {
        try {
          const [raPayload, favouritePayload, bestPayload] = await Promise.all([api('GET', 'retroachievements'), api('GET', 'favourites'), api('GET', 'best-friends')]);
          showRa(raPayload.retroAchievements);
          showFavourites(favouritePayload.items);
          showBest(bestPayload);
          say('');
        } catch (error) { say(error.message, 'error'); }
      }
    };
    return panel;
  }

  function syncManagePanel() {
    if (!state.manage) return;
    const show = Boolean(profileState.profile?.isSelf && profileState.editing);
    if (show && state.manage.panel.hidden) state.manage.load();
    state.manage.panel.hidden = !show;
  }

  // On a friend's profile: mark them as a best friend.
  function renderBestFriendToggle() {
    const actions = document.querySelector('.profile-page-actions');
    if (!actions) return;
    let button = document.querySelector('#profile-best-friend');
    if (state.relationship !== 'friend') { button?.remove(); return; }
    if (!button) {
      button = el('button');
      button.id = 'profile-best-friend';
      button.type = 'button';
      button.addEventListener('click', async () => {
        const id = profileState.profile?.id;
        if (!id) return;
        button.disabled = true;
        try {
          if (state.isBestFriend) await api('DELETE', `best-friends/${id}`);
          else await api('POST', 'best-friends', { userId: id });
          state.isBestFriend = !state.isBestFriend;
          profileMessage(state.isBestFriend ? 'Added to your best friends.' : 'Removed from your best friends.', 'success');
        } catch (error) {
          profileMessage(error.message, 'error');
        } finally {
          button.disabled = false;
          renderBestFriendToggle();
        }
      });
      actions.append(button);
    }
    button.textContent = state.isBestFriend ? '★ Best friend' : '☆ Add to best friends';
    button.setAttribute('aria-pressed', String(state.isBestFriend));
  }

  installCatalogue();
  installTileDialogControls();
  if (profileState.profile) { syncManagePanel(); loadWidgets(); }
})();
