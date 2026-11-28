// grev.dad v2 app shell: top bar, phone bottom bar and a small client router for the five sections.
import { api } from './api.js';
import { h, icon, avatar, toast } from './ui.js';

const ROUTES = [
  { pattern: /^\/home$/, section: 'home', load: () => import('./pages/home.js') },
  { pattern: /^\/profile\/([^/]+)$/, section: 'profile', load: () => import('./pages/profile.js') },
  { pattern: /^\/friends(?:\/([0-9a-f-]{36}))?$/i, section: 'friends', load: () => import('./pages/friends.js') },
  { pattern: /^\/grev-home$/, section: 'grev-home', load: () => import('./pages/grevhome.js') },
  { pattern: /^\/settings$/, section: 'settings', load: () => import('./pages/settings.js') },
  { pattern: /^\/admin$/, section: 'admin', load: () => import('./pages/admin.js') }
];

const state = { session: null, cleanup: null, renderToken: 0 };
const top = document.getElementById('top');
const bottom = document.getElementById('bottom-nav');
const page = document.getElementById('page');

const sections = () => [
  { id: 'home', label: 'Home', href: '/home', icon: 'home' },
  { id: 'profile', label: 'Profile', href: `/profile/${encodeURIComponent(state.session.user.username)}`, icon: 'profile' },
  { id: 'friends', label: 'Friends', href: '/friends', icon: 'friends', count: state.session.counts.friendRequests + state.session.counts.unreadMessages },
  { id: 'grev-home', label: 'Grev Home', href: '/grev-home', icon: 'console' }
];

function navLink(item, active) {
  const a = h('a', { href: item.href, 'aria-current': active === item.id ? 'page' : null }, icon(item.icon), h('span', { text: item.label }));
  if (item.count) a.append(h('span', { class: 'nav-count', 'aria-label': `${item.count} new`, text: item.count > 99 ? '99+' : item.count }));
  return a;
}

let menuOpen = null;
function closeMenus() { menuOpen?.remove(); menuOpen = null; top.querySelectorAll('[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false')); }

function openMenu(button, build) {
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  closeMenus();
  if (wasOpen) return;
  menuOpen = build();
  button.setAttribute('aria-expanded', 'true');
  top.append(menuOpen);
  menuOpen.querySelector('a,button')?.focus();
}

function accountMenu() {
  const { user } = state.session;
  return h('div', { class: 'menu', role: 'menu' },
    h('div', { class: 'who' }, h('strong', { text: user.displayName }), `@${user.username}`),
    h('a', { href: `/profile/${encodeURIComponent(user.username)}`, role: 'menuitem' }, icon('profile'), 'My profile'),
    h('a', { href: '/settings', role: 'menuitem' }, icon('settings'), 'Settings'),
    user.isAdmin ? h('a', { href: '/admin', role: 'menuitem' }, icon('admin'), 'Admin') : null,
    h('hr'),
    h('button', { type: 'button', role: 'menuitem', onclick: logOut }, icon('logout'), 'Log out'));
}

function notificationsMenu() {
  const { counts, grevHome } = state.session;
  const items = [];
  if (counts.friendRequests) items.push(h('a', { href: '/friends?tab=requests', role: 'menuitem' }, icon('friends'), `${counts.friendRequests} friend request${counts.friendRequests === 1 ? '' : 's'}`));
  if (counts.unreadMessages) items.push(h('a', { href: '/friends?tab=messages', role: 'menuitem' }, icon('send'), `${counts.unreadMessages} unread message${counts.unreadMessages === 1 ? '' : 's'}`));
  if (!grevHome.linked) items.push(h('a', { href: '/grev-home', role: 'menuitem' }, icon('console'), 'Link Grev Home to your account'));
  if (!items.length) items.push(h('div', { class: 'who' }, "You're all caught up."));
  return h('div', { class: 'menu', role: 'menu', style: { right: 'calc(var(--gutter) + 56px)' } }, ...items);
}

