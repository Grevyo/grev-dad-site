// DOM helpers shared by every page.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const ICONS = {
  home: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  friends: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 14.5c3 0 6 1.5 6 4.5"/>',
  console: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  admin: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  send: '<path d="M3 11 21 3l-8 18-2-8z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  undo: '<path d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>',
  redo: '<path d="m15 7 5 5-5 5M20 12H9a5 5 0 0 0 0 10h2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z"/>'
};

export function icon(name, cls = 'ico') {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ''}</svg>`;
  return wrap.firstElementChild;
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
}

export function avatar(person, size = '') {
  const el = h('span', { class: `avatar ${size}`.trim(), 'aria-hidden': 'true' });
  if (person?.avatarMedia) el.append(h('img', { src: person.avatarMedia, alt: '' }));
  else el.textContent = initials(person?.displayName || person?.username);
  return el;
}

let toastTimer;
export function toast(message) {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: 'toast', role: 'status', text: message });
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

export function ago(seconds) {
  if (!seconds) return 'never';
  const diff = Math.max(0, Date.now() / 1000 - seconds);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} days ago`;
  return new Date(seconds * 1000).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export function duration(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(s / 3600), minutes = Math.round((s % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function bytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
  return `${(v / 1024 / 1024).toFixed(1)} MB`;
}

/** A modal sheet. Resolves with what the caller's onSubmit returns, or null if dismissed. */
export function sheet({ title, body, submitLabel = 'Save', cancelLabel = 'Cancel', danger = false, onSubmit }) {
  return new Promise(resolve => {
    const msg = h('p', { class: 'msg bad', role: 'alert' });
    const submit = h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'submit', text: submitLabel });
    const form = h('form', { method: 'dialog', class: 'sheet-form' },
      h('div', { class: 'sheet-head' }, h('h2', { text: title }), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('close'))),
      h('div', { class: 'sheet-body' }, body, msg),
      h('div', { class: 'sheet-foot' }, h('button', { class: 'btn ghost', type: 'button', text: cancelLabel, onclick: () => dialog.close() }), submit));
    const dialog = h('dialog', { class: 'sheet' }, form);
    let result = null;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true; msg.textContent = '';
      try { result = onSubmit ? await onSubmit(new FormData(form)) : true; dialog.close(); }
      catch (error) { msg.textContent = error.message; submit.disabled = false; }
    });
    dialog.addEventListener('close', () => { dialog.remove(); resolve(result); });
    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector('input,textarea,select,button[type=submit]')?.focus();
  });
}

export function confirmSheet(title, text, label = 'Confirm', danger = true) {
  return sheet({ title, body: h('p', { class: 'muted', text }), submitLabel: label, danger });
}
