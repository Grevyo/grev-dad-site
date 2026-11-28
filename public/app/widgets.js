// Live widget tiles, shared by Home and Profile. Each renderer gets the server's resolved data.
import { h, avatar, ago, duration, bytes, icon } from './ui.js';

export const WIDGET_KINDS = {
  'recent-games': { label: 'Recent games', description: 'Last games played in Grev Home.', list: true, size: [4, 2] },
  'game-activity': { label: 'Game activity', description: 'Now playing and latest sessions.', list: true, size: [4, 2] },
  'most-played': { label: 'Most played', description: 'Games ranked by play time.', list: true, size: [3, 2] },
  'favourite-games': { label: 'Favourite games', description: 'Games you starred in Grev Home.', list: true, size: [3, 2] },
  'best-friends': { label: 'Best friends', description: 'The friends you picked, with who is online.', list: true, size: [4, 2] },
  'bio': { label: 'Bio', description: 'Your headline and bio.', size: [3, 2] },
  'stats': { label: 'Stats', description: 'Level, XP, play time, sessions and games.', size: [3, 2] },
  'achievements': { label: 'Achievements', description: 'Your latest grev.dad achievements.', list: true, size: [3, 2] },
  'retroachievements': { label: 'RetroAchievements', description: 'Points, rank and recent unlocks.', list: true, size: [4, 2] },
  'friends-online': { label: 'Friends online', description: "Who's online and what they're playing.", list: true, size: [3, 2], home: true },
  'grev-home': { label: 'Get Grev Home', description: 'Download Grev Home for Windows.', size: [4, 2], home: true },
  'cloud-saves': { label: 'Cloud saves', description: 'Your latest saves backed up from Grev Home.', list: true, size: [3, 2], home: true },
  'consoles': { label: 'Consoles', description: 'Your linked Grev Home PCs.', size: [2, 2], home: true },
  'clock': { label: 'Clock', description: 'The time and date.', size: [2, 1], home: true }
};

export const PROFILE_WIDGETS = Object.keys(WIDGET_KINDS).filter(k => !WIDGET_KINDS[k].home);
export const HOME_WIDGETS = Object.keys(WIDGET_KINDS);

const list = (items, row, empty) => items?.length ? h('ul', { class: 'w-list' }, items.map(item => h('li', {}, row(item)))) : h('p', { class: 'w-empty', text: empty });
const line = (title, sub) => [h('strong', { text: title }), sub ? h('span', { text: sub }) : null];

