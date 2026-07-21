(() => {
  let lastSavedDesign = null;
  let root = null;
  const nativeFetch = window.fetch.bind(window);

  function normalizedDesign(value) {
    return {
      showPageHeading: value?.showPageHeading !== false,
      showCover: value?.showCover !== false,
      coverHeight: Number(value?.coverHeight ?? 180),
      avatarSize: Number(value?.avatarSize ?? 132)
    };
  }

  function applyHardening(designValue) {
    const design = normalizedDesign(designValue);
    const heading = document.querySelector('.profile-page-heading');
    if (heading) {
      heading.hidden = false;
      heading.classList.toggle('profile-heading-copy-hidden', !design.showPageHeading);
    }
    if (root) root.dataset.coverVisible = String(Boolean(design.showCover && design.coverHeight > 0));
  }

  function designFromControls() {
    const heading = document.querySelector('#design-show-page-heading');
    const cover = document.querySelector('#design-show-cover');
    const height = document.querySelector('#design-cover-height');
    return {
      ...(lastSavedDesign || {}),
      showPageHeading: heading ? heading.checked : lastSavedDesign?.showPageHeading,
      showCover: cover ? cover.checked : lastSavedDesign?.showCover,
      coverHeight: height ? Number(height.value) : lastSavedDesign?.coverHeight
    };
  }

  function addDefaultAvatarOption() {
    const select = document.querySelector('#design-avatar-size');
    if (!select || select.querySelector('option[value="132"]')) return;
    const option = document.createElement('option');
    option.value = '132';
    option.textContent = 'Default large';
    const next = select.querySelector('option[value="144"]');
    select.insertBefore(option, next || null);
  }

  function injectStyles() {
    if (document.querySelector('#profile-customization-hardening-styles')) return;
    const style = document.createElement('style');
    style.id = 'profile-customization-hardening-styles';
    style.textContent = `
      .profile-page-heading.profile-heading-copy-hidden{justify-content:flex-end}
      .profile-page-heading.profile-heading-copy-hidden>div:first-child{display:none}
      .profile-card[data-cover-visible="false"] .profile-card-avatar{margin-top:0}
      .profile-card[data-cover-visible="false"] .profile-card-main{padding-top:var(--profile-card-padding,28px)}
      @media(max-width:560px){.profile-card[data-cover-visible="false"] .profile-card-avatar{margin-top:0}}
    `;
    document.head.append(style);
  }

  const originalApply = window.GrevProfileCard?.apply?.bind(window.GrevProfileCard);
  if (originalApply) {
    window.GrevProfileCard.apply = (profileRoot, profile) => {
      originalApply(profileRoot, profile);
      root = profileRoot;
      lastSavedDesign = structuredClone(profile?.design || {});
      applyHardening(lastSavedDesign);
    };
  }

  window.fetch = async (input, init = {}) => {
    const response = await nativeFetch(input, init);
    const url = typeof input === 'string' ? input : input.url;
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET')).toUpperCase();
    if (method === 'PUT' && new URL(url, location.origin).pathname === '/api/profile' && response.ok) {
      try {
        const payload = await response.clone().json();
        if (payload.profile?.design) {
          lastSavedDesign = structuredClone(payload.profile.design);
          applyHardening(lastSavedDesign);
        }
      } catch {}
    }
    return response;
  };

  function initialise() {
    injectStyles();
    addDefaultAvatarOption();
    document.querySelector('#profile-design-dialog')?.addEventListener('input', () => queueMicrotask(() => applyHardening(designFromControls())));
    document.querySelector('#profile-design-dialog')?.addEventListener('change', () => queueMicrotask(() => applyHardening(designFromControls())));
    document.querySelector('#profile-cancel')?.addEventListener('click', () => queueMicrotask(() => applyHardening(lastSavedDesign)));
    document.querySelector('#profile-edit')?.addEventListener('click', () => queueMicrotask(() => applyHardening(lastSavedDesign)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
