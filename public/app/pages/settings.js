// Settings: profile details (shared with Grev Home), username, RetroAchievements and your friend code.
import { api } from '../api.js';
import { h, avatar, toast, confirmSheet } from '../ui.js';

export async function render(container, ctx) {
  document.title = 'Settings · Grev.dad';
  const [{ profile }, ra] = await Promise.all([api('/api/v2/profiles/me'), api('/api/v2/profile/retroachievements').catch(() => ({ retroAchievements: null }))]);
  container.append(
    h('header', { class: 'page-head' }, h('div', {}, h('p', { class: 'eyebrow', text: 'Settings' }), h('h1', { text: 'Settings' }))),
    h('div', { class: 'grid-2', style: { alignItems: 'start' } },
      identityPanel(profile, ctx),
      h('div', { class: 'stack' }, lookPanel(), accountPanel(ctx), retroPanel(ra.retroAchievements), friendCodePanel(ctx))));
}

function identityPanel(profile, ctx) {
  const card = profile.card ?? {};
  const field = (label, control, help) => h('label', { class: 'field' }, label, control, help ? h('small', { text: help }) : null);
  const displayName = h('input', { name: 'displayName', maxlength: 60, required: true, value: profile.displayName });
  const headline = h('input', { name: 'headline', maxlength: 120, value: card.headline ?? '' });
  const bio = h('textarea', { name: 'bio', maxlength: 800, rows: 5 }); bio.value = card.bio ?? '';
  const location = h('input', { name: 'location', maxlength: 100, value: card.location ?? '' });
  const website = h('input', { name: 'websiteUrl', type: 'url', maxlength: 500, placeholder: 'https://', value: card.websiteUrl ?? '' });
  const media = { avatarMedia: card.avatarMedia ?? null, coverMedia: card.coverMedia ?? null };
  const changed = new Set();
  const preview = h('div', { class: 'row' });
  const drawPreview = () => preview.replaceChildren(avatar({ displayName: displayName.value, avatarMedia: media.avatarMedia }, 'lg'),
    h('div', { class: 'stack', style: { gap: '6px' } },
      picker('Change picture', (url) => { media.avatarMedia = url; changed.add('avatarMedia'); drawPreview(); }),
      media.avatarMedia ? h('button', { class: 'btn sm ghost', type: 'button', text: 'Remove picture', onclick: () => { media.avatarMedia = null; changed.add('avatarMedia'); drawPreview(); } }) : null));
  const cover = h('div', { class: 'cover-preview' });
  const drawCover = () => {
    cover.style.backgroundImage = media.coverMedia ? `url("${media.coverMedia}")` : '';
    cover.replaceChildren(h('div', { class: 'row' }, picker(media.coverMedia ? 'Change cover' : 'Add cover', (url) => { media.coverMedia = url; changed.add('coverMedia'); drawCover(); }),
      media.coverMedia ? h('button', { class: 'btn sm ghost', type: 'button', text: 'Remove', onclick: () => { media.coverMedia = null; changed.add('coverMedia'); drawCover(); } }) : null));
  };
  drawPreview(); drawCover();
  const msg = h('p', { class: 'msg', role: 'status' });
  const form = h('form', { class: 'form' }, preview, field('Cover image', cover, 'Shown behind your profile card.'),
    field('Display name', displayName), field('Headline', headline, 'A short line under your name.'), field('Bio', bio),
    h('div', { class: 'grid-2' }, field('Location', location), field('Website', website)),
    msg, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit', text: 'Save profile' }),
      h('a', { class: 'btn ghost', href: `/profile/${encodeURIComponent(profile.username)}`, text: 'View profile' })));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'msg'; msg.textContent = 'Saving…';
    const body = { displayName: displayName.value, headline: headline.value, bio: bio.value, location: location.value, websiteUrl: website.value };
    for (const key of changed) body[key] = media[key];
    try { await api('/api/v2/profile/identity', { method: 'PUT', body }); changed.clear(); msg.className = 'msg ok'; msg.textContent = 'Saved. Grev Home will pick this up on its next sync.'; await ctx.refreshSession(); }
    catch (error) { msg.className = 'msg bad'; msg.textContent = error.message; }
  });
  return h('section', { class: 'panel stack' }, h('div', {}, h('h2', { text: 'Profile' }), h('p', { class: 'muted small', text: 'These details show on your profile here and in Grev Home.' })), form);
}

function picker(label, onPick) {
  const input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true });
  const button = h('button', { class: 'btn sm', type: 'button', text: label, onclick: () => input.click() });
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; if (!file) return;
    try { onPick(await shrink(file)); } catch (error) { toast(error.message); }
    input.value = '';
  });
  return h('span', {}, button, input);
}

async function shrink(file) {
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("That picture couldn't be read. Try a PNG or JPEG."); });
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const q of [0.86, 0.74, 0.6, 0.48]) { const url = canvas.toDataURL('image/jpeg', q); if (url.length * 0.75 < 1_300_000) return url; }
  throw new Error('That picture is too large. Try a smaller one.');
}

