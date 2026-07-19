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
})();
