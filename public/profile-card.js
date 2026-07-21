(() => {
  if (window.GrevProfileCard?.contractVersion >= 2) return;

  const statusText = profile => profile.isOwner ? 'Owner' : (profile.isAdmin ? 'Administrator' : (profile.isVerified ? 'Verified member' : 'Member'));

  const DEFAULT_DESIGN = {
    cardWidth: 'full',
    cardAlignment: 'centre',
    cardSurface: 'gradient',
    coverHeight: 180,
    avatarSize: 132,
    cardPadding: 28,
    cardShadow: 'large',
    cardBorderWidth: 1,
    showCover: true,
    showAvatar: true,
    showHeadline: true,
    showBio: true,
    showLocation: true,
    showWebsite: true
  };

  function initials(name) {
    return String(name || 'G')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('') || 'G';
  }

  function imageCss(value) {
    return value ? `url("${String(value).replaceAll('"', '\\"')}")` : 'none';
  }

  function applyMedia(element, value, kind = 'cover') {
    if (!element) return;
    element.style.backgroundImage = value ? imageCss(value) : '';
    element.style.backgroundSize = kind === 'avatar' ? 'contain' : 'cover';
    element.style.backgroundPosition = 'center';
    element.style.backgroundRepeat = 'no-repeat';
    element.classList.toggle('has-media', Boolean(value));
  }

  function apply(root, profile) {
    if (!root || !profile?.card) return;
    const card = profile.card;
    root.dataset.profileCardContract = '2';
    root.style.setProperty('--profile-card-primary', card.backgroundPrimary || '#11161d');
    root.style.setProperty('--profile-card-secondary', card.backgroundSecondary || '#3157c9');
    root.style.setProperty('--profile-card-angle', `${card.backgroundAngle ?? 135}deg`);
    root.style.setProperty('--profile-card-text', card.textColour || '#f4f7fb');
    root.style.setProperty('--profile-card-border', card.borderColour || '#526074');

    const cover = root.querySelector('[data-profile-cover]');
    applyMedia(cover, card.coverMedia, 'cover');

    const avatar = root.querySelector('[data-profile-avatar]');
    if (avatar) {
      applyMedia(avatar, card.avatarMedia, 'avatar');
      avatar.textContent = card.avatarMedia ? '' : initials(card.displayName);
      avatar.setAttribute('aria-label', `${card.displayName} profile picture`);
    }

    const name = root.querySelector('[data-profile-name]');
    if (name) name.textContent = card.displayName;

    const username = root.querySelector('[data-profile-username]');
    if (username) {
      username.textContent = profile.username ? `@${profile.username}` : '';
      username.hidden = !card.showUsername || !profile.username;
    }

    const headline = root.querySelector('[data-profile-headline]');
    if (headline) {
      headline.textContent = card.headline ?? '';
      headline.hidden = !card.headline;
    }

    const bio = root.querySelector('[data-profile-bio]');
    if (bio) {
      bio.textContent = card.bio ?? '';
      bio.hidden = !card.bio;
    }

    const status = root.querySelector('[data-profile-status]');
    if (status) {
      status.textContent = statusText(profile);
      status.hidden = !card.showStatus;
    }

    const memberSince = root.querySelector('[data-profile-member-since]');
    if (memberSince) {
      memberSince.textContent = profile.createdAt ? `Member since ${new Date(profile.createdAt * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}` : '';
      memberSince.hidden = !card.showMemberSince || !profile.createdAt;
    }

    const location = root.querySelector('[data-profile-location]');
    if (location) {
      location.textContent = card.location ?? '';
      location.hidden = !card.location;
    }

    const website = root.querySelector('[data-profile-website]');
    if (website) {
      website.hidden = !card.websiteUrl;
      if (card.websiteUrl) {
        website.href = card.websiteUrl;
        try {
          website.textContent = new URL(card.websiteUrl).hostname.replace(/^www\./, '');
        } catch {
          website.textContent = card.websiteUrl;
        }
      }
    }
  }

  function applyDesign(root, profile, value = {}, options = {}) {
    if (!root || !profile?.card) return;
    const design = { ...DEFAULT_DESIGN, ...(value && typeof value === 'object' ? value : {}) };
    const variant = options.variant || (options.compact === true ? 'directory' : 'full');
    const coverHeight = Number(design.coverHeight || 0);
    const coverVisible = design.showCover !== false && coverHeight > 0;
    const avatarVisible = design.showAvatar !== false;

    root.dataset.profileCardContract = '2';
    root.dataset.cardVariant = variant;
    root.dataset.cardWidth = design.cardWidth;
    root.dataset.cardAlignment = design.cardAlignment;
    root.dataset.cardSurface = design.cardSurface;
    root.dataset.cardShadow = variant === 'popover' ? 'none' : design.cardShadow;
    root.dataset.cardCoverVisible = String(coverVisible);
    root.dataset.cardAvatarVisible = String(avatarVisible);
    root.dataset.cardCoverHeight = coverHeight > 0 ? String(coverHeight) : '0';

    if (variant === 'full') {
      root.style.setProperty('--profile-card-cover-height', `${Math.max(0, coverHeight)}px`);
      root.style.setProperty('--profile-card-avatar-size', `${Math.max(72, Number(design.avatarSize || 132))}px`);
      root.style.setProperty('--profile-card-padding', `${Math.max(12, Number(design.cardPadding || 28))}px`);
      root.style.setProperty('--profile-card-border-width', `${Math.max(0, Number(design.cardBorderWidth ?? 1))}px`);
      root.style.marginLeft = design.cardAlignment === 'left' ? '0' : 'auto';
      root.style.marginRight = 'auto';
    }

    const card = profile.card;
    if (design.cardSurface === 'cover' && card.coverMedia) {
      root.style.background = `${imageCss(card.coverMedia)} center/cover no-repeat`;
      root.classList.add('profile-card-cover-surface');
    } else if (design.cardSurface === 'solid') {
      root.style.background = card.backgroundPrimary || '#11161d';
      root.classList.remove('profile-card-cover-surface');
    } else {
      root.style.background = `linear-gradient(${card.backgroundAngle ?? 135}deg,${card.backgroundPrimary || '#11161d'},${card.backgroundSecondary || '#3157c9'})`;
      root.classList.remove('profile-card-cover-surface');
    }

    const visible = (selector, allowed, content) => {
      const element = root.querySelector(selector);
      if (element) element.hidden = !allowed || !content;
    };
    const cover = root.querySelector('[data-profile-cover]');
    if (cover) cover.hidden = !coverVisible;
    const avatar = root.querySelector('[data-profile-avatar]');
    if (avatar) avatar.hidden = !avatarVisible;
    visible('[data-profile-headline]', design.showHeadline, card.headline);
    visible('[data-profile-bio]', design.showBio, card.bio);
    visible('[data-profile-location]', design.showLocation, card.location);
    visible('[data-profile-website]', design.showWebsite, card.websiteUrl);
  }

  function create(profile, options = {}) {
    const root = document.createElement(options.tagName || 'article');
    root.className = `profile-card${options.className ? ` ${options.className}` : ''}`;
    root.setAttribute('aria-label', `${profile?.card?.displayName || 'Member'} profile card`);
    root.innerHTML = `
      <div class="profile-card-cover" data-profile-cover></div>
      <div class="profile-card-main">
        <div class="profile-card-avatar" data-profile-avatar aria-label="Profile picture">G</div>
        <div class="profile-card-identity">
          <div class="profile-card-name-row">
            <div><h2 data-profile-name>Member</h2><p data-profile-username hidden></p></div>
            <span class="profile-card-status" data-profile-status hidden></span>
          </div>
          <p class="profile-card-headline" data-profile-headline hidden></p>
          <p class="profile-card-bio" data-profile-bio hidden></p>
          <div class="profile-card-meta">
            <span data-profile-location hidden></span>
            <a data-profile-website hidden target="_blank" rel="noopener noreferrer"></a>
            <span data-profile-member-since hidden></span>
          </div>
        </div>
      </div>`;
    apply(root, profile);
    applyDesign(root, profile, profile?.design, options);
    return root;
  }

  window.GrevProfileCard = { contractVersion: 2, apply, applyDesign, create, initials, statusText };

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof validProfilePlacement !== 'function' || typeof selectedTile !== 'function') return;

    validProfilePlacement = function(candidate, ignoreId = null) {
      if (
        !Number.isInteger(candidate.x) || !Number.isInteger(candidate.y) ||
        !Number.isInteger(candidate.width) || !Number.isInteger(candidate.height) ||
        candidate.x < 0 || candidate.y < 0 || candidate.y > 199 ||
        candidate.width < 1 || candidate.width > 6 ||
        candidate.height < 1 || candidate.height > 4 ||
        candidate.x + candidate.width > 8 || candidate.y + candidate.height > 200
      ) return false;
      return !(profileState.working?.tiles ?? []).some(tile => tile.tileId !== ignoreId && tileOverlaps(candidate, tile));
    };

    const originalPopulateTileDialog = populateTileDialog;
    populateTileDialog = function() {
      originalPopulateTileDialog();
      const tile = selectedTile();
      const backgroundType = document.querySelector('#profile-tile-background-type');
      if (!tile || !backgroundType) return;
      const mediaTile = tile.tileType === 'media';
      if (mediaTile) {
        tile.backgroundType = 'media';
        backgroundType.value = 'media';
      }
      backgroundType.disabled = mediaTile;
    };

    const originalValidateProfileBeforeSave = validateProfileBeforeSave;
    validateProfileBeforeSave = function() {
      const originalMessage = originalValidateProfileBeforeSave();
      if (originalMessage) return originalMessage;
      for (const tile of profileState.working?.tiles ?? []) {
        if (!validProfilePlacement(tile, tile.tileId)) return 'Every profile tile must stay inside the eight-column grid.';
        if (tile.tileType === 'media' && tile.backgroundType !== 'media') return 'Picture / GIF tiles must keep a media background.';
      }
      return null;
    };

    const originalProfileMessage = profileMessage;
    profileMessage = function(text, type = '') {
      const profile = profileState.profile;
      const safeText = profile && !profile.isSelf && !profile.card?.showUsername && /^Viewing @/.test(text)
        ? 'Viewing member profile.'
        : text;
      return originalProfileMessage(safeText, type);
    };

    const statusMessage = document.querySelector('#profile-message');
    if (statusMessage) {
      const protectHiddenUsername = () => {
        const profile = profileState.profile;
        if (profile && !profile.isSelf && !profile.card?.showUsername && /^Viewing @/.test(statusMessage.textContent ?? '')) {
          statusMessage.textContent = 'Viewing member profile.';
        }
      };
      new MutationObserver(protectHiddenUsername).observe(statusMessage, { childList: true, characterData: true, subtree: true });
      protectHiddenUsername();
    }

    const backgroundType = document.querySelector('#profile-tile-background-type');
    backgroundType?.addEventListener('change', event => {
      const tile = selectedTile();
      if (tile?.tileType !== 'media') return;
      event.currentTarget.value = 'media';
      tile.backgroundType = 'media';
      renderProfileGrid();
    }, true);

    const style = document.createElement('style');
    style.textContent = '@media(max-width:900px){.profile-grid .profile-tile{grid-column:auto/span var(--profile-mobile-width,1)!important;grid-row:auto/span var(--profile-mobile-height,1)!important}}';
    document.head.append(style);
  });
})();