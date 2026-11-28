// The grev.dad tile engine: one grid, one editor and one set of rules for Home and Profile, matching
// Grev Home's own tile editor (8 columns, tiles 1–6 wide and 1–4 tall, up to 40 tiles, no overlaps).
//
// Editing works three ways, all driving the same actions:
//  - mouse/touch: drag a tile to move it, drag its corner to resize, tap to select, double-tap to edit;
//  - keyboard: arrows move the cursor, Enter picks a tile up or adds one on an empty cell, arrows move
//    it, Enter drops it, Escape cancels, R resizes, E edits, Delete removes, Ctrl+Z / Ctrl+Y undo/redo;
//  - controller: D-pad/left stick, A (pick up/drop/add), B (cancel), X (resize), Y (edit), View (remove),
//    LB/RB (undo/redo), Menu (save) — the same buttons as Grev Home's tile editor.
import { h, icon, sheet, toast, confirmSheet } from './ui.js';
import { uuid } from './api.js';
import { WIDGET_KINDS, renderWidget } from './widgets.js';

export const GRID = { columns: 8, maxY: 199, minW: 1, maxW: 6, minH: 1, maxH: 4, maxTiles: 40, cardW: 4, cardH: 6 };
const CARD_ID = '__card__';
const FONTS = { system: 'Inter,system-ui,sans-serif', display: 'Impact,"Arial Narrow Bold",sans-serif', mono: 'ui-monospace,Consolas,monospace', serif: 'Georgia,"Times New Roman",serif', rounded: '"Nunito","Segoe UI",system-ui,sans-serif' };
const DEFAULT_LOOK = { backgroundType: 'solid', backgroundPrimary: '#11161d', backgroundSecondary: '#3157c9', backgroundAngle: 135, backgroundMedia: null, mediaFit: 'cover', mediaOverlay: 'dark', textColour: '#f4f7fb', borderColour: '#394657', fontFamily: 'system' };

const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const clone = (v) => JSON.parse(JSON.stringify(v));
/** Like Element.append, but skips null/false children (native append would print "null"). */
const add = (el, ...kids) => el.append(...kids.flat().filter(Boolean));

export function blankTile(fields = {}) {
  return { tileId: uuid(), tileType: 'text', x: 0, y: 0, width: 2, height: 2, title: null, body: null, linkLabel: null, linkUrl: null, statValue: null, ...DEFAULT_LOOK, widget: null, widgetConfig: {}, ...fields };
}

/** Draw one tile's face (used by the grid and by the editor's preview). */
export function tileFace(tile, widgetData) {
  const face = h('div', { class: `tile-face type-${tile.widget ? 'widget' : tile.tileType}` });
  const look = { ...DEFAULT_LOOK, ...tile };
  face.style.color = look.textColour;
  face.style.borderColor = look.borderColour;
  face.style.fontFamily = FONTS[look.fontFamily] ?? FONTS.system;
  if (look.backgroundType === 'gradient') face.style.background = `linear-gradient(${look.backgroundAngle}deg, ${look.backgroundPrimary}, ${look.backgroundSecondary})`;
  else if (look.backgroundType === 'media' && look.backgroundMedia) {
    face.style.backgroundColor = look.backgroundPrimary;
    face.style.backgroundImage = `url("${look.backgroundMedia}")`;
    face.style.backgroundSize = look.mediaFit === 'contain' ? 'contain' : look.mediaFit === 'stretch' ? '100% 100%' : 'cover';
    face.style.backgroundPosition = 'center'; face.style.backgroundRepeat = 'no-repeat';
    if (look.mediaOverlay !== 'none') face.classList.add(`overlay-${look.mediaOverlay}`);
  } else face.style.background = look.backgroundPrimary;

  const title = tile.title ? h('h3', { class: 'tile-title', text: tile.title }) : null;
  if (tile.widget) add(face, title ?? (tile.height > 1 ? h('h3', { class: 'tile-title', text: WIDGET_KINDS[tile.widget]?.label ?? 'Widget' }) : null), h('div', { class: 'tile-widget' }, renderWidget(tile.widget, widgetData)));
  else if (tile.tileType === 'stat') add(face, h('strong', { class: 'tile-stat', text: tile.statValue ?? '' }), title);
  else if (tile.tileType === 'link') {
    add(face, title, tile.body ? h('p', { class: 'tile-body', text: tile.body }) : null,
      tile.linkUrl ? h('a', { class: 'tile-link', href: tile.linkUrl, target: '_blank', rel: 'noopener noreferrer' }, icon('link'), tile.linkLabel || 'Open link') : null);
  } else add(face, title, tile.body ? h('p', { class: 'tile-body', text: tile.body }) : null);
  return face;
}

