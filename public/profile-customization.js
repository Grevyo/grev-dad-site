(() => {
  const MAX_FILE_BYTES = 1_400_000;
  const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  const FONT_STACKS = {
    system: 'Inter,Segoe UI,Arial,sans-serif',
    display: 'Impact,Haettenschweiler,Arial Narrow Bold,sans-serif',
    mono: 'ui-monospace,SFMono-Regular,Consolas,Liberation Mono,monospace',
    serif: 'Georgia,Times New Roman,serif',
    rounded: 'Trebuchet MS,Arial Rounded MT Bold,Arial,sans-serif'
  };
  const DEFAULT_DESIGN = {
    pageBackgroundType: 'solid',
    pageBackgroundPrimary: '#090c11',
    pageBackgroundSecondary: '#182131',
    pageBackgroundAngle: 135,
    pageBackgroundMedia: null,
    pageMediaFit: 'cover',
    pageMediaOverlay: 'dark',
    pageTextColour: '#f4f7fb',
    pageFontFamily: 'system',
    contentWidth: 'wide',
    sectionGap: 32,
    showPageHeading: true,
    showGridHeading: true,
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
    showWebsite: true,
    cardTileGap: 10,
    cardTileRowHeight: 92,
    gridSurface: 'transparent'
  };
  const state = {
    profile: null,
    root: null,
    saved: structuredClone(DEFAULT_DESIGN),
    working: structuredClone(DEFAULT_DESIGN),
    editing: false,
    pendingUpload: false,
    dialog: null,
    quickControls: null,
    gridObserver: null
  };
  const chainedFetch = window.fetch.bind(window);
  const $ = selector => document.querySelector(selector);
  const clone = value => structuredClone(value);

  function normalizeDesign(value) {
    return { ...clone(DEFAULT_DESIGN), ...(value && typeof value === 'object' ? clone(value) : {}) };
  }

  function imageCss(value) {
    return value ? `url("${String(value).replaceAll('"', '\\"')}")` : 'none';
  }

  function pageBackground(design) {
    if (design.pageBackgroundType === 'media' && design.pageBackgroundMedia) {
      const size = design.pageMediaFit === 'stretch' ? '100% 100%' : design.pageMediaFit;
      return `${imageCss(design.pageBackgroundMedia)} center/${size} fixed no-repeat`;
    }
    if (design.pageBackgroundType === 'gradient') {
      return `linear-gradient(${design.pageBackgroundAngle}deg,${design.pageBackgroundPrimary},${design.pageBackgroundSecondary}) fixed`;
    }
    return design.pageBackgroundPrimary;
  }

  function applyVisibility(profile, design) {
    const card = profile?.card || {};
    const cover = $('[data-profile-cover]');
    if (cover) cover.hidden = !design.showCover || design.coverHeight === 0;
    const avatar = $('[data-profile-avatar]');
    if (avatar) avatar.hidden = !design.showAvatar;
    const headline = $('[data-profile-headline]');
    if (headline) headline.hidden = !design.showHeadline || !card.headline;
    const bio = $('[data-profile-bio]');
    if (bio) bio.hidden = !design.showBio || !card.bio;
    const location = $('[data-profile-location]');
    if (location) location.hidden = !design.showLocation || !card.location;
    const website = $('[data-profile-website]');
    if (website) website.hidden = !design.showWebsite || !card.websiteUrl;
    const pageHeading = $('.profile-page-heading');
    if (pageHeading) pageHeading.hidden = !design.showPageHeading && !state.editing;
    const gridHeading = $('#profile-grid-heading');
    if (gridHeading) gridHeading.hidden = !design.showGridHeading && !state.editing;
  }

  function applyDesign(root, profile, design) {
    const shell = $('.profile-shell');
    const gridRegion = $('.profile-grid-region');
    if (!root || !shell) return;

    document.body.style.background = pageBackground(design);
    document.body.dataset.profilePageBackground = design.pageBackgroundType;
    document.body.dataset.profilePageOverlay = design.pageMediaOverlay;
    document.body.style.setProperty('--profile-page-overlay', {
      none: 'transparent',
      dark: 'rgba(0,0,0,.38)',
      light: 'rgba(255,255,255,.30)'
    }[design.pageMediaOverlay] || 'transparent');

    shell.dataset.contentWidth = design.contentWidth;
    shell.dataset.pageFont = design.pageFontFamily;
    shell.style.setProperty('--profile-page-text', design.pageTextColour);
    shell.style.setProperty('--profile-page-font', FONT_STACKS[design.pageFontFamily] || FONT_STACKS.system);
    shell.style.setProperty('--profile-section-gap', `${design.sectionGap}px`);

    root.dataset.cardWidth = design.cardWidth;
    root.dataset.cardAlignment = design.cardAlignment;
    root.dataset.cardSurface = design.cardSurface;
    root.dataset.cardShadow = design.cardShadow;
    root.style.setProperty('--profile-card-cover-height', `${design.coverHeight}px`);
    root.style.setProperty('--profile-card-avatar-size', `${design.avatarSize}px`);
    root.style.setProperty('--profile-card-padding', `${design.cardPadding}px`);
    root.style.setProperty('--profile-card-border-width', `${design.cardBorderWidth}px`);
    root.style.setProperty('--profile-card-tile-gap-custom', `${design.cardTileGap}px`);
    root.style.setProperty('--profile-card-tile-row-custom', `${design.cardTileRowHeight}px`);
    root.style.marginLeft = design.cardAlignment === 'left' ? '0' : 'auto';
    root.style.marginRight = 'auto';

    const coverMedia = profile?.card?.coverMedia || null;
    if (design.cardSurface === 'cover' && coverMedia) {
      root.style.background = `${imageCss(coverMedia)} center/cover no-repeat`;
      root.classList.add('profile-card-cover-surface');
    } else if (design.cardSurface === 'solid') {
      root.style.background = profile?.card?.backgroundPrimary || '#11161d';
      root.classList.remove('profile-card-cover-surface');
    } else {
      root.style.background = `linear-gradient(${profile?.card?.backgroundAngle ?? 135}deg,${profile?.card?.backgroundPrimary || '#11161d'},${profile?.card?.backgroundSecondary || '#3157c9'})`;
      root.classList.remove('profile-card-cover-surface');
    }

    if (gridRegion) gridRegion.dataset.gridSurface = design.gridSurface;
    applyVisibility(profile, design);
    updateQuickControls();
  }

  function currentDesign() {
    return state.editing ? state.working : state.saved;
  }

  function triggerCardTileAction(kind) {
    const button = document.querySelector(`[data-add-card-tile="${kind}"]`);
    if (button) button.click();
  }

  function ensureQuickControls() {
    if (!state.root) return;
    const area = state.root.querySelector('.profile-card-tile-area');
    const grid = area?.querySelector('.profile-card-tile-grid');
    if (!area || !grid) return;

    let quick = area.querySelector('.profile-card-quick-controls');
    if (!quick) {
      quick = document.createElement('div');
      quick.className = 'profile-card-quick-controls';
      quick.innerHTML = `
        <div><strong>Card tiles</strong><span>Add up to four shortcuts or custom mini tiles directly to this card.</span></div>
        <div class="profile-card-quick-actions">
          <button type="button" data-quick-card-action="feature">+ Site tile</button>
          <button type="button" data-quick-card-action="link">+ Link</button>
          <button type="button" data-quick-card-action="custom">+ Custom</button>
          <button type="button" data-quick-card-details>Card details</button>
          <button type="button" data-quick-profile-design>Profile design</button>
        </div>`;
      area.prepend(quick);
      quick.querySelectorAll('[data-quick-card-action]').forEach(button => {
        button.addEventListener('click', () => triggerCardTileAction(button.dataset.quickCardAction));
      });
      quick.querySelector('[data-quick-card-details]').addEventListener('click', () => $('#profile-card-settings')?.click());
      quick.querySelector('[data-quick-profile-design]').addEventListener('click', openDialog);
    }
    state.quickControls = quick;

    if (!state.gridObserver) {
      state.gridObserver = new MutationObserver(() => queueMicrotask(renderEmptySlots));
      state.gridObserver.observe(grid, { childList: true });
    }
    updateQuickControls();
    renderEmptySlots();
  }

  function renderEmptySlots() {
    const grid = state.root?.querySelector('.profile-card-tile-grid');
    if (!grid) return;
    const count = grid.querySelectorAll('.profile-card-mini-tile').length;
    const needed = state.editing ? Math.max(0, 4 - count) : 0;
    const existing = [...grid.querySelectorAll('.profile-card-empty-slot')];
    if (existing.length === needed) return;
    state.gridObserver?.disconnect();
    existing.forEach(slot => slot.remove());
    for (let index = 0; index < needed; index += 1) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'profile-card-empty-slot';
      slot.innerHTML = `<strong>+</strong><span>Add card tile ${count + index + 1}</span>`;
      slot.addEventListener('click', () => triggerCardTileAction('custom'));
      grid.append(slot);
    }
    state.gridObserver?.observe(grid, { childList: true });
  }

  function updateQuickControls() {
    if (!state.quickControls) return;
    state.quickControls.hidden = !state.editing;
    const count = state.root?.querySelectorAll('.profile-card-mini-tile').length || 0;
    state.quickControls.querySelectorAll('[data-quick-card-action]').forEach(button => { button.disabled = count >= 4; });
  }

  function injectDesignButton() {
    const actions = $('.profile-editor-actions');
    if (!actions || $('#profile-design-settings')) return;
    const button = document.createElement('button');
    button.id = 'profile-design-settings';
    button.type = 'button';
    button.textContent = 'Profile design';
    button.addEventListener('click', openDialog);
    actions.prepend(button);
  }

  function injectDialog() {
    if ($('#profile-design-dialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'profile-design-dialog';
    dialog.className = 'profile-settings-dialog profile-design-dialog';
    dialog.innerHTML = `
      <div class="profile-dialog-heading"><div><p class="eyebrow">Profile design</p><h2>Customize the whole profile</h2></div><button type="button" data-profile-design-close>Close</button></div>
      <div class="profile-dialog-body">
        <section class="profile-settings-section"><h3>Page canvas</h3>
          <div class="profile-two-column"><label>Background type<select id="design-page-background-type"><option value="solid">Solid colour</option><option value="gradient">Gradient</option><option value="media">Picture / animated GIF</option></select></label><label>Page font<select id="design-page-font"><option value="system">Grev.dad system</option><option value="display">Bold display</option><option value="mono">Monospace</option><option value="serif">Serif</option><option value="rounded">Rounded</option></select></label></div>
          <div class="profile-four-column"><label>First colour<input id="design-page-primary" type="color"></label><label>Second colour<input id="design-page-secondary" type="color"></label><label>Text colour<input id="design-page-text" type="color"></label><label>Angle <output id="design-page-angle-output">135°</output><input id="design-page-angle" type="range" min="0" max="360" step="5"></label></div>
          <div id="design-page-media-controls" class="profile-media-tile-controls" hidden><label class="profile-upload">Page picture / GIF<input id="design-page-media" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><span id="design-page-media-status">No page picture selected.</span></label><div class="profile-two-column"><label>Picture fit<select id="design-page-media-fit"><option value="cover">Cover</option><option value="contain">Contain</option><option value="stretch">Stretch</option></select></label><label>Overlay<select id="design-page-overlay"><option value="dark">Dark</option><option value="light">Light</option><option value="none">None</option></select></label></div><button id="design-remove-page-media" type="button">Remove page picture</button></div>
          <div class="profile-three-column"><label>Content width<select id="design-content-width"><option value="standard">Standard</option><option value="wide">Wide</option><option value="full">Full browser width</option></select></label><label>Section spacing<select id="design-section-gap"><option value="16">Tight</option><option value="24">Compact</option><option value="32">Default</option><option value="40">Open</option><option value="48">Large</option><option value="64">Extra large</option></select></label><label>Lower grid surface<select id="design-grid-surface"><option value="transparent">Transparent</option><option value="outlined">Outlined</option><option value="panel">Panel</option></select></label></div>
        </section>
        <section class="profile-settings-section"><h3>Profile card layout</h3>
          <div class="profile-three-column"><label>Card width<select id="design-card-width"><option value="compact">Compact</option><option value="wide">Wide</option><option value="full">Full width</option></select></label><label>Alignment<select id="design-card-alignment"><option value="centre">Centre</option><option value="left">Left</option></select></label><label>Card surface<select id="design-card-surface"><option value="gradient">Gradient</option><option value="solid">Solid colour</option><option value="cover">Use cover as card background</option></select></label></div>
          <div class="profile-four-column"><label>Cover height<select id="design-cover-height"><option value="0">Hidden height</option><option value="120">Short</option><option value="180">Default</option><option value="240">Tall</option><option value="320">Extra tall</option></select></label><label>Avatar size<select id="design-avatar-size"><option value="72">Small</option><option value="96">Medium</option><option value="120">Large</option><option value="144">Extra large</option><option value="168">Huge</option></select></label><label>Card padding<select id="design-card-padding"><option value="12">12 px</option><option value="16">16 px</option><option value="20">20 px</option><option value="24">24 px</option><option value="28">28 px</option><option value="32">32 px</option><option value="40">40 px</option><option value="48">48 px</option></select></label><label>Border width<select id="design-card-border"><option value="0">None</option><option value="1">1 px</option><option value="2">2 px</option><option value="4">4 px</option></select></label></div>
          <label>Card shadow<select id="design-card-shadow"><option value="none">None</option><option value="small">Small</option><option value="large">Large</option></select></label>
        </section>
        <section class="profile-settings-section"><h3>Card tile layout</h3><div class="profile-two-column"><label>Mini-tile gap<select id="design-card-tile-gap"><option value="0">0 px</option><option value="4">4 px</option><option value="8">8 px</option><option value="10">10 px</option><option value="12">12 px</option><option value="16">16 px</option><option value="20">20 px</option><option value="24">24 px</option></select></label><label>Mini-tile height<select id="design-card-tile-row"><option value="72">Compact</option><option value="92">Default</option><option value="112">Roomy</option><option value="132">Large</option><option value="160">Extra large</option></select></label></div></section>
        <section class="profile-settings-section"><h3>Visible sections</h3><div class="profile-design-checks">
          <label><input id="design-show-page-heading" type="checkbox"> Page heading</label><label><input id="design-show-grid-heading" type="checkbox"> Profile-grid heading</label><label><input id="design-show-cover" type="checkbox"> Cover strip</label><label><input id="design-show-avatar" type="checkbox"> Avatar</label><label><input id="design-show-headline" type="checkbox"> Headline</label><label><input id="design-show-bio" type="checkbox"> Bio</label><label><input id="design-show-location" type="checkbox"> Location</label><label><input id="design-show-website" type="checkbox"> Website</label>
        </div></section>
        <button id="design-reset" type="button">Reset profile design</button>
      </div>`;
    document.body.append(dialog);
    state.dialog = dialog;
    dialog.querySelector('[data-profile-design-close]').addEventListener('click', () => dialog.close());
    dialog.querySelectorAll('input:not([type="file"]),select').forEach(control => {
      control.addEventListener('input', updateFromControls);
      control.addEventListener('change', updateFromControls);
    });
    $('#design-page-media').addEventListener('change', event => readPageMedia(event.currentTarget.files?.[0]));
    $('#design-remove-page-media').addEventListener('click', () => {
      state.working.pageBackgroundMedia = null;
      if (state.working.pageBackgroundType === 'media') state.working.pageBackgroundType = 'gradient';
      populateControls();
      applyDesign(state.root, state.profile, state.working);
    });
    $('#design-reset').addEventListener('click', () => {
      state.working = clone(DEFAULT_DESIGN);
      populateControls();
      applyDesign(state.root, state.profile, state.working);
    });
  }

  function setControl(id, value) {
    const control = $(`#${id}`);
    if (!control) return;
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = String(value);
  }

  function populateControls() {
    const design = state.working;
    const mapping = {
      'design-page-background-type': design.pageBackgroundType,
      'design-page-primary': design.pageBackgroundPrimary,
      'design-page-secondary': design.pageBackgroundSecondary,
      'design-page-text': design.pageTextColour,
      'design-page-angle': design.pageBackgroundAngle,
      'design-page-media-fit': design.pageMediaFit,
      'design-page-overlay': design.pageMediaOverlay,
      'design-page-font': design.pageFontFamily,
      'design-content-width': design.contentWidth,
      'design-section-gap': design.sectionGap,
      'design-grid-surface': design.gridSurface,
      'design-card-width': design.cardWidth,
      'design-card-alignment': design.cardAlignment,
      'design-card-surface': design.cardSurface,
      'design-cover-height': design.coverHeight,
      'design-avatar-size': design.avatarSize,
      'design-card-padding': design.cardPadding,
      'design-card-border': design.cardBorderWidth,
      'design-card-shadow': design.cardShadow,
      'design-card-tile-gap': design.cardTileGap,
      'design-card-tile-row': design.cardTileRowHeight,
      'design-show-page-heading': design.showPageHeading,
      'design-show-grid-heading': design.showGridHeading,
      'design-show-cover': design.showCover,
      'design-show-avatar': design.showAvatar,
      'design-show-headline': design.showHeadline,
      'design-show-bio': design.showBio,
      'design-show-location': design.showLocation,
      'design-show-website': design.showWebsite
    };
    Object.entries(mapping).forEach(([id, value]) => setControl(id, value));
    $('#design-page-angle-output').textContent = `${design.pageBackgroundAngle}°`;
    $('#design-page-media-controls').hidden = design.pageBackgroundType !== 'media';
    $('#design-page-media-status').textContent = design.pageBackgroundMedia ? 'Custom page picture selected.' : 'No page picture selected.';
  }

  function updateFromControls() {
    const d = state.working;
    d.pageBackgroundType = $('#design-page-background-type').value;
    d.pageBackgroundPrimary = $('#design-page-primary').value;
    d.pageBackgroundSecondary = $('#design-page-secondary').value;
    d.pageTextColour = $('#design-page-text').value;
    d.pageBackgroundAngle = Number($('#design-page-angle').value);
    d.pageMediaFit = $('#design-page-media-fit').value;
    d.pageMediaOverlay = $('#design-page-overlay').value;
    d.pageFontFamily = $('#design-page-font').value;
    d.contentWidth = $('#design-content-width').value;
    d.sectionGap = Number($('#design-section-gap').value);
    d.gridSurface = $('#design-grid-surface').value;
    d.cardWidth = $('#design-card-width').value;
    d.cardAlignment = $('#design-card-alignment').value;
    d.cardSurface = $('#design-card-surface').value;
    d.coverHeight = Number($('#design-cover-height').value);
    d.avatarSize = Number($('#design-avatar-size').value);
    d.cardPadding = Number($('#design-card-padding').value);
    d.cardBorderWidth = Number($('#design-card-border').value);
    d.cardShadow = $('#design-card-shadow').value;
    d.cardTileGap = Number($('#design-card-tile-gap').value);
    d.cardTileRowHeight = Number($('#design-card-tile-row').value);
    d.showPageHeading = $('#design-show-page-heading').checked;
    d.showGridHeading = $('#design-show-grid-heading').checked;
    d.showCover = $('#design-show-cover').checked;
    d.showAvatar = $('#design-show-avatar').checked;
    d.showHeadline = $('#design-show-headline').checked;
    d.showBio = $('#design-show-bio').checked;
    d.showLocation = $('#design-show-location').checked;
    d.showWebsite = $('#design-show-website').checked;
    $('#design-page-angle-output').textContent = `${d.pageBackgroundAngle}°`;
    $('#design-page-media-controls').hidden = d.pageBackgroundType !== 'media';
    applyDesign(state.root, state.profile, d);
  }

  function openDialog() {
    if (!state.editing || !state.dialog) return;
    populateControls();
    state.dialog.showModal();
  }

  function readPageMedia(file) {
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) {
      $('#profile-editor-message').textContent = 'Choose a PNG, JPEG, WebP or animated GIF no larger than 1.4 MB.';
      $('#profile-editor-message').className = 'profile-editor-message error';
      return;
    }
    state.pendingUpload = true;
    const reader = new FileReader();
    reader.onload = () => {
      state.working.pageBackgroundMedia = String(reader.result || '');
      state.working.pageBackgroundType = 'media';
      state.pendingUpload = false;
      populateControls();
      applyDesign(state.root, state.profile, state.working);
    };
    reader.onerror = () => {
      state.pendingUpload = false;
      $('#profile-editor-message').textContent = 'The selected page picture could not be loaded.';
      $('#profile-editor-message').className = 'profile-editor-message error';
    };
    reader.readAsDataURL(file);
  }

  const originalApply = window.GrevProfileCard?.apply?.bind(window.GrevProfileCard);
  if (originalApply) {
    window.GrevProfileCard.apply = (root, profile) => {
      originalApply(root, profile);
      state.root = root;
      state.profile = profile;
      if (!state.editing) {
        state.saved = normalizeDesign(profile.design);
        state.working = clone(state.saved);
      }
      applyDesign(root, profile, currentDesign());
      ensureQuickControls();
    };
  }

  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET')).toUpperCase();
    if (method === 'PUT' && new URL(url, location.origin).pathname === '/api/profile' && state.editing) {
      let body;
      try { body = JSON.parse(String(init.body || '{}')); } catch { body = {}; }
      body.design = state.working;
      const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
      headers.set('Content-Type', 'application/json');
      const response = await chainedFetch(input, { ...init, headers, body: JSON.stringify(body) });
      if (response.ok) {
        try {
          const payload = await response.clone().json();
          if (payload.profile) {
            state.profile = payload.profile;
            state.saved = normalizeDesign(payload.profile.design || state.working);
            state.working = clone(state.saved);
          }
        } catch {}
        state.editing = false;
        state.dialog?.close();
        applyDesign(state.root, state.profile, state.saved);
        updateQuickControls();
      }
      return response;
    }
    return chainedFetch(input, init);
  };

  function initialise() {
    injectDesignButton();
    injectDialog();
    $('#profile-edit')?.addEventListener('click', () => {
      state.editing = true;
      state.working = clone(state.saved);
      applyDesign(state.root, state.profile, state.working);
      ensureQuickControls();
    });
    $('#profile-cancel')?.addEventListener('click', () => {
      state.editing = false;
      state.working = clone(state.saved);
      state.dialog?.close();
      applyDesign(state.root, state.profile, state.saved);
      updateQuickControls();
    });
    $('#profile-save')?.addEventListener('click', event => {
      if (!state.editing) return;
      if (state.pendingUpload) {
        event.preventDefault();
        event.stopImmediatePropagation();
        $('#profile-editor-message').textContent = 'Wait for the selected page picture to finish loading before saving.';
        $('#profile-editor-message').className = 'profile-editor-message error';
        return;
      }
      if (state.working.pageBackgroundType === 'media' && !state.working.pageBackgroundMedia) {
        event.preventDefault();
        event.stopImmediatePropagation();
        $('#profile-editor-message').textContent = 'Choose a page picture or switch the page background away from media.';
        $('#profile-editor-message').className = 'profile-editor-message error';
      }
    }, true);
    ensureQuickControls();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
