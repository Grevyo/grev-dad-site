(() => {
  const MAX_HISTORY = 50;
  const APPEARANCE_FIELDS = [
    'colour','backgroundType','backgroundPrimary','backgroundSecondary','backgroundAngle','backgroundMedia',
    'textColour','fontFamily','borderColour','contentMode','customTitle','customIcon','mediaFit','mediaOverlay',
    'iconMode','iconLabel','iconMedia','iconTextColour','iconBackgroundColour','iconBorderColour','iconMediaFit'
  ];

  const history = {
    undo: [],
    redo: [],
    baseline: null,
    current: null,
    pendingBefore: null,
    pendingTimer: null,
    styleClipboard: null,
    pendingCloseAction: null,
    draftAvailable: false
  };

  const $ = selector => document.querySelector(selector);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function editorOpen() {
    return Boolean(typeof dashboardState !== 'undefined' && dashboardState.editing);
  }

  function preferenceSnapshot() {
    return {
      density: $('#dashboard-density')?.value ?? 'comfortable',
      tileGap: Number($('#dashboard-tile-gap')?.value ?? 12),
      outerMargin: Number($('#dashboard-outer-margin')?.value ?? 0),
      showDescriptions: $('#dashboard-show-descriptions')?.checked !== false
    };
  }

  function snapshot() {
    if (typeof dashboardState === 'undefined') return null;
    return {
      tiles: clone(dashboardState.workingTiles ?? []),
      preferences: preferenceSnapshot(),
      selectedId: dashboardState.selectedId ?? null
    };
  }

  function snapshotKey(value) {
    return JSON.stringify(value);
  }

  function draftKey() {
    const viewerId = dashboardState?.payload?.viewer?.id;
    return viewerId ? `grev-dashboard-draft:${viewerId}` : null;
  }

  function setControlValue(selector, value) {
    const control = $(selector);
    if (!control) return;
    if (control.type === 'checkbox') control.checked = Boolean(value);
    else control.value = String(value);
  }

  function applySnapshot(value, message = '') {
    if (!value || typeof dashboardState === 'undefined') return;
    dashboardState.iconUploads?.clear?.();
    dashboardState.workingTiles = clone(value.tiles ?? []);
    dashboardState.selectedId = value.selectedId && dashboardState.workingTiles.some(tile => tile.featureId === value.selectedId)
      ? value.selectedId
      : (dashboardState.workingTiles[0]?.featureId ?? null);
    setControlValue('#dashboard-density', value.preferences?.density ?? 'comfortable');
    setControlValue('#dashboard-tile-gap', value.preferences?.tileGap ?? 12);
    setControlValue('#dashboard-outer-margin', value.preferences?.outerMargin ?? 0);
    setControlValue('#dashboard-show-descriptions', value.preferences?.showDescriptions !== false);
    history.current = snapshot();
    if (typeof renderEditor === 'function') renderEditor();
    if (message && typeof editorMessage === 'function') editorMessage(message, 'success');
    updateControls();
  }

  function trimHistory(list) {
    if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
  }

  function recordChange(before, after, label = 'Dashboard changed') {
    if (!before || !after || snapshotKey(before) === snapshotKey(after)) return false;
    history.undo.push({ snapshot: clone(before), label });
    trimHistory(history.undo);
    history.redo = [];
    history.current = clone(after);
    saveDraft(after);
    updateControls();
    return true;
  }

  function beginMutation(label = 'Dashboard changed') {
    if (!editorOpen() || history.pendingBefore) return;
    history.pendingBefore = { snapshot: snapshot(), label };
  }

  function finishMutation(delay = 0) {
    clearTimeout(history.pendingTimer);
    history.pendingTimer = setTimeout(() => {
      const pending = history.pendingBefore;
      history.pendingBefore = null;
      if (!pending || !editorOpen()) return;
      recordChange(pending.snapshot, snapshot(), pending.label);
    }, delay);
  }

  function undo() {
    if (!editorOpen() || !history.undo.length) return;
    const entry = history.undo.pop();
    const current = snapshot();
    history.redo.push({ snapshot: clone(current), label: entry.label });
    applySnapshot(entry.snapshot, `Undid: ${entry.label}`);
    saveDraft(snapshot());
  }

  function redo() {
    if (!editorOpen() || !history.redo.length) return;
    const entry = history.redo.pop();
    const current = snapshot();
    history.undo.push({ snapshot: clone(current), label: entry.label });
    trimHistory(history.undo);
    applySnapshot(entry.snapshot, `Redid: ${entry.label}`);
    saveDraft(snapshot());
  }

  function selectedTile() {
    return dashboardState?.workingTiles?.find(tile => tile.featureId === dashboardState.selectedId) ?? null;
  }

  function copyStyle() {
    const tile = selectedTile();
    if (!tile) {
      editorMessage?.('Open Tile settings for a tile before copying its style.', 'error');
      return;
    }
    history.styleClipboard = Object.fromEntries(APPEARANCE_FIELDS.map(field => [field, clone(tile[field] ?? null)]));
    editorMessage?.('Tile style copied. Select another tile and press Paste style.', 'success');
    updateControls();
  }

  function pasteStyle() {
    const tile = selectedTile();
    if (!tile || !history.styleClipboard) {
      editorMessage?.('Copy a tile style first, then select the destination tile.', 'error');
      return;
    }
    const before = snapshot();
    Object.assign(tile, clone(history.styleClipboard));
    renderEditor?.();
    recordChange(before, snapshot(), 'Paste tile style');
    editorMessage?.('Copied style applied to the selected tile.', 'success');
  }

  function restoreSaved() {
    if (!history.baseline) return;
    const before = snapshot();
    applySnapshot(history.baseline);
    recordChange(before, snapshot(), 'Restore saved dashboard');
    editorMessage?.('Restored the last saved dashboard inside the editor. Press Save dashboard to keep it.', 'success');
  }

  function saveDraft(value = snapshot()) {
    const key = draftKey();
    const status = $('#dashboard-draft-status');
    if (!key || !value) return;
    try {
      localStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), snapshot: value }));
      history.draftAvailable = true;
      if (status) status.textContent = `Draft saved locally · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      if (status) status.textContent = 'Draft could not be stored locally. Large tile images may exceed browser storage.';
    }
    updateControls();
  }

  function readDraft() {
    const key = draftKey();
    if (!key) return null;
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value?.version === 1 && value.snapshot ? value : null;
    } catch {
      return null;
    }
  }

  function clearDraft() {
    const key = draftKey();
    if (key) localStorage.removeItem(key);
    history.draftAvailable = false;
    const status = $('#dashboard-draft-status');
    if (status) status.textContent = 'No local draft.';
    updateControls();
  }

  function restoreDraft() {
    const draft = readDraft();
    if (!draft) {
      clearDraft();
      editorMessage?.('No recoverable dashboard draft was found.', 'error');
      return;
    }
    const before = snapshot();
    applySnapshot(draft.snapshot);
    recordChange(before, snapshot(), 'Restore local draft');
    editorMessage?.(`Local draft restored from ${new Date(draft.savedAt).toLocaleString()}.`, 'success');
  }

  function initializeSession() {
    history.undo = [];
    history.redo = [];
    history.pendingBefore = null;
    history.current = snapshot();
    history.baseline = clone(history.current);
    history.draftAvailable = Boolean(readDraft());
    const status = $('#dashboard-draft-status');
    const draft = readDraft();
    if (status) status.textContent = draft
      ? `Recoverable local draft · ${new Date(draft.savedAt).toLocaleString()}`
      : 'No local draft.';
    updateControls();
  }

  function updateControls() {
    const undoButton = $('#dashboard-undo-layout');
    const redoButton = $('#dashboard-redo-layout');
    const pasteButton = $('#dashboard-paste-style');
    const restoreDraftButton = $('#dashboard-restore-draft');
    const discardDraftButton = $('#dashboard-discard-draft');
    if (undoButton) {
      undoButton.disabled = history.undo.length === 0;
      undoButton.title = history.undo.length ? `Undo ${history.undo.at(-1).label}` : 'Nothing to undo';
    }
    if (redoButton) {
      redoButton.disabled = history.redo.length === 0;
      redoButton.title = history.redo.length ? `Redo ${history.redo.at(-1).label}` : 'Nothing to redo';
    }
    if (pasteButton) pasteButton.disabled = !history.styleClipboard || !selectedTile();
    if (restoreDraftButton) restoreDraftButton.disabled = !history.draftAvailable;
    if (discardDraftButton) discardDraftButton.disabled = !history.draftAvailable;
  }

  function installUi() {
    const toolbar = $('#dashboard-editor-toolbar');
    const topLine = toolbar?.querySelector('.dashboard-editor-topline');
    const settingsDialog = $('#dashboard-selected-controls');
    if (!toolbar || !topLine || $('#dashboard-history-tools')) return;

    const tools = document.createElement('section');
    tools.id = 'dashboard-history-tools';
    tools.className = 'dashboard-history-tools';
    tools.setAttribute('aria-label', 'Dashboard editing history and drafts');
    tools.innerHTML = `
      <div class="dashboard-history-buttons">
        <button id="dashboard-undo-layout" type="button" disabled>Undo</button>
        <button id="dashboard-redo-layout" type="button" disabled>Redo</button>
        <button id="dashboard-restore-saved" type="button">Restore saved</button>
        <button id="dashboard-restore-draft" type="button" disabled>Restore draft</button>
        <button id="dashboard-discard-draft" type="button" disabled>Discard draft</button>
      </div>
      <span id="dashboard-draft-status">No local draft.</span>`;
    topLine.insertAdjacentElement('afterend', tools);

    if (settingsDialog && !$('#dashboard-style-tools')) {
      const styleTools = document.createElement('section');
      styleTools.id = 'dashboard-style-tools';
      styleTools.className = 'dashboard-tile-settings-section dashboard-style-tools';
      styleTools.innerHTML = `
        <div class="dashboard-tile-settings-section-heading"><h3>Reuse appearance</h3><span>Copy between tiles</span></div>
        <div><button id="dashboard-copy-style" type="button">Copy style</button><button id="dashboard-paste-style" type="button" disabled>Paste style</button></div>`;
      settingsDialog.insertBefore(styleTools, $('#dashboard-remove-selected'));
    }

    $('#dashboard-undo-layout')?.addEventListener('click', undo);
    $('#dashboard-redo-layout')?.addEventListener('click', redo);
    $('#dashboard-restore-saved')?.addEventListener('click', restoreSaved);
    $('#dashboard-restore-draft')?.addEventListener('click', restoreDraft);
    $('#dashboard-discard-draft')?.addEventListener('click', clearDraft);
    $('#dashboard-copy-style')?.addEventListener('click', copyStyle);
    $('#dashboard-paste-style')?.addEventListener('click', pasteStyle);
  }

  function installStyles() {
    if ($('#dashboard-history-styles')) return;
    const style = document.createElement('style');
    style.id = 'dashboard-history-styles';
    style.textContent = `
      .dashboard-history-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid var(--line);background:#0d1218}
      .dashboard-history-buttons{display:flex;flex-wrap:wrap;gap:8px}
      .dashboard-history-tools button,.dashboard-style-tools button{min-height:38px;padding:8px 12px;border:1px solid var(--line-strong);background:#151b23;color:var(--text);font-weight:900;cursor:pointer}
      .dashboard-history-tools button:disabled,.dashboard-style-tools button:disabled{opacity:.42;cursor:not-allowed;transform:none;box-shadow:none}
      #dashboard-draft-status{color:var(--muted);font-size:.7rem;text-align:right}
      .dashboard-style-tools>div:last-child{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      @media(max-width:760px){.dashboard-history-tools{align-items:stretch;flex-direction:column}.dashboard-history-buttons{display:grid;grid-template-columns:1fr 1fr}#dashboard-draft-status{text-align:left}.dashboard-style-tools>div:last-child{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  function mutationLabel(target, eventType) {
    if (target.closest('#dashboard-pack-layout')) return 'Pack tiles';
    if (target.closest('#dashboard-reset-layout')) return 'Load defaults';
    if (target.closest('#dashboard-remove-selected')) return 'Remove tile';
    if (target.closest('#dashboard-catalogue')) return 'Add or select tile';
    if (target.closest('#dashboard-selected-dimension')) return 'Resize tile';
    if (target.closest('[data-move-x][data-move-y]')) return 'Move tile';
    if (target.closest('.dashboard-tile-settings-dialog')) return 'Edit tile settings';
    if (target.closest('.dashboard-editor-settings')) return 'Change dashboard preferences';
    if (target.closest('#dashboard-grid')) return eventType === 'drop' ? 'Move tile' : 'Edit tile placement';
    return 'Dashboard changed';
  }

  function installMutationTracking() {
    const relevant = '#dashboard-editor-toolbar,#dashboard-editor-catalogue-panel,#dashboard-grid,#dashboard-tile-settings-dialog';
    const start = event => {
      if (!editorOpen() || !(event.target instanceof Element) || !event.target.closest(relevant)) return;
      if (event.target.closest('#dashboard-history-tools,#dashboard-style-tools,#dashboard-save-layout,#dashboard-cancel-layout')) return;
      beginMutation(mutationLabel(event.target, event.type));
    };
    const finish = event => {
      if (!editorOpen() || !(event.target instanceof Element) || !event.target.closest(relevant)) return;
      if (event.target.closest('#dashboard-history-tools,#dashboard-style-tools,#dashboard-save-layout,#dashboard-cancel-layout')) return;
      finishMutation(event.type === 'input' ? 220 : 30);
    };

    document.addEventListener('pointerdown', start, true);
    document.addEventListener('keydown', start, true);
    document.addEventListener('dragstart', start, true);
    document.addEventListener('input', finish, true);
    document.addEventListener('change', finish, true);
    document.addEventListener('click', finish, true);
    document.addEventListener('drop', finish, true);
    document.addEventListener('pointerup', finish, true);
  }

  function installKeyboardShortcuts() {
    document.addEventListener('keydown', event => {
      if (!editorOpen() || !(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        event.preventDefault();
        redo();
      }
    });
  }

  function installEditorLifecycle() {
    const toolbar = $('#dashboard-editor-toolbar');
    if (!toolbar) return;
    new MutationObserver(() => {
      if (!toolbar.hidden && editorOpen()) initializeSession();
      if (toolbar.hidden && history.pendingCloseAction === 'save') clearDraft();
      if (toolbar.hidden) history.pendingCloseAction = null;
    }).observe(toolbar, { attributes: true, attributeFilter: ['hidden'] });

    $('#dashboard-save-layout')?.addEventListener('click', () => { history.pendingCloseAction = 'save'; }, true);
    $('#dashboard-cancel-layout')?.addEventListener('click', () => { history.pendingCloseAction = 'cancel'; }, true);
  }

  function installSelectionRefresh() {
    document.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('.dashboard-tile-settings,.dashboard-catalogue-card button,#dashboard-grid')) {
        queueMicrotask(updateControls);
      }
    }, true);
  }

  function initialize() {
    installStyles();
    installUi();
    installMutationTracking();
    installKeyboardShortcuts();
    installEditorLifecycle();
    installSelectionRefresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
