// Grev Home: a dashboard for the connection between this account and Grev Home — link status,
// linked PCs, play activity, what's synced, cloud saves, and approving a new console.
import { api } from '../api.js';
import { h, icon, ago, duration, bytes, toast, confirmSheet, avatar } from '../ui.js';
import { settle } from '../motion.js';

export async function render(container, ctx) {
  document.title = 'Grev Home · Grev.dad';
  const code = (ctx.query.get('code') || '').trim().toUpperCase();
  container.append(
    h('header', { class: 'page-head' }, h('div', {}, h('p', { class: 'eyebrow', text: 'Grev Home' }), h('h1', { text: 'Your Grev Home connection' })),
      h('a', { class: 'btn accent', href: '/download/grev-home' }, icon('download'), 'Download for Windows')),
    h('div', { class: 'loading', 'aria-label': 'Loading' }));
  const body = h('div', { class: 'stack gh' });
  let drawn = false;
  const draw = async () => {
    const data = await api('/api/v2/grev-home');
    const nodes = layout(data, ctx, code, draw);
    // The first draw animates in; refreshes after that update in place without replaying it.
    if (drawn) { body.dataset.noMotion = ''; nodes.forEach(settle); }
    body.replaceChildren(...nodes);
    drawn = true;
  };
  await draw();
  container.querySelector('.loading').replaceWith(body);
  // Keep the live parts (online state, last seen) fresh while the page is open.
  const timer = setInterval(() => { if (!document.hidden && !body.querySelector('input:focus, .gh-request')) draw().catch(() => {}); }, 30000);
  return () => clearInterval(timer);
}

function layout(data, ctx, code, redraw) {
  const approval = approvalPanel(code, ctx, redraw, data.linked);
  if (!data.linked) return [hero(data, ctx), approval, setupGuide()];
  return [
    hero(data, ctx),
    code ? approval : null,
    statCards(data),
    h('div', { class: 'grid-2' }, activityChart(data.chart), syncPanel(data)),
    h('div', { class: 'grid-2' }, topGames(data.topGames), recentSessions(data.recentSessions)),
    devicesPanel(data, ctx, redraw),
    code ? null : approval
  ].filter(Boolean);
}

// --- connection hero -----------------------------------------------------------------------------

function connectionState(data) {
  if (!data.linked) return { key: 'off', label: 'Not linked', detail: 'Link Grev Home to connect this account.' };
  const live = data.presence.online || data.devices.some(d => d.online);
  if (live) return { key: 'live', label: 'Connected', detail: data.presence.playing ? `Playing ${data.presence.playing}` : 'Grev Home is online now' };
  return { key: 'idle', label: 'Linked', detail: `Grev Home last seen ${ago(data.link.lastSeenAt ?? data.devices[0]?.lastUsedAt)}` };
}

function hero(data, ctx) {
  const state = connectionState(data);
  const { user } = ctx.session;
  const pcName = data.devices.find(d => d.online)?.deviceName || data.devices[0]?.deviceName || 'Your PC';
  return h('section', { class: `gh-hero state-${state.key}`, 'aria-label': 'Connection status' },
    h('div', { class: 'gh-node' },
      h('div', { class: 'gh-node-icon' }, h('img', { src: '/grev-home-logo.png', alt: '' })),
      h('strong', { text: 'Grev Home' }),
      h('span', { text: data.linked ? `${data.link.localDisplayName} · ${pcName}` : 'Not linked yet' })),
    h('div', { class: 'gh-link', 'aria-hidden': 'true' },
      h('div', { class: 'gh-line' }, h('i'), h('i'), h('i'), h('i')),
      h('div', { class: 'gh-status' }, h('span', { class: 'gh-status-dot' }), state.label),
      h('small', { text: state.detail })),
    h('div', { class: 'gh-node' },
      h('div', { class: 'gh-node-icon account' }, avatar(user, 'lg')),
      h('strong', { text: 'Grev.dad' }),
      h('span', { text: `@${user.username}` })),
    data.linked ? h('div', { class: 'gh-meta' },
      chip('GrevID', data.link.grevId), chip('Linked', new Date(data.link.linkedAt * 1000).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })),
      chip('PCs', `${data.devices.filter(d => d.online).length} online of ${data.devices.length}`)) : null);
}