function renderShell(active) {
  const { user, counts } = state.session;
  const total = counts.friendRequests + counts.unreadMessages;
  const bell = h('button', { class: 'icon-btn', type: 'button', 'aria-label': total ? `Notifications, ${total} new` : 'Notifications', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('bell'));
  if (total || !state.session.grevHome.linked) bell.append(h('span', { class: 'nav-count', text: total || '!' }));
  bell.addEventListener('click', (e) => { e.stopPropagation(); openMenu(bell, notificationsMenu); });
  const me = h('button', { class: 'menu-btn', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': 'Account menu' }, avatar(user), h('span', { class: 'name', text: user.displayName }));
  me.addEventListener('click', (e) => { e.stopPropagation(); openMenu(me, accountMenu); });
  top.replaceChildren(
    h('a', { class: 'top-brand', href: '/home', 'aria-label': 'Grev.dad home' }, h('img', { src: '/grev-dad-logo-full.png', alt: 'Grev.dad', width: 120, height: 40 })),
    h('nav', { class: 'top-nav', 'aria-label': 'Sections' }, sections().map(item => navLink(item, active))),
    h('div', { class: 'top-actions' }, bell, me));
  bottom.replaceChildren(...sections().map(item => navLink(item, active)));
}

async function logOut() {
  try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch {}
  location.assign('/login');
}

export async function refreshSession() {
  state.session = await api('/api/v2/session');
  renderShell(currentRoute()?.route.section);
  return state.session;
}

function currentRoute() {
  for (const route of ROUTES) {
    const match = location.pathname.match(route.pattern);
    if (match) return { route, params: match.slice(1) };
  }
  return null;
}

export function navigate(href, { replace = false } = {}) {
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || !ROUTES.some(r => r.pattern.test(url.pathname))) { location.assign(url.href); return; }
  if (url.pathname + url.search !== location.pathname + location.search) history[replace ? 'replaceState' : 'pushState']({}, '', url.pathname + url.search + url.hash);
  render();
}

async function render() {
  const token = ++state.renderToken;
  closeMenus();
  const found = currentRoute();
  if (!found) { location.assign('/home'); return; }
  renderShell(found.route.section);
  if (typeof state.cleanup === 'function') { try { state.cleanup(); } catch {} }
  state.cleanup = null;
  try {
    const module = await found.route.load();
    if (token !== state.renderToken) return;
    page.replaceChildren();
    page.style.animation = 'none'; void page.offsetWidth; page.style.animation = '';
    state.cleanup = await module.render(page, { session: state.session, params: found.params, query: new URLSearchParams(location.search), navigate, refreshSession, toast });
    if (token === state.renderToken) page.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  } catch (error) {
    console.error(error);
    if (token !== state.renderToken) return;
    page.replaceChildren(h('div', { class: 'panel raised stack', style: { maxWidth: '560px' } },
      h('p', { class: 'eyebrow', text: 'Something went wrong' }), h('h1', { text: "This page didn't load" }),
      h('p', { class: 'muted', text: error.message || 'Please try again.' }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', text: 'Try again', onclick: render }))));
  }
}

// Internal links move between sections without reloading the page.
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('a[href]');
  if (!link || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || !ROUTES.some(r => r.pattern.test(url.pathname))) return;
  event.preventDefault();
  navigate(url.href);
});
document.addEventListener('click', (event) => { if (menuOpen && !menuOpen.contains(event.target)) closeMenus(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && menuOpen) closeMenus(); });
addEventListener('popstate', render);

(async () => {
  try { await refreshSession(); }
  catch (error) { page.replaceChildren(h('div', { class: 'panel', text: error.message })); return; }
  render();
  // Keep the friend request and message counts current.
  setInterval(() => { if (!document.hidden) refreshSession().catch(() => {}); }, 60000);
})();
