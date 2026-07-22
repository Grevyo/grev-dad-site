(() => {
  const GRID_COLUMNS = 8;
  const GRID_ROWS = 200;

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function cardFootprint() {
    const value = window.GrevProfileCanvas?.cardFootprint?.();
    return value && Number.isInteger(value.x) && Number.isInteger(value.y)
      ? value
      : { x: 0, y: 0, width: 4, height: 6 };
  }

  function freePlacement(width, height) {
    const tiles = typeof profileState !== 'undefined' && Array.isArray(profileState.working?.tiles)
      ? profileState.working.tiles
      : [];
    const card = cardFootprint();
    for (let y = 0; y <= GRID_ROWS - height; y += 1) {
      for (let x = 0; x <= GRID_COLUMNS - width; x += 1) {
        const candidate = { x, y, width, height };
        if (overlaps(candidate, card)) continue;
        if (tiles.some(tile => overlaps(candidate, tile))) continue;
        return candidate;
      }
    }
    return null;
  }

  function installCollisionSafeTileDefaults() {
    if (typeof profileTileDefaults !== 'function' || profileTileDefaults.collisionSafeSpawn === true) return;
    const previous = profileTileDefaults;
    const wrapped = function collisionSafeProfileTileDefaults(type) {
      const tile = previous(type);
      const placement = freePlacement(tile.width, tile.height);
      if (placement) Object.assign(tile, placement);
      return tile;
    };
    wrapped.collisionSafeSpawn = true;
    profileTileDefaults = wrapped;
  }

  function tileLayoutError() {
    if (typeof profileState === 'undefined' || !profileState.working) return 'The editable profile is unavailable.';
    const tiles = Array.isArray(profileState.working.tiles) ? profileState.working.tiles : [];
    const card = cardFootprint();
    for (let index = 0; index < tiles.length; index += 1) {
      const tile = tiles[index];
      if (![tile.x, tile.y, tile.width, tile.height].every(Number.isInteger)) return 'Every tile needs a valid grid position.';
      if (tile.x < 0 || tile.y < 0 || tile.width < 1 || tile.width > 6 || tile.height < 1 || tile.height > 4 || tile.x + tile.width > GRID_COLUMNS || tile.y + tile.height > GRID_ROWS) {
        return 'Every tile must stay inside the profile canvas.';
      }
      if (overlaps(tile, card)) return 'A profile tile is overlapping the profile card.';
      if (tiles.slice(0, index).some(other => overlaps(tile, other))) return 'Profile tiles cannot overlap each other.';
      if (tile.tileType === 'link' && (!tile.linkUrl || !/^https?:\/\//i.test(tile.linkUrl))) return 'Every link tile needs a valid http:// or https:// URL.';
      if ((tile.tileType === 'media' || tile.backgroundType === 'media') && !tile.backgroundMedia) return 'Every picture/GIF tile needs an uploaded picture.';
    }
    return null;
  }

  async function saveTilesOnly(button) {
    if (typeof profileState === 'undefined' || !profileState.working) return;
    if (profileState.uploads?.size) {
      profileEditorMessage('Wait for the selected picture to finish loading before saving.', 'error');
      return;
    }
    const invalid = tileLayoutError();
    if (invalid) {
      profileEditorMessage(invalid, 'error');
      return;
    }

    button.disabled = true;
    profileEditorMessage('Saving tiles…');
    try {
      const response = await fetch('/api/profile/tiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiles: profileState.working.tiles,
          preferences: profileState.working.preferences
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.profile) {
        profileEditorMessage(payload.message ?? 'Unable to save profile tiles.', 'error');
        return;
      }

      const previousProfile = profileState.profile ?? {};
      profileState.profile = { ...previousProfile, ...payload.profile };
      if (previousProfile.design && !profileState.profile.design) profileState.profile.design = previousProfile.design;
      if (previousProfile.cardTiles && !profileState.profile.cardTiles) profileState.profile.cardTiles = previousProfile.cardTiles;
      profileState.working = {
        card: cloneProfile(payload.profile.card),
        tiles: cloneProfile(payload.profile.tiles ?? []),
        preferences: cloneProfile(payload.profile.preferences)
      };
      profileState.saved = cloneProfile(profileState.working);
      leaveProfileEditor(true);
      profileMessage('Profile tiles saved.', 'success');
    } catch (error) {
      console.error(error);
      profileEditorMessage('Unable to save profile tiles.', 'error');
    } finally {
      if (typeof profileState !== 'undefined' && profileState.editing) button.disabled = false;
    }
  }

  function installTileSaveRouting() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('[data-profile-tile-save]') : null;
      if (!(target instanceof HTMLButtonElement)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void saveTilesOnly(target);
    }, true);
  }

  function initialise() {
    installCollisionSafeTileDefaults();
    installTileSaveRouting();
  }

  window.GrevProfileTileSaveFix = {
    freePlacement,
    tileLayoutError,
    saveTilesOnly
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
  else initialise();
})();