const chip = (label, value) => h('span', { class: 'gh-chip' }, h('small', { text: label }), value);

// --- numbers -------------------------------------------------------------------------------------

function statCards(data) {
  const card = (label, value, format, sub, iconName) => h('div', { class: 'panel stat gh-stat' },
    h('span', { class: 'gh-stat-icon' }, icon(iconName)),
    h('span', { class: 'muted small', text: label }),
    h('strong', { 'data-count': value, 'data-format': format, text: '0' }),
    sub ? h('span', { class: 'muted small', text: sub }) : null);
  return h('div', { class: 'stats-row' },
    card('Play time', data.stats.totalSeconds, 'duration', 'tracked by Grev Home', 'console'),
    card('Sessions', data.stats.sessions, 'number', 'games launched', 'home'),
    card('Games', data.stats.games, 'number', 'different games played', 'profile'),
    card('Friends online', data.friends.online, 'number', `of ${data.friends.total} friend${data.friends.total === 1 ? '' : 's'}`, 'friends'),
    card('Cloud saves', data.saves.count, 'number', data.saves.count ? bytes(data.saves.totalBytes) : (data.saves.available ? 'none yet' : 'coming soon'), 'cloud'));
}

function activityChart(days) {
  const max = Math.max(...days.map(d => d.seconds), 0);
  const total = days.reduce((sum, d) => sum + d.seconds, 0);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const tip = h('div', { class: 'gh-tip', hidden: true });
  const bars = h('div', { class: 'gh-bars', role: 'img', 'aria-label': `Play time over the last 14 days, ${duration(total)} in total` },
    days.map((d, i) => {
      const date = new Date(d.date * 1000);
      const label = date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
      const bar = h('div', { class: 'gh-bar-slot', tabindex: '0', 'aria-label': `${label}: ${d.seconds ? duration(d.seconds) : 'no play'}` },
        h('div', { class: `gh-bar${d.seconds ? '' : ' none'}`, style: { height: `${max ? Math.max(3, (d.seconds / max) * 100) : 3}%`, animationDelay: `${i * 35}ms` } }),
        h('span', { class: 'gh-day', text: i === days.length - 1 ? 'Today' : date.toLocaleDateString([], { weekday: 'narrow' }) }));
      const show = () => { tip.hidden = false; tip.replaceChildren(h('strong', { text: label }), h('span', { text: d.seconds ? `${duration(d.seconds)} · ${d.sessions} session${d.sessions === 1 ? '' : 's'}` : 'No play' }));
        tip.style.left = `${((i + .5) / days.length) * 100}%`;
        // Keep the tooltip inside the chart at either end.
        tip.style.transform = `translate(${i < 2 ? '-15%' : i > days.length - 3 ? '-85%' : '-50%'}, -6px)`; };
      bar.addEventListener('mouseenter', show); bar.addEventListener('focus', show);
      bar.addEventListener('mouseleave', () => { tip.hidden = true; }); bar.addEventListener('blur', () => { tip.hidden = true; });
      return bar;
    }));
  const table = h('table', { class: 'sr-only' }, h('caption', { text: 'Daily play time' }),
    h('tbody', {}, days.map(d => h('tr', {}, h('th', { text: new Date(d.date * 1000).toLocaleDateString() }), h('td', { text: duration(d.seconds) })))));
  return h('section', { class: 'panel gh-chart' },
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', { text: 'Play time' }), h('p', { text: total ? `${duration(total)} in the last 14 days` : 'No games played in the last 14 days' }))),
    h('div', { class: 'gh-plot' }, max ? h('span', { class: 'gh-max', text: duration(max) }) : null, bars, tip), table);
}

