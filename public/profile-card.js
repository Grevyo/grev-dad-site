(() => {
  const statusText = profile => profile.isOwner ? 'Owner' : (profile.isAdmin ? 'Administrator' : (profile.isVerified ? 'Verified member' : 'Member'));

  function initials(name) {
    return String(name || 'G')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('') || 'G';
  }

  function applyMedia(element, value) {
    if (!element) return;
    element.style.backgroundImage = value ? `url("${value.replaceAll('"', '\\"')}")` : '';
    element.classList.toggle('has-media', Boolean(value));
  }

  function apply(root, profile) {
    if (!root || !profile?.card) return;
    const card = profile.card;
    root.style.setProperty('--profile-card-primary', card.backgroundPrimary);
    root.style.setProperty('--profile-card-secondary', card.backgroundSecondary);
    root.style.setProperty('--profile-card-angle', `${card.backgroundAngle}deg`);
    root.style.setProperty('--profile-card-text', card.textColour);
    root.style.setProperty('--profile-card-border', card.borderColour);

    const cover = root.querySelector('[data-profile-cover]');
    applyMedia(cover, card.coverMedia);

    const avatar = root.querySelector('[data-profile-avatar]');
    if (avatar) {
      applyMedia(avatar, card.avatarMedia);
      avatar.textContent = card.avatarMedia ? '' : initials(card.displayName);
      avatar.setAttribute('aria-label', `${card.displayName} profile picture`);
    }

    const name = root.querySelector('[data-profile-name]');
    if (name) name.textContent = card.displayName;

    const username = root.querySelector('[data-profile-username]');
    if (username) {
      username.textContent = `@${profile.username}`;
      username.hidden = !card.showUsername;
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
      memberSince.textContent = `Member since ${new Date(profile.createdAt * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}`;
      memberSince.hidden = !card.showMemberSince;
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

  window.GrevProfileCard = { apply, initials, statusText };

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