function accountPanel(ctx) {
  const { user } = ctx.session;
  const username = h('input', { name: 'username', maxlength: 24, pattern: '[A-Za-z0-9_]{3,24}', value: user.username, autocomplete: 'username' });
  const msg = h('p', { class: 'msg', role: 'status' });
  const form = h('form', { class: 'form' }, h('label', { class: 'field' }, 'Username', username, h('small', { text: '3–24 letters, numbers or underscores.' })), msg,
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit', text: 'Change username' })));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (username.value.trim() === user.username) return;
    try { const r = await api('/api/account/username', { method: 'POST', body: { username: username.value.trim() } }); msg.className = 'msg ok'; msg.textContent = r.message || 'Username updated.'; await ctx.refreshSession(); }
    catch (error) { msg.className = 'msg bad'; msg.textContent = error.message; }
  });
  return h('section', { class: 'panel stack' }, h('div', {}, h('h2', { text: 'Account' }),
    h('p', { class: 'muted small' }, `Signed in as ${user.displayName}`, user.isVerified ? ' · verified' : '', user.isOwner ? ' · owner' : user.isAdmin ? ' · admin' : '')), form);
}

function retroPanel(initial) {
  const host = h('section', { class: 'panel stack' });
  const draw = (ra) => {
    const head = h('div', {}, h('h2', { text: 'RetroAchievements' }), h('p', { class: 'muted small', text: 'Show your points and recent unlocks with the RetroAchievements widget.' }));
    if (!ra) { host.replaceChildren(head, h('p', { class: 'muted', text: 'Unavailable right now.' })); return; }
    if (ra.linked) {
      host.replaceChildren(head, h('p', {}, 'Linked as ', h('strong', { text: ra.username })),
        h('div', { class: 'row' },
          h('button', { class: 'btn sm', type: 'button', text: 'Refresh', onclick: async () => { try { draw((await api('/api/v2/profile/retroachievements', { method: 'POST', body: {} })).retroAchievements); toast('Refreshed'); } catch (e) { toast(e.message); } } }),
          h('button', { class: 'btn sm ghost', type: 'button', text: 'Unlink', onclick: async () => { if (!await confirmSheet('Unlink RetroAchievements?', 'The widget will stop showing your points.', 'Unlink')) return; try { draw((await api('/api/v2/profile/retroachievements', { method: 'DELETE' })).retroAchievements); } catch (e) { toast(e.message); } } })));
      return;
    }
    const name = h('input', { name: 'username', maxlength: 40, placeholder: 'Your RetroAchievements username' });
    const msg = h('p', { class: 'msg bad', role: 'alert' });
    const form = h('form', { class: 'form' }, h('label', { class: 'field' }, 'Username', name), msg, h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit', text: 'Link' })));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); msg.textContent = '';
      try { draw((await api('/api/v2/profile/retroachievements', { method: 'PUT', body: { username: name.value.trim() } })).retroAchievements); toast('RetroAchievements linked'); }
      catch (error) { msg.textContent = error.message; }
    });
    host.replaceChildren(head, ra.configured === false ? h('p', { class: 'muted small', text: 'RetroAchievements is not set up on grev.dad yet, so linking is unavailable.' }) : form);
  };
  draw(initial);
  return host;
}

function friendCodePanel(ctx) {
  const code = ctx.session.friendCode;
  const copy = h('button', { class: 'btn sm', type: 'button', text: 'Copy', onclick: async () => { try { await navigator.clipboard.writeText(code); toast('Friend code copied'); } catch { toast(code); } } });
  return h('section', { class: 'panel stack' }, h('div', {}, h('h2', { text: 'Friend code' }), h('p', { class: 'muted small', text: 'Share this so people can add you from grev.dad or Grev Home.' })),
    h('div', { class: 'row' }, h('span', { class: 'code', text: code || '—' }), code ? copy : null));
}

/** Visual effects (grev-ambient.js). Saved on this device and applied straight away. */
function lookPanel() {
  const fx = window.GrevEffects;
  if (!fx) return null;
  const prefs = fx.get();
  const pointerOk = fx.supportsPointerEffects();
  const toggle = (key, label, help, available = true, note = '') => {
    const input = h('input', { type: 'checkbox', role: 'switch', checked: prefs[key], disabled: !available });
    input.addEventListener('change', () => fx.set(key, input.checked));
    return h('label', { class: `switch-row${available ? '' : ' off'}` },
      h('span', { class: 'grow' }, h('strong', { text: label }), h('span', { text: available ? help : note })),
      input, h('span', { class: 'switch', 'aria-hidden': 'true' }));
  };
  return h('section', { class: 'panel stack' },
    h('div', {}, h('h2', { text: 'Look and feel' }), h('p', { class: 'muted small', text: 'Saved on this device.' })),
    h('div', { class: 'list' },
      toggle('background', 'Animated background', fx.reducedMotion ? 'Shown still, because your device asks for reduced motion.' : 'The drifting grid, glow and dots from the unlock screen, behind every page.'),
      toggle('cursor', 'Custom cursor', 'A Grev.dad-style pointer that lights up over anything you can click.', pointerOk, 'Only available with a mouse or trackpad.'),
      toggle('trail', 'Cursor trail', 'A faint trail of dots behind the pointer.', pointerOk && !fx.reducedMotion,
        fx.reducedMotion ? 'Off, because your device asks for reduced motion.' : 'Only available with a mouse or trackpad.')));
}