function syncPanel(data) {
  const row = (iconName, title, detail, ok) => h('div', { class: 'list-item gh-sync' },
    h('span', { class: `gh-sync-icon ${ok ? 'ok' : 'idle'}` }, icon(iconName)),
    h('div', { class: 'grow' }, h('strong', { text: title }), h('span', { text: detail })),
    h('span', { class: `badge ${ok ? 'ok' : ''}`, text: ok ? 'Synced' : 'Waiting' }));
  const { sync, saves, friends } = data;
  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', { text: 'What syncs' }), h('p', { text: 'Kept the same on grev.dad and in Grev Home.' }))),
    h('div', { class: 'list' },
      row('profile', 'Profile and tiles', sync.tilesUpdatedAt || sync.profileUpdatedAt ? `${sync.profileTiles} tile${sync.profileTiles === 1 ? '' : 's'} · updated ${ago(Math.max(sync.tilesUpdatedAt ?? 0, sync.profileUpdatedAt ?? 0))}` : 'Not changed yet', Boolean(sync.tilesUpdatedAt || sync.profileUpdatedAt)),
      row('console', 'Play time and progress', sync.progressUpdatedAt ? `Last synced ${ago(sync.progressUpdatedAt)}` : 'Syncs after your first game', Boolean(sync.progressUpdatedAt)),
      row('cloud', 'Cloud saves', !saves.available ? 'Storage is still being set up on grev.dad' : saves.count ? `${saves.count} game${saves.count === 1 ? '' : 's'} · ${bytes(saves.totalBytes)} · latest ${ago(saves.latestAt)}` : 'Turn on cloud saves for a game in Grev Home', saves.available && saves.count > 0),
      row('friends', 'Friends and messages', `Live · ${friends.online} of ${friends.total} online`, true)));
}

function topGames(games) {
  const max = Math.max(...games.map(g => g.totalSeconds), 1);
  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', { text: 'Most played' }), h('p', { text: 'All time, from Grev Home.' }))),
    games.length ? h('ol', { class: 'gh-top' }, games.map((g, i) => h('li', {},
      h('div', { class: 'gh-top-row' }, h('span', { class: 'gh-rank', text: String(i + 1) }), h('strong', { text: g.title }), h('span', { class: 'muted small', text: duration(g.totalSeconds) })),
      h('div', { class: 'gh-meter' }, h('i', { style: { width: `${(g.totalSeconds / max) * 100}%`, animationDelay: `${i * 80}ms` } })))))
      : h('p', { class: 'muted', text: 'Play something in Grev Home and it will show up here.' }));
}

function recentSessions(sessions) {
  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', { text: 'Recent sessions' }), h('p', { text: 'Your latest games on Grev Home.' }))),
    sessions.length ? h('ol', { class: 'gh-timeline' }, sessions.map(s => h('li', {},
      h('strong', { text: s.title }),
      h('span', { class: 'muted small', text: `${ago(s.endedAt)} · ${duration(s.durationSeconds)}` }),
      s.failed ? h('span', { class: 'badge warn', text: "Didn't start" }) : null)))
      : h('p', { class: 'muted', text: 'No sessions yet.' }));
}

// --- linked PCs ----------------------------------------------------------------------------------

function devicesPanel(data, ctx, redraw) {
  const unlink = h('button', { class: 'btn sm danger', type: 'button', text: 'Unlink Grev Home' });
  unlink.addEventListener('click', async () => {
    if (!await confirmSheet('Unlink Grev Home?', 'Every PC will be signed out of this account. Your profile, friends and saves stay on grev.dad.', 'Unlink')) return;
    try { await api('/api/grev-home/browser/link', { method: 'DELETE' }); toast('Grev Home unlinked'); await ctx.refreshSession(); redraw(); } catch (e) { toast(e.message); }
  });
  return h('section', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', { text: 'Linked PCs' }), h('p', { text: `Local profile ${data.link.localDisplayName} (@${data.link.localUsername})` })), unlink),
    data.devices.length ? h('div', { class: 'gh-devices' }, data.devices.map(d => {
      const out = h('button', { class: 'btn sm ghost', type: 'button', text: 'Sign out' });
      out.addEventListener('click', async () => {
        if (!await confirmSheet(`Sign out ${d.deviceName || 'this PC'}?`, 'That PC will need a new link code to sign back in.', 'Sign out')) return;
        try { await api(`/api/grev-home/browser/devices/${d.id}`, { method: 'DELETE' }); toast('PC signed out'); redraw(); } catch (e) { toast(e.message); }
      });
      return h('div', { class: `gh-card${d.online ? ' online' : ''}` },
        h('div', { class: 'gh-card-icon' }, icon('console')),
        h('div', { class: 'grow' }, h('strong', { text: d.deviceName || 'Windows PC' }),
          h('span', { class: 'gh-online' }, h('span', { class: `dot${d.online ? ' on' : ''}` }), d.online ? 'Online now' : `Last used ${ago(d.lastUsedAt)}`),
          h('span', { class: 'muted small', text: `Linked ${ago(d.linkedAt)}` })),
        out);
    })) : h('p', { class: 'muted', text: 'No PCs are signed in right now. Link one with a code below.' }));
}

