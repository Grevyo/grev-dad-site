// Site-wide motion: reveal content as it scrolls into view (with a stagger), and count numbers up.
const REVEAL = '.panel, .list-item, .steps li, .stat, .gh-card, .w-list li, .empty';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  let batch = 0;
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target;
    el.style.setProperty('--i', String(Math.min(batch++, 10)));
    el.classList.add('in');
    el.querySelectorAll('[data-count]').forEach(countUp);
    if (el.matches('[data-count]')) countUp(el);
    observer.unobserve(el);
  }
}, { rootMargin: '0px 0px -40px 0px' }) : null;

function prepare(root) {
  if (reduced || !observer) { root.querySelectorAll?.('[data-count]').forEach(countUp); return; }
  const found = root.matches?.(REVEAL) ? [root, ...root.querySelectorAll(REVEAL)] : [...(root.querySelectorAll?.(REVEAL) ?? [])];
  for (const el of found) {
    if (el.classList.contains('rv') || el.closest('.tg, dialog, .menu, [data-no-motion]')) continue;
    el.classList.add('rv');
    observer.observe(el);
  }
}

/** Animate an element's number from 0 to data-count, formatted by data-format (number|duration|bytes). */
export function countUp(el) {
  if (el.dataset.counted) return;
  el.dataset.counted = '1';
  const target = Number(el.dataset.count) || 0;
  const format = FORMATS[el.dataset.format] ?? FORMATS.number;
  if (reduced || target === 0) { el.textContent = format(target); return; }
  const start = performance.now(), length = 900;
  const step = (now) => {
    const t = Math.min(1, (now - start) / length);
    el.textContent = format(target * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const FORMATS = {
  number: (v) => Math.round(v).toLocaleString(),
  duration: (v) => { const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m`; },
  bytes: (v) => v < 1024 * 1024 ? `${Math.round(v / 1024)} KB` : `${(v / 1024 / 1024).toFixed(1)} MB`
};

/** Show final numbers straight away (used when a page refreshes its data in place). */
export function settle(root) {
  root.querySelectorAll('[data-count]').forEach(el => {
    el.dataset.counted = '1';
    el.textContent = (FORMATS[el.dataset.format] ?? FORMATS.number)(Number(el.dataset.count) || 0);
  });
}

/** Watch a page's container: anything added later (lists that load after the page) reveals too. */
export function animateView(view) {
  prepare(view);
  const mo = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) prepare(node);
  });
  mo.observe(view, { childList: true, subtree: true });
  return () => mo.disconnect();
}
