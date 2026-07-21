(() => {
  const state = { dialog: null, cache: new Map(), activeId: null };

  function ensureDialog() {
    if (state.dialog) return state.dialog;
    const dialog = document.createElement('dialog');
    dialog.id = 'global-profile-card-popover';
    dialog.className = 'global-profile-card-popover';
    dialog.setAttribute('aria-labelledby', 'global-profile-card-title');
    dialog.innerHTML = `
      <div class="global-profile-card-shell">
        <div class="global-profile-card-cover" data-popover-cover></div>
        <button class="global-profile-card-close" type="button" aria-label="Close profile card">Close</button>
        <div class="global-profile-card-main">
          <div class="global-profile-card-avatar" data-popover-avatar>G</div>
          <div class="global-profile-card-identity"><h2 id="global-profile-card-title" data-popover-name>Profile</h2><p data-popover-username></p><span data-popover-status></span></div>
        </div>
        <p class="global-profile-card-headline" data-popover-headline></p>
        <div class="global-profile-card-meta"><span data-popover-location></span></div>
        <a class="global-profile-card-open" data-popover-open href="/profile">Open full profile</a>
        <p class="global-profile-card-message" data-popover-message role="status"></p>
      </div>`;
    document.body.append(dialog);
    dialog.querySelector('.global-profile-card-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    state.dialog = dialog;
    return dialog;
  }

  function initials(value) {
    return String(value || 'G').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'G';
  }

  function setOptional(node, value) {
    if (!node) return;
    node.textContent = value || '';
    node.hidden = !value;
  }

  function renderProfile(profile) {
    const dialog = ensureDialog();
    const card = profile.card || {};
    const design = profile.design || {};
    dialog.querySelector('[data-popover-name]').textContent = card.displayName || profile.displayName || 'Profile';
    setOptional(dialog.querySelector('[data-popover-username]'), card.showUsername === false ? null : `@${profile.username}`);
    setOptional(dialog.querySelector('[data-popover-status]'), card.showStatus === false ? null : profile.isVerified ? 'Verified account' : 'Member');
    setOptional(dialog.querySelector('[data-popover-headline]'), card.headline);
    setOptional(dialog.querySelector('[data-popover-location]'), card.location);
    const avatar = dialog.querySelector('[data-popover-avatar]');
    avatar.textContent = card.avatarMedia ? '' : initials(card.displayName || profile.displayName);
    avatar.style.backgroundImage = card.avatarMedia ? `url("${String(card.avatarMedia).replaceAll('"', '\\"')}")` : 'none';
    avatar.hidden = design.showAvatar === false;
    const cover = dialog.querySelector('[data-popover-cover]');
    cover.style.backgroundImage = card.coverMedia ? `url("${String(card.coverMedia).replaceAll('"', '\\"')}")` : `linear-gradient(${card.backgroundAngle ?? 135}deg,${card.backgroundPrimary || '#11161d'},${card.backgroundSecondary || '#3157c9'})`;
    cover.hidden = design.showCover === false;
    dialog.querySelector('[data-popover-open]').href = `/profile/${encodeURIComponent(profile.id)}`;
    dialog.querySelector('[data-popover-message]').textContent = '';
  }

  async function fetchProfile(profileId) {
    const cached = state.cache.get(profileId);
    if (cached && Date.now() - cached.at < 60000) return cached.profile;
    const response = await fetch(`/api/profiles/${encodeURIComponent(profileId)}`, { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.profile) throw new Error(payload.message ?? 'Profile unavailable.');
    state.cache.set(profileId, { profile: payload.profile, at: Date.now() });
    return payload.profile;
  }

  async function openProfileCard(profileId) {
    const dialog = ensureDialog();
    state.activeId = profileId;
    dialog.querySelector('[data-popover-name]').textContent = 'Loading profile…';
    dialog.querySelector('[data-popover-message]').textContent = '';
    if (!dialog.open) dialog.showModal();
    try {
      const profile = await fetchProfile(profileId);
      if (state.activeId === profileId) renderProfile(profile);
    } catch (error) {
      dialog.querySelector('[data-popover-message]').textContent = error.message;
    }
  }

  function profileTarget(event) {
    const target = event.target instanceof Element ? event.target.closest('[data-profile-user-id]') : null;
    if (!target || target.closest('#global-profile-card-popover')) return null;
    return target;
  }

  document.addEventListener('click', event => {
    const target = profileTarget(event);
    if (!target) return;
    const profileId = target.dataset.profileUserId;
    if (!profileId) return;
    if (target instanceof HTMLAnchorElement && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    event.preventDefault();
    event.stopPropagation();
    openProfileCard(profileId);
  });

  document.addEventListener('keydown', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-profile-user-id]') : null;
    if (!target || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openProfileCard(target.dataset.profileUserId);
  });

  const observer = new MutationObserver(() => {
    document.querySelectorAll('[data-profile-user-id]:not(button):not(a)').forEach(element => {
      if (!element.hasAttribute('tabindex')) element.tabIndex = 0;
      if (!element.hasAttribute('role')) element.setAttribute('role', 'button');
      if (!element.hasAttribute('aria-label')) element.setAttribute('aria-label', 'Open mini profile card');
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