// --- approving a console -------------------------------------------------------------------------

function approvalPanel(initialCode, ctx, onLinked, linked) {
  const input = h('input', { name: 'code', placeholder: 'XXXX-XXXX', maxlength: 16, autocomplete: 'off', spellcheck: 'false', value: initialCode, class: 'gh-code-input' });
  const result = h('div', { class: 'stack' });
  const form = h('form', { class: 'row', style: { alignItems: 'end' } }, h('label', { class: 'field', style: { flex: '1', minWidth: '200px' } }, 'Link code from Grev Home', input), h('button', { class: 'btn primary', type: 'submit', text: 'Check code' }));
  const panel = h('section', { class: `panel${initialCode || !linked ? ' raised gh-approve' : ''} stack` },
    h('div', {}, h('h2', { text: linked ? 'Link another PC' : 'Link a console' }), h('p', { class: 'muted small', text: 'When you link grev.dad in Grev Home it shows a code. Enter that code here to approve it.' })),
    form, result);
  const check = async () => {
    const value = input.value.trim().toUpperCase();
    result.replaceChildren();
    if (!value) return;
    try {
      const { request } = await api(`/api/grev-home/link/request?code=${encodeURIComponent(value)}`);
      if (request.status !== 'pending') {
        result.append(h('p', { class: `msg ${request.status === 'approved' ? 'ok' : 'bad'}`, text: request.status === 'approved' ? (request.approvedByCurrentUser ? 'This console is already linked to your account.' : 'This code was approved by another account.') : 'This link request was denied.' }));
        return;
      }
      const decide = async (decision) => {
        try {
          await api('/api/grev-home/link/approve', { method: 'POST', body: { userCode: value, decision } });
          result.replaceChildren(h('p', { class: `msg ${decision === 'approve' ? 'ok' : ''}`, text: decision === 'approve' ? 'Linked. Grev Home will finish signing in within a few seconds.' : 'Request denied. Grev Home will not be linked.' }));
          if (decision === 'approve') { toast('Grev Home linked'); history.replaceState({}, '', '/grev-home'); await ctx.refreshSession(); setTimeout(onLinked, 1200); }
        } catch (error) { toast(error.message); }
      };
      result.append(h('div', { class: 'gh-request' },
        h('img', { src: '/grev-home-logo.png', alt: '', width: 48, height: 48 }),
        h('div', { class: 'grow' }, h('strong', { text: `${request.localDisplayName} on ${request.deviceName || 'a Windows PC'}` }),
          h('span', { class: 'muted small', text: `Local profile @${request.localUsername} · requested ${ago(request.createdAt)} · expires in ${Math.max(1, Math.round((request.expiresAt - Date.now() / 1000) / 60))} min` })),
        h('button', { class: 'btn ghost', type: 'button', text: 'Deny', onclick: () => decide('deny') }),
        h('button', { class: 'btn accent', type: 'button', text: 'Approve', onclick: () => decide('approve') })),
        h('p', { class: 'muted small', text: 'Only approve a code you can see on your own screen right now.' }));
    } catch (error) { result.append(h('p', { class: 'msg bad', text: error.message })); }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); check(); });
  if (initialCode) check();
  return panel;
}

function setupGuide() {
  const step = (n, title, text) => h('li', {}, h('span', { class: 'gh-step-n', text: String(n) }), h('strong', { text: title }), h('span', { class: 'muted', text }));
  return h('section', { class: 'panel stack' },
    h('div', {}, h('h2', { text: 'Setting up Grev Home' }), h('p', { class: 'muted small', text: 'A controller-first console for your Windows PC.' })),
    h('ol', { class: 'steps' },
      step(1, 'Install', 'Download GrevHomeSetup.exe above and run it. Grev Home updates itself after that.'),
      step(2, 'Create a local profile', 'Pick a name and picture with your controller on first launch.'),
      step(3, 'Link this account', 'Choose to link grev.dad in Grev Home, then approve its code on this page.'),
      step(4, 'Add games and emulators', 'Use the Grev Store to install emulators, then add your games.')));
}
