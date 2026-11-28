// Profile: the owner's card plus their tiles. The same tiles show on the Grev Home profile screen.
import { api } from '../api.js';
import { h, icon, avatar, ago, toast } from '../ui.js';
import { createTileGrid } from '../tiles.js';
import { PROFILE_WIDGETS } from '../widgets.js';

export async function render(container, ctx) {
  const name = decodeURIComponent(ctx.params[0]);
  container.append(h('div', { class: 'loading', style: { minHeight: '420px' }, 'aria-label': 'Loading profile' }));
  let profile;
  try { ({ profile } = await api(`/api/v2/profiles/${encodeURIComponent(name)}`)); }
  catch (error) {
    container.replaceChildren(h('div', { class: 'panel raised stack', style: { maxWidth: '560px' } },
      h('p', { class: 'eyebrow', text: 'Profile' }), h('h1', { text: 'Profile not found' }),
      h('p', { class: 'muted', text: error.message }), h('a', { class: 'btn', href: '/friends' }, 'Find friends')));
    return;
  }
  if (profile.isSelf && profile.username !== name) history.replaceState({}, '', `/profile/${encodeURIComponent(profile.username)}`);
  document.title = `${profile.displayName} · Grev.dad`;

  const host = h('div');
  container.replaceChildren(
    h('header', { class: 'page-head' }, h('div', {}, h('p', { class: 'eyebrow', text: profile.isSelf ? 'Your profile' : 'Profile' }),
      h('h1', { text: profile.displayName })),
      profile.isSelf ? h('p', { class: 'muted small', text: 'Your tiles also show on your Grev Home profile.' }) : null),
    host);

  const grid = createTileGrid({
    host, userId: ctx.session.user.id, mode: 'profile', editable: profile.isSelf,
    tiles: profile.tiles, widgets: profile.widgets ?? {},
    card: { x: profile.preferences?.cardX ?? 0, y: profile.preferences?.cardY ?? 0 },
    widgetKinds: PROFILE_WIDGETS,
    renderCard: () => profileCard(profile, ctx),
    onSave: async ({ tiles, card }) => {
      const result = await api('/api/v2/profile/layout', { method: 'PUT', body: { tiles, cardX: card.x, cardY: card.y } });
      profile = result.profile;
      return { tiles: profile.tiles, widgets: profile.widgets ?? {}, card: { x: profile.preferences.cardX, y: profile.preferences.cardY } };
    }
  });
  return () => grid.destroy();
}

function presenceText(p) {
  if (!p || p.availability === 'offline') return { online: false, text: 'Offline' };
  if (p.activityType === 'playing' && p.activityText) return { online: true, text: `Playing ${p.activityText}` };
  return { online: true, text: p.statusText || (p.availability === 'away' ? 'Away' : 'Online') };
}

function profileCard(profile, ctx) {
  const card = profile.card ?? {};
  const presence = presenceText(profile.presence);
  const el = h('section', { class: 'pcard', 'aria-label': 'Profile card' });
  el.style.background = card.coverMedia
    ? `linear-gradient(180deg,rgba(8,10,13,.35),rgba(8,10,13,.92)), center/cover no-repeat url("${card.coverMedia}")`
    : `linear-gradient(${card.backgroundAngle ?? 135}deg, ${card.backgroundPrimary ?? '#11161d'}, ${card.backgroundSecondary ?? '#3157c9'})`;
  el.style.color = card.textColour ?? '#f4f7fb';
  el.style.borderColor = card.borderColour ?? '#526074';
  const actions = h('div', { class: 'row' });
  if (profile.isSelf) actions.append(h('a', { class: 'btn sm', href: '/settings' }, icon('settings'), 'Edit details'));
  else if (profile.relationship === 'friend') actions.append(h('a', { class: 'btn sm accent', href: `/friends/${profile.id}` }, icon('send'), 'Message'));
  else {
    const add = h('button', { class: 'btn sm accent', type: 'button' }, icon('plus'), 'Add friend');
    add.addEventListener('click', async () => {
      add.disabled = true;
      try { await api('/api/v2/friend-requests', { method: 'POST', body: { userId: profile.id } }); add.replaceChildren('Request sent'); toast('Friend request sent'); }
      catch (error) { add.disabled = false; toast(error.message); }
    });
    actions.append(add);
  }
  el.append(...[
    avatar({ displayName: profile.displayName, avatarMedia: card.avatarMedia }, 'lg'),
    h('div', {}, h('h1', { text: profile.displayName }), card.showUsername !== false ? h('div', { class: 'handle', text: `@${profile.username}` }) : null),
    card.headline ? h('p', { class: 'headline', text: card.headline }) : null,
    card.showStatus !== false && profile.presence ? h('div', { class: 'presence' }, h('span', { class: `dot${presence.online ? ' on' : ''}` }), presence.text) : null,
    h('div', { class: 'meta' },
      h('span', { class: 'badge', text: `Level ${profile.level}` }),
      profile.isVerified ? h('span', { class: 'badge', text: 'Verified' }) : null,
      profile.relationship === 'friend' ? h('span', { class: 'badge', text: 'Friend' }) : null,
      card.showMemberSince !== false && profile.createdAt ? h('span', { class: 'badge', text: `Joined ${new Date(profile.createdAt * 1000).toLocaleDateString([], { month: 'short', year: 'numeric' })}` }) : null),
    actions].filter(Boolean));
  return el;
}
