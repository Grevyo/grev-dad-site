(() => {
  if (typeof renderProfileCard !== 'function') return;

  renderProfileCard = function renderCanonicalProfileCard() {
    if (!profileState.working) return;
    const current = profile$('#profile-card');
    if (!current || !window.GrevProfileCardBaseline?.mount) {
      profileMessage('The shared profile card could not be mounted.', 'error');
      return;
    }

    const cardProfile = {
      ...profileState.profile,
      displayName: profileState.working.card.displayName,
      card: profileState.working.card,
      cardTiles: Array.isArray(profileState.profile?.cardTiles) ? profileState.profile.cardTiles : []
    };
    const next = window.GrevProfileCardBaseline.mount(current, cardProfile, {
      tagName: 'section',
      variant: 'full',
      id: 'profile-card',
      ariaLabel: 'Member profile card'
    });
    next.dataset.profilePageCard = 'true';

    const title = profile$('#profile-page-title');
    if (title) title.textContent = profileState.working.card.displayName;
  };
})();