const RENDERERS = {
  'recent-games': d => list(d.items, g => line(g.title, `${ago(g.lastPlayedAt)} · ${duration(g.totalSeconds)}`), 'No games played yet.'),
  'most-played': d => list(d.items, g => line(g.title, `${duration(g.totalSeconds)} · ${g.sessions} session${g.sessions === 1 ? '' : 's'}`), 'No games played yet.'),
  'game-activity': d => h('div', { class: 'w-stack' },
    d.nowPlaying ? h('div', { class: 'w-now' }, h('span', { class: 'dot on' }), h('span', {}, 'Now playing ', h('strong', { text: d.nowPlaying.title }))) : null,
    list(d.sessions, s => line(s.title, `${ago(s.endedAt)} · ${duration(s.durationSeconds)}`), d.nowPlaying ? '' : 'No recent sessions.')),
  'favourite-games': d => list(d.items, f => line(f.title, f.platform), 'Star games in Grev Home to show them here.'),
  'best-friends': d => list(d.items, f => h('a', { class: 'w-person', href: `/profile/${encodeURIComponent(f.username)}` }, avatar(f, 'sm'),
    h('span', { class: 'w-grow' }, ...line(f.displayName, f.activityText ? `Playing ${f.activityText}` : (f.availability && f.availability !== 'offline' ? 'Online' : 'Offline'))),
    h('span', { class: `dot${f.availability && f.availability !== 'offline' ? ' on' : ''}` })), 'No best friends picked yet.'),
  'bio': d => h('div', { class: 'w-stack' }, d.headline ? h('strong', { class: 'w-headline', text: d.headline }) : null,
    d.bio ? h('p', { class: 'w-bio', text: d.bio }) : (!d.headline ? h('p', { class: 'w-empty', text: 'No bio yet.' }) : null)),
  'stats': d => h('dl', { class: 'w-stats' },
    [['Level', d.level], ['XP', d.totalXp?.toLocaleString()], ['Play time', d.totalTrackedSeconds == null ? null : duration(d.totalTrackedSeconds)],
     ['Sessions', d.completedSessions], ['Games', d.uniqueApps], ['Achievements', d.achievements]]
      .filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => h('div', {}, h('dt', { text: k }), h('dd', { text: String(v) })))),
  'achievements': d => h('div', { class: 'w-stack' }, h('span', { class: 'w-sub', text: `${d.earned} of ${d.available} earned` }),
    list(d.items, a => line(a.name, a.description), 'No achievements yet.')),
  'retroachievements': d => {
    if (!d.linked) return h('p', { class: 'w-empty', text: 'Link a RetroAchievements username in Settings.' });
    if (!d.summary) return h('p', { class: 'w-empty', text: d.error || 'RetroAchievements data is loading.' });
    const s = d.summary;
    return h('div', { class: 'w-stack' },
      h('div', { class: 'w-ra' }, h('strong', { text: s.username }), h('span', { text: `${(s.totalPoints ?? 0).toLocaleString()} points${s.rank ? ` · rank ${s.rank.toLocaleString()}` : ''}` })),
      list(s.recentAchievements, a => line(a.title, `${a.gameTitle} · ${a.points} pts`), 'No recent unlocks.'));
  },
  'friends-online': d => h('div', { class: 'w-stack' }, h('span', { class: 'w-sub', text: d.items.length ? `${d.onlineCount} of ${d.items.length} online` : '' }),
    list(d.items.slice(0, 8), f => h('a', { class: 'w-person', href: `/profile/${encodeURIComponent(f.username)}` }, avatar(f, 'sm'),
      h('span', { class: 'w-grow' }, ...line(f.displayName, f.playing ? `Playing ${f.playing}` : (f.online ? (f.status || 'Online') : 'Offline'))),
      h('span', { class: `dot${f.online ? ' on' : ''}` })), 'Add friends on the Friends page.')),
  'grev-home': () => h('div', { class: 'w-gh' }, h('img', { src: '/grev-home-logo.png', alt: '' }),
    h('div', { class: 'w-stack' }, h('strong', { text: 'Grev Home' }), h('span', { class: 'w-sub', text: 'A controller-first console for your Windows PC, linked to this account.' }),
      h('a', { class: 'btn sm accent', href: '/download/grev-home' }, icon('download'), 'Download for Windows'))),
  'cloud-saves': d => !d.available ? h('p', { class: 'w-empty', text: 'Cloud saves are being set up on grev.dad.' })
    : list(d.items, s => line(s.appId, `${ago(s.updatedAt)} · ${bytes(s.sizeBytes)}`), 'Turn on cloud saves for a game in Grev Home.'),
  'consoles': d => d.items.length ? h('div', { class: 'w-stack' }, h('strong', { class: 'w-big', text: String(d.items.length) }), h('span', { class: 'w-sub', text: `linked PC${d.items.length === 1 ? '' : 's'}` }),
    h('span', { class: 'w-sub', text: d.items[0] ? `${d.items[0].deviceName}, ${ago(d.items[0].lastUsedAt)}` : '' }))
    : h('div', { class: 'w-stack' }, h('span', { class: 'w-sub', text: 'No Grev Home PC linked yet.' }), h('a', { class: 'btn sm', href: '/grev-home' }, 'Link Grev Home')),
  'clock': () => { const el = h('div', { class: 'w-clock' }, h('strong'), h('span')); tickClock(el); return el; }
};

function tickClock(el) {
  const draw = () => {
    if (!el.isConnected && el.dataset.started) return;
    el.dataset.started = '1';
    const now = new Date();
    el.firstChild.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    el.lastChild.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    setTimeout(draw, 15000);
  };
  draw();
}

export function renderWidget(kind, data) {
  if (data?.hidden) return h('p', { class: 'w-empty', text: 'Only friends can see this.' });
  const render = RENDERERS[kind];
  if (!render) return h('p', { class: 'w-empty', text: 'This widget is not available.' });
  if (!data && kind !== 'grev-home' && kind !== 'clock') return h('p', { class: 'w-empty', text: 'Save to load this widget.' });
  try { return render(data ?? {}); } catch { return h('p', { class: 'w-empty', text: "This widget couldn't load." }); }
}
