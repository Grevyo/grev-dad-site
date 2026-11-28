// Home: your own tile dashboard. Same engine and tile format as profiles, plus Home-only widgets.
import { api } from '../api.js';
import { h, icon } from '../ui.js';
import { createTileGrid } from '../tiles.js';
import { HOME_WIDGETS } from '../widgets.js';

export async function render(container, ctx) {
  const { user, grevHome } = ctx.session;
  document.title = 'Home · Grev.dad';
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const host = h('div', {}, h('div', { class: 'empty', text: 'Loading your tiles…' }));
  container.append(
    h('header', { class: 'page-head' },
      h('div', {}, h('p', { class: 'eyebrow', text: 'Home' }), h('h1', { text: `${greeting}, ${user.displayName}` })),
      grevHome.linked ? null : h('a', { class: 'btn accent', href: '/grev-home' }, icon('console'), 'Link Grev Home')),
    host);

  const data = await api('/api/v2/home');
  const grid = createTileGrid({
    host, userId: user.id, mode: 'home', editable: true, tiles: data.tiles, widgets: data.widgets, card: null, widgetKinds: HOME_WIDGETS,
    onSave: async ({ tiles }) => api('/api/v2/home', { method: 'PUT', body: { tiles } })
  });
  // Live widgets (friends online, consoles) refresh in the background while you're not editing.
  const timer = setInterval(async () => {
    if (document.hidden || grid.editing) return;
    try { const fresh = await api('/api/v2/home'); grid.setData(fresh); } catch {}
  }, 60000);
  return () => { clearInterval(timer); grid.destroy(); };
}