/**
 * opts: host, mode ('home'|'profile'), editable, tiles, widgets, card ({x,y} or null), renderCard(),
 * widgetKinds (ids offered in the editor), onSave({tiles, card}) → {tiles, widgets, card}.
 */
export function createTileGrid(opts) {
  const draftKey = `grevdad:tiles-draft:${opts.mode}`;
  const s = {
    tiles: clone(opts.tiles ?? []), widgets: opts.widgets ?? {}, card: opts.card ? { ...opts.card } : null,
    editing: false, saved: null, undo: [], redo: [], selected: null, cursor: { x: 0, y: 0 }, held: null, saving: false
  };
  const root = h('div', { class: 'tg-wrap' });
  const toolbar = h('div', { class: 'tg-toolbar', role: 'toolbar', 'aria-label': 'Tile editor' });
  const banner = h('div', { class: 'tg-banner', hidden: true });
  const grid = h('div', { class: 'tg', role: 'grid', 'aria-label': opts.mode === 'home' ? 'Home tiles' : 'Profile tiles' });
  const hint = h('p', { class: 'tg-hint', hidden: true });
  root.append(toolbar, banner, grid, hint);
  opts.host.replaceChildren(root);

  // --- geometry ---------------------------------------------------------------------------------
  const cardRect = () => s.card ? { tileId: CARD_ID, x: s.card.x, y: s.card.y, width: GRID.cardW, height: GRID.cardH } : null;
  const items = () => [cardRect(), ...s.tiles].filter(Boolean);
  const valid = (rect, ignoreId) => rect.x >= 0 && rect.y >= 0 && rect.y <= GRID.maxY && rect.x + rect.width <= GRID.columns
    && rect.y + rect.height <= GRID.maxY + 1 && !items().some(other => other.tileId !== ignoreId && overlaps(rect, other));
  const occupantAt = (x, y) => items().find(t => x >= t.x && x < t.x + t.width && y >= t.y && y < t.y + t.height) ?? null;
  const bottomRow = () => items().reduce((m, t) => Math.max(m, t.y + t.height), 0);
  const firstFree = (w, hgt) => { for (let y = 0; y <= GRID.maxY; y++) for (let x = 0; x + w <= GRID.columns; x++) if (valid({ x, y, width: w, height: hgt })) return { x, y }; return null; };

  let cell = 80;
  const narrow = () => grid.clientWidth < 620 && !s.editing;
  const measure = () => {
    const width = grid.clientWidth || opts.host.clientWidth || 800;
    const gap = width < 620 ? 8 : 12;
    grid.style.setProperty('--tg-gap', `${gap}px`);
    cell = Math.max(40, (width - gap * (GRID.columns - 1)) / GRID.columns);
    grid.style.setProperty('--tg-cell', `${Math.round(Math.min(96, Math.max(56, cell * 0.62)))}px`);
  };
  const resizeObserver = new ResizeObserver(() => { const wasNarrow = grid.classList.contains('flow'); measure(); if (wasNarrow !== narrow()) draw(); });
  resizeObserver.observe(opts.host);

  // --- history and drafts -----------------------------------------------------------------------
  const snapshot = () => ({ tiles: clone(s.tiles), card: s.card ? { ...s.card } : null });
  const record = () => { s.undo.push(snapshot()); if (s.undo.length > 60) s.undo.shift(); s.redo = []; saveDraft(); };
  const restore = (snap) => { s.tiles = clone(snap.tiles); s.card = snap.card ? { ...snap.card } : null; };
  const undo = () => { if (!s.undo.length) return; s.redo.push(snapshot()); restore(s.undo.pop()); s.held = null; saveDraft(); draw(); };
  const redo = () => { if (!s.redo.length) return; s.undo.push(snapshot()); restore(s.redo.pop()); s.held = null; saveDraft(); draw(); };
  let draftTimer;
  const saveDraft = () => { clearTimeout(draftTimer); draftTimer = setTimeout(() => { try { localStorage.setItem(draftKey, JSON.stringify({ ...snapshot(), at: Date.now() })); } catch {} }, 400); };
  const clearDraft = () => { clearTimeout(draftTimer); try { localStorage.removeItem(draftKey); } catch {} };
  const readDraft = () => { try { const d = JSON.parse(localStorage.getItem(draftKey) || 'null'); return d && Array.isArray(d.tiles) ? d : null; } catch { return null; } };

  // --- drawing ----------------------------------------------------------------------------------
  function drawToolbar() {
    toolbar.replaceChildren();
    if (!opts.editable) { toolbar.hidden = true; return; }
    toolbar.hidden = false;
    if (!s.editing) {
      toolbar.append(h('button', { class: 'btn', type: 'button', onclick: startEditing }, icon('edit'), opts.mode === 'home' ? 'Edit Home' : 'Edit tiles'));
      return;
    }
    const sel = s.tiles.find(t => t.tileId === s.selected);
    toolbar.append(
      h('button', { class: 'btn accent', type: 'button', onclick: () => addTile() }, icon('plus'), 'Add tile'),
      h('button', { class: 'btn', type: 'button', disabled: !sel, onclick: () => sel && editTile(sel) }, icon('edit'), 'Edit'),
      h('button', { class: 'btn', type: 'button', disabled: !sel, onclick: () => sel && removeTile(sel) }, icon('trash'), 'Remove'),
      h('span', { class: 'tg-sep' }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Undo', title: 'Undo (Ctrl+Z, LB)', disabled: !s.undo.length, onclick: undo }, icon('undo')),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Redo', title: 'Redo (Ctrl+Y, RB)', disabled: !s.redo.length, onclick: redo }, icon('redo')),
      h('span', { class: 'tg-grow' }),
      h('button', { class: 'btn ghost', type: 'button', onclick: cancelEditing }, 'Cancel'),
      h('button', { class: 'btn primary', type: 'button', disabled: s.saving, onclick: save }, s.saving ? 'Saving…' : 'Save'));
  }

  function place(el, rect) {
    el.style.gridColumn = `${rect.x + 1} / span ${rect.width}`;
    el.style.gridRow = `${rect.y + 1} / span ${rect.height}`;
  }

  function draw() {
    measure();
    drawToolbar();
    const flow = narrow();
    grid.className = `tg${s.editing ? ' editing' : ''}${flow ? ' flow' : ''}`;
    const rows = Math.max(s.editing ? bottomRow() + 3 : bottomRow(), s.editing ? 6 : 1);
    grid.style.gridTemplateRows = flow ? '' : `repeat(${rows}, var(--tg-cell))`;
    grid.replaceChildren();
    if (s.editing) {
      for (let y = 0; y < rows; y++) for (let x = 0; x < GRID.columns; x++) {
        const c = h('div', { class: 'tg-cell', 'data-x': x, 'data-y': y });
        place(c, { x, y, width: 1, height: 1 });
        c.addEventListener('click', () => { s.cursor = { x, y }; s.selected = null; draw(); });
        c.addEventListener('dblclick', () => { s.cursor = { x, y }; addTile({ x, y }); });
        grid.append(c);
      }
    }
    const ordered = [...items()].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const item of ordered) {
      const isCard = item.tileId === CARD_ID;
      const el = h('div', { class: `tg-tile${isCard ? ' tg-card' : ''}${s.selected === item.tileId ? ' selected' : ''}${s.held?.id === item.tileId ? ' held' : ''}`,
        role: 'gridcell', 'data-id': item.tileId, tabindex: s.editing ? '-1' : null });
      if (flow) { el.style.gridColumn = `span ${isCard || item.width >= 4 ? 4 : 2}`; el.style.minHeight = `${Math.min(item.height, 3) * 64}px`; }
      else place(el, item);
      el.append(isCard ? (opts.renderCard?.() ?? h('div')) : tileFace(item, s.widgets[item.tileId]));
      if (s.editing) wireEditing(el, item, isCard);
      grid.append(el);
    }
    if (s.editing) {
      const cur = h('div', { class: `tg-cursor${s.held ? (s.held.resizing ? ' resizing' : ' holding') : ''}`, 'aria-hidden': 'true' });
      const target = s.held ? items().find(t => t.tileId === s.held.id) : null;
      place(cur, target ?? { ...s.cursor, width: 1, height: 1 });
      grid.append(cur);
      hint.hidden = false;
      hint.textContent = s.held
        ? (s.held.resizing ? 'Resizing: arrows / D-pad change the size. Enter or A to confirm, Esc or B to cancel.' : 'Moving: arrows / D-pad move the tile. Enter or A to drop it, Esc or B to cancel.')
        : 'Drag tiles to move them and their corner to resize. Keyboard or controller: arrows / D-pad, Enter or A to pick up or add, E or Y to edit, R or X to resize, Delete or View to remove.';
    } else hint.hidden = true;
    if (!s.editing && !items().length) grid.append(h('div', { class: 'empty tg-empty', style: { gridColumn: '1 / -1' } }, h('strong', { text: 'No tiles yet' }), opts.editable ? 'Choose Edit to add your first tile.' : 'Nothing to show here yet.'));
  }

  // --- pointer editing --------------------------------------------------------------------------
  const cellFromPoint = (clientX, clientY) => {
    const r = grid.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(grid).getPropertyValue('--tg-gap')) || 12;
    const cw = (r.width + gap) / GRID.columns;
    const rowH = parseFloat(getComputedStyle(grid).getPropertyValue('--tg-cell')) + gap;
    return { x: Math.floor((clientX - r.left) / cw), y: Math.floor((clientY - r.top) / rowH) };
  };

  function wireEditing(el, item, isCard) {
    let lastTap = 0;
    el.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('.tg-resize')) return;
      event.preventDefault();
      s.selected = isCard ? null : item.tileId;
      const start = cellFromPoint(event.clientX, event.clientY);
      const grab = { dx: start.x - item.x, dy: start.y - item.y };
      const origin = { x: item.x, y: item.y };
      let moved = false;
      el.setPointerCapture(event.pointerId);
      el.classList.add('dragging');
      const onMove = (e) => {
        const at = cellFromPoint(e.clientX, e.clientY);
        const target = items().find(t => t.tileId === item.tileId);
        const next = { ...target, x: Math.max(0, Math.min(GRID.columns - target.width, at.x - grab.dx)), y: Math.max(0, at.y - grab.dy) };
        if ((next.x !== target.x || next.y !== target.y) && valid(next, item.tileId)) {
          if (!moved) { s.undo.push({ tiles: clone(s.tiles), card: s.card ? { ...s.card } : null }); s.redo = []; moved = true; }
          setPosition(item.tileId, next.x, next.y);
          place(el, next);
          ensureRows();
        }
      };
      const onUp = () => {
        el.removeEventListener('pointermove', onMove); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp);
        el.classList.remove('dragging');
        if (moved) { saveDraft(); draw(); return; }
        const now = Date.now();
        if (!isCard && now - lastTap < 350) { editTile(s.tiles.find(t => t.tileId === item.tileId)); return; }
        lastTap = now; s.cursor = { x: origin.x, y: origin.y }; draw();
      };
      el.addEventListener('pointermove', onMove); el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp);
    });
    if (isCard) return;
    const handle = h('span', { class: 'tg-resize', title: 'Drag to resize', 'aria-hidden': 'true' });
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault(); event.stopPropagation();
      handle.setPointerCapture(event.pointerId);
      let changed = false;
      const onMove = (e) => {
        const at = cellFromPoint(e.clientX, e.clientY);
        const t = s.tiles.find(x => x.tileId === item.tileId);
        const next = { ...t, width: Math.max(GRID.minW, Math.min(GRID.maxW, at.x - t.x + 1)), height: Math.max(GRID.minH, Math.min(GRID.maxH, at.y - t.y + 1)) };
        if ((next.width !== t.width || next.height !== t.height) && valid(next, t.tileId)) {
          if (!changed) { s.undo.push(snapshot()); s.redo = []; changed = true; }
          t.width = next.width; t.height = next.height; place(el, t); ensureRows();
        }
      };
      const onUp = () => { handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); if (changed) { saveDraft(); draw(); } };
      handle.addEventListener('pointermove', onMove); handle.addEventListener('pointerup', onUp);
    });
    el.append(handle);
  }

  function ensureRows() { const rows = Math.max(bottomRow() + 3, 6); grid.style.gridTemplateRows = `repeat(${rows}, var(--tg-cell))`; }
  function setPosition(id, x, y) {
    if (id === CARD_ID) { s.card.x = x; s.card.y = y; return; }
    const t = s.tiles.find(t => t.tileId === id); t.x = x; t.y = y;
  }

  // --- keyboard and controller ------------------------------------------------------------------
  function act(action) {
    if (!s.editing) return false;
    const dirs = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    if (dirs[action]) {
      const [dx, dy] = dirs[action];
      if (s.held?.resizing) {
        const t = s.tiles.find(t => t.tileId === s.held.id);
        const next = { ...t, width: Math.max(GRID.minW, Math.min(GRID.maxW, t.width + dx)), height: Math.max(GRID.minH, Math.min(GRID.maxH, t.height + dy)) };
        if (valid(next, t.tileId)) { t.width = next.width; t.height = next.height; }
      } else if (s.held) {
        const t = items().find(t => t.tileId === s.held.id);
        const next = { ...t, x: t.x + dx, y: t.y + dy };
        if (valid(next, t.tileId)) { setPosition(t.tileId, next.x, next.y); s.cursor = { x: next.x, y: next.y }; }
      } else {
        s.cursor = { x: Math.max(0, Math.min(GRID.columns - 1, s.cursor.x + dx)), y: Math.max(0, Math.min(GRID.maxY, s.cursor.y + dy)) };
        const under = occupantAt(s.cursor.x, s.cursor.y);
        s.selected = under && under.tileId !== CARD_ID ? under.tileId : null;
      }
      draw(); scrollCursorIntoView(); return true;
    }
    if (action === 'accept') {
      if (s.held) { s.held = null; saveDraft(); draw(); return true; }
      const under = occupantAt(s.cursor.x, s.cursor.y);
      if (under) { s.undo.push(snapshot()); s.redo = []; s.held = { id: under.tileId, origin: { x: under.x, y: under.y } }; s.selected = under.tileId === CARD_ID ? null : under.tileId; draw(); }
      else addTile({ ...s.cursor });
      return true;
    }
    if (action === 'back') {
      if (s.held) { restore(s.undo.pop()); s.held = null; draw(); return true; }
      return false;
    }
    if (action === 'resize') {
      const under = s.held ? null : occupantAt(s.cursor.x, s.cursor.y);
      if (under && under.tileId !== CARD_ID) { s.undo.push(snapshot()); s.redo = []; s.held = { id: under.tileId, resizing: true }; draw(); }
      return true;
    }
    if (action === 'edit') { const t = s.tiles.find(t => t.tileId === (s.selected ?? occupantAt(s.cursor.x, s.cursor.y)?.tileId)); if (t) editTile(t); return true; }
    if (action === 'remove') { const t = s.tiles.find(t => t.tileId === s.selected); if (t) removeTile(t); return true; }
    if (action === 'undo') { undo(); return true; }
    if (action === 'redo') { redo(); return true; }
    if (action === 'save') { save(); return true; }
    return false;
  }

  function scrollCursorIntoView() { grid.querySelector('.tg-cursor')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

  const onKey = (event) => {
    if (!s.editing || document.querySelector('dialog[open]')) return;
    if (event.target.closest?.('input,textarea,select,[contenteditable]')) return;
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'accept', ' ': 'accept', Escape: 'back', r: 'resize', R: 'resize', e: 'edit', E: 'edit', Delete: 'remove', Backspace: 'remove' };
    let action = map[event.key];
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') action = event.shiftKey ? 'redo' : 'undo';
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') action = 'redo';
    if (action && act(action)) event.preventDefault();
  };
  document.addEventListener('keydown', onKey);

  // Gamepad: the browser only reports button state, so edges are detected each frame.
  const PAD = { 12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'accept', 1: 'back', 2: 'resize', 3: 'edit', 8: 'remove', 4: 'undo', 5: 'redo', 9: 'save' };
  let prev = {}, padFrame = 0, stickAt = 0;
  const pollPad = () => {
    padFrame = requestAnimationFrame(pollPad);
    if (!s.editing || document.querySelector('dialog[open]')) { prev = {}; return; }
    const pad = [...(navigator.getGamepads?.() ?? [])].find(Boolean);
    if (!pad) return;
    const now = {};
    for (const [index, action] of Object.entries(PAD)) {
      now[index] = Boolean(pad.buttons[index]?.pressed);
      if (now[index] && !prev[index]) act(action);
    }
    const [ax, ay] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0];
    if (Math.max(Math.abs(ax), Math.abs(ay)) > .6 && performance.now() - stickAt > 180) {
      stickAt = performance.now();
      act(Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up'));
    }
    prev = now;
  };
  padFrame = requestAnimationFrame(pollPad);

  // --- add / edit / remove ----------------------------------------------------------------------
  async function addTile(at) {
    if (s.tiles.length >= GRID.maxTiles) { toast(`You can have up to ${GRID.maxTiles} tiles.`); return; }
    const tile = await openTileEditor(null, at);
    if (!tile) return;
    let spot = at && valid({ ...at, width: tile.width, height: tile.height }) ? at : null;
    if (!spot && at) for (const [w, hh] of [[tile.width, tile.height], [2, 2], [2, 1], [1, 1]]) if (valid({ ...at, width: w, height: hh })) { tile.width = w; tile.height = hh; spot = at; break; }
    spot = spot ?? firstFree(tile.width, tile.height) ?? firstFree(1, 1);
    if (!spot) { toast('There is no room left on the grid.'); return; }
    record();
    s.tiles.push({ ...tile, x: spot.x, y: spot.y });
    s.selected = tile.tileId; s.cursor = { x: spot.x, y: spot.y };
    draw();
  }

  async function editTile(tile) {
    const updated = await openTileEditor(tile);
    if (!updated) return;
    record();
    const index = s.tiles.findIndex(t => t.tileId === tile.tileId);
    const candidate = { ...updated, x: tile.x, y: tile.y };
    if (!valid(candidate, tile.tileId)) { candidate.width = tile.width; candidate.height = tile.height; }
    s.tiles[index] = candidate;
    draw();
  }

  async function removeTile(tile) {
    if (!await confirmSheet('Remove this tile?', `"${tile.title || WIDGET_KINDS[tile.widget]?.label || 'Untitled tile'}" will be removed when you save. You can undo this.`, 'Remove')) return;
    record();
    s.tiles = s.tiles.filter(t => t.tileId !== tile.tileId);
    s.selected = null;
    draw();
  }

  function openTileEditor(existing, at) {
    const t = existing ? clone(existing) : blankTile();
    const kinds = opts.widgetKinds;
    const field = (label, control, help) => h('label', { class: 'field' }, label, control, help ? h('small', { text: help }) : null);
    const kindSelect = h('select', { name: 'kind' },
      h('option', { value: 'text', text: 'Text' }), h('option', { value: 'link', text: 'Link' }), h('option', { value: 'media', text: 'Picture' }), h('option', { value: 'stat', text: 'Big number' }),
      h('optgroup', { label: 'Live widgets' }, kinds.map(k => h('option', { value: `widget:${k}`, text: WIDGET_KINDS[k].label }))));
    kindSelect.value = t.widget ? `widget:${t.widget}` : t.tileType;
    const title = h('input', { name: 'title', maxlength: 80, value: t.title ?? '' });
    const body = h('textarea', { name: 'body', maxlength: 2000, rows: 4 }); body.value = t.body ?? '';
    const linkUrl = h('input', { name: 'linkUrl', type: 'url', maxlength: 500, placeholder: 'https://', value: t.linkUrl ?? '' });
    const linkLabel = h('input', { name: 'linkLabel', maxlength: 80, value: t.linkLabel ?? '' });
    const statValue = h('input', { name: 'statValue', maxlength: 80, value: t.statValue ?? '' });
    const count = h('input', { name: 'count', type: 'number', min: 1, max: 12, value: t.widgetConfig?.count ?? '' });
    const width = h('input', { name: 'width', type: 'number', min: 1, max: 6, value: t.width });
    const height = h('input', { name: 'height', type: 'number', min: 1, max: 4, value: t.height });
    const bgType = h('select', { name: 'backgroundType' }, h('option', { value: 'solid', text: 'Solid colour' }), h('option', { value: 'gradient', text: 'Gradient' }), h('option', { value: 'media', text: 'Picture' }));
    bgType.value = t.backgroundType;
    const c1 = h('input', { name: 'backgroundPrimary', type: 'color', value: t.backgroundPrimary });
    const c2 = h('input', { name: 'backgroundSecondary', type: 'color', value: t.backgroundSecondary });
    const angle = h('input', { name: 'backgroundAngle', type: 'number', min: 0, max: 360, value: t.backgroundAngle });
    const text = h('input', { name: 'textColour', type: 'color', value: t.textColour });
    const border = h('input', { name: 'borderColour', type: 'color', value: t.borderColour });
    const font = h('select', { name: 'fontFamily' }, Object.keys(FONTS).map(f => h('option', { value: f, text: f[0].toUpperCase() + f.slice(1) })));
    font.value = t.fontFamily;
    const fit = h('select', { name: 'mediaFit' }, ['cover', 'contain', 'stretch'].map(v => h('option', { value: v, text: { cover: 'Fill', contain: 'Fit', stretch: 'Stretch' }[v] })));
    fit.value = t.mediaFit;
    const overlay = h('select', { name: 'mediaOverlay' }, ['dark', 'light', 'none'].map(v => h('option', { value: v, text: { dark: 'Darken for text', light: 'Lighten for text', none: 'None' }[v] })));
    overlay.value = t.mediaOverlay;
    let media = t.backgroundMedia;
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif' });
    const mediaNote = h('small', { class: 'muted', text: media ? 'A picture is set.' : 'No picture yet.' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0]; if (!f) return;
      mediaNote.textContent = 'Preparing picture…';
      try { media = await imageToDataUrl(f); mediaNote.textContent = 'Picture ready.'; refresh(); }
      catch (e) { mediaNote.textContent = e.message; }
    });
    const preview = h('div', { class: 'tg-preview' });
    const groups = {
      text: () => [field('Title', title), field('Text', body)],
      link: () => [field('Title', title), field('Description', body), field('Link address', linkUrl), field('Button text', linkLabel)],
      media: () => [field('Caption', title, 'Optional')],
      stat: () => [field('Number or short value', statValue), field('Label', title)],
      widget: () => [field('Title', title, 'Optional; the widget name is used if empty'), field('Items shown', count, 'For list widgets, 1–12')]
    };
    const content = h('div', { class: 'stack' });
    const mediaRow = h('div', { class: 'stack' }, field('Picture', file), mediaNote, h('div', { class: 'grid-2' }, field('Fit', fit), field('Overlay', overlay)));
    const gradientRow = h('div', { class: 'grid-2' }, field('Second colour', c2), field('Angle', angle));
    function current() {
      const kind = kindSelect.value;
      const widget = kind.startsWith('widget:') ? kind.slice(7) : null;
      const tileType = widget ? 'text' : kind;
      const backgroundType = tileType === 'media' ? 'media' : bgType.value;
      const n = Number(count.value);
      return { ...t, tileType, widget, widgetConfig: widget && WIDGET_KINDS[widget]?.list && n ? { count: Math.max(1, Math.min(12, n)) } : {},
        title: title.value.trim() || null, body: tileType === 'text' || tileType === 'link' ? (body.value.trim() || null) : null,
        linkUrl: tileType === 'link' ? linkUrl.value.trim() || null : null, linkLabel: tileType === 'link' ? linkLabel.value.trim() || null : null,
        statValue: tileType === 'stat' ? statValue.value.trim() || null : null,
        width: Math.max(1, Math.min(6, Number(width.value) || 2)), height: Math.max(1, Math.min(4, Number(height.value) || 2)),
        backgroundType, backgroundPrimary: c1.value, backgroundSecondary: c2.value, backgroundAngle: Math.max(0, Math.min(360, Number(angle.value) || 0)),
        backgroundMedia: backgroundType === 'media' ? media : null, mediaFit: fit.value, mediaOverlay: overlay.value,
        textColour: text.value, borderColour: border.value, fontFamily: font.value };
    }
    let shownGroup = null;
    function refresh() {
      const kind = kindSelect.value;
      const group = kind.startsWith('widget:') ? 'widget' : kind;
      // Only rebuild the content fields when the tile type changes, so typing never loses focus.
      if (group !== shownGroup) { content.replaceChildren(...groups[group]()); shownGroup = group; }
      const tileType = group === 'widget' ? 'text' : group;
      mediaRow.hidden = !(tileType === 'media' || bgType.value === 'media');
      gradientRow.hidden = bgType.value !== 'gradient' || tileType === 'media';
      bgType.parentElement.hidden = tileType === 'media';
      preview.replaceChildren(tileFace(current(), existing && kind === (existing.widget ? `widget:${existing.widget}` : existing.tileType) ? s.widgets[t.tileId] : null));
    }
    kindSelect.addEventListener('change', () => {
      const kind = kindSelect.value;
      if (!existing && kind.startsWith('widget:')) { const size = WIDGET_KINDS[kind.slice(7)]?.size; if (size) { width.value = size[0]; height.value = size[1]; } }
      refresh();
    });
    const body2 = h('div', { class: 'stack' },
      field('Tile type', kindSelect), content,
      h('div', { class: 'grid-2' }, field('Width (1–6)', width), field('Height (1–4)', height)),
      h('details', { class: 'tg-look' }, h('summary', { text: 'Look' }),
        h('div', { class: 'stack' }, field('Background', bgType), h('div', { class: 'grid-2' }, field('Colour', c1), field('Text colour', text)), gradientRow, mediaRow,
          h('div', { class: 'grid-2' }, field('Border colour', border), field('Font', font)))),
      h('div', {}, h('p', { class: 'eyebrow', text: 'Preview' }), preview));
    body2.addEventListener('input', refresh);
    body2.addEventListener('change', refresh);
    refresh();
    return sheet({ title: existing ? 'Edit tile' : 'Add a tile', body: body2, submitLabel: existing ? 'Apply' : 'Add tile', onSubmit: () => {
      const tile = current();
      if (tile.tileType === 'link' && !/^https?:\/\//i.test(tile.linkUrl ?? '')) throw new Error('Enter a link address starting with https://');
      if (tile.tileType === 'media' && !tile.backgroundMedia) throw new Error('Choose a picture for this tile.');
      if (tile.tileType === 'stat' && !tile.statValue) throw new Error('Enter the number or value to show.');
      if (tile.backgroundType === 'media' && !tile.backgroundMedia) throw new Error('Choose a picture, or pick a colour background.');
      return tile;
    } });
  }

  // --- edit session -----------------------------------------------------------------------------
  function startEditing() {
    s.saved = snapshot(); s.undo = []; s.redo = []; s.editing = true; s.held = null;
    s.cursor = { x: 0, y: 0 }; s.selected = null;
    const draft = readDraft();
    if (draft && JSON.stringify({ tiles: draft.tiles, card: draft.card }) !== JSON.stringify(s.saved)) {
      banner.hidden = false;
      banner.replaceChildren(h('span', {}, h('strong', { text: 'Unsaved changes found. ' }), `From ${new Date(draft.at).toLocaleString()}.`),
        h('button', { class: 'btn sm', type: 'button', text: 'Restore', onclick: () => { record(); restore(draft); banner.hidden = true; draw(); } }),
        h('button', { class: 'btn sm ghost', type: 'button', text: 'Discard', onclick: () => { clearDraft(); banner.hidden = true; } }));
    }
    draw();
    grid.scrollIntoView({ block: 'nearest' });
  }

  async function cancelEditing() {
    if (s.undo.length && !await confirmSheet('Discard changes?', 'Your tile changes since you started editing will be lost.', 'Discard')) return;
    restore(s.saved); s.editing = false; s.held = null; banner.hidden = true; clearDraft(); draw();
  }

  async function save() {
    if (s.saving) return;
    s.saving = true; drawToolbar();
    try {
      const result = await opts.onSave({ tiles: clone(s.tiles), card: s.card ? { ...s.card } : null });
      s.tiles = clone(result.tiles ?? s.tiles); s.widgets = result.widgets ?? s.widgets; if (result.card) s.card = { ...result.card };
      s.editing = false; s.held = null; banner.hidden = true; clearDraft();
      toast('Saved');
    } catch (error) { toast(error.message); }
    finally { s.saving = false; draw(); }
  }

  draw();
  return {
    setData({ tiles, widgets, card }) { if (s.editing) return; s.tiles = clone(tiles ?? []); s.widgets = widgets ?? {}; s.card = card ? { ...card } : s.card; draw(); },
    get editing() { return s.editing; },
    destroy() { document.removeEventListener('keydown', onKey); cancelAnimationFrame(padFrame); resizeObserver.disconnect(); clearTimeout(draftTimer); }
  };
}

/** Shrinks a chosen picture to fit the 1.4 MB per-tile limit. */
async function imageToDataUrl(file) {
  if (file.type === 'image/gif' && file.size <= 1_000_000) return readAsDataUrl(file);
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("That picture couldn't be read. Try a PNG or JPEG."); });
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.86, 0.75, 0.62, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length * 0.75 < 1_300_000) return url;
  }
  throw new Error('That picture is too large, even after shrinking. Try a smaller one.');
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error("That picture couldn't be read.")); r.readAsDataURL(file); });
}
