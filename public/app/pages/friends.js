// Friends: your friends, friend requests, adding people by friend code or name, and direct messages.
// Uses the same friend and message code as Grev Home, so both always agree.
import { api, uuid } from '../api.js';
import { h, icon, avatar, ago, toast, confirmSheet } from '../ui.js';

const presenceLine = (p) => {
  if (!p || p.availability === 'offline') return { on: false, text: 'Offline' };
  if (p.activityType === 'playing' && p.activityText) return { on: true, text: `Playing ${p.activityText}` };
  return { on: true, text: p.statusText || 'Online' };
};
const person = (f) => ({ displayName: f.displayName, username: f.username, avatarMedia: f.publicCard?.avatarMedia ?? null });

export async function render(container, ctx) {
  document.title = 'Friends · Grev.dad';
  if (ctx.params[0]) return conversation(container, ctx, ctx.params[0]);
  const tabNames = { friends: 'Friends', requests: 'Requests', add: 'Add friends', messages: 'Messages' };
  let tab = tabNames[ctx.query.get('tab')] ? ctx.query.get('tab') : 'friends';
  const { counts, friendCode } = ctx.session;
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const body = h('div');
  container.append(
    h('header', { class: 'page-head' }, h('div', {}, h('p', { class: 'eyebrow', text: 'Friends' }), h('h1', { text: 'Friends' })),
      friendCode ? h('div', { class: 'panel', style: { padding: '10px 14px' } }, h('span', { class: 'muted small', text: 'Your friend code ' }), h('span', { class: 'code', text: friendCode })) : null),
    tabs, body);
  const drawTabs = () => tabs.replaceChildren(...Object.entries(tabNames).map(([id, label]) => {
    const count = id === 'requests' ? counts.friendRequests : id === 'messages' ? counts.unreadMessages : 0;
    return h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id), onclick: () => { tab = id; history.replaceState({}, '', id === 'friends' ? '/friends' : `/friends?tab=${id}`); drawTabs(); show(); } },
      label, count ? h('span', { class: 'nav-count', style: { position: 'static', marginLeft: '6px' }, text: count }) : null);
  }));
  const show = async () => {
    body.replaceChildren(h('div', { class: 'empty', text: 'Loading…' }));
    try { await ({ friends: friendsTab, requests: requestsTab, add: addTab, messages: messagesTab })[tab](body, ctx); }
    catch (error) { body.replaceChildren(h('div', { class: 'empty', text: error.message })); }
  };
  drawTabs(); show();
}

async function friendsTab(body, ctx) {
  const { friends } = await api('/api/v2/friends');
  if (!friends.length) { body.replaceChildren(h('div', { class: 'empty' }, h('strong', { text: 'No friends yet' }), 'Share your friend code or find people in Add friends.')); return; }
  friends.sort((a, b) => Number(presenceLine(b.presence).on) - Number(presenceLine(a.presence).on) || a.displayName.localeCompare(b.displayName));
  const online = friends.filter(f => presenceLine(f.presence).on).length;
  body.replaceChildren(h('div', { class: 'panel' },
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', { text: `${friends.length} friend${friends.length === 1 ? '' : 's'}` }), h('p', { text: `${online} online now` }))),
    h('div', { class: 'list' }, friends.map(f => {
      const p = presenceLine(f.presence);
      const remove = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove ${f.displayName}`, title: 'Remove friend' }, icon('trash'));
      remove.addEventListener('click', async () => {
        if (!await confirmSheet(`Remove ${f.displayName}?`, 'You will stop being friends on grev.dad and in Grev Home. You can add them again later.', 'Remove friend')) return;
        try { await api(`/api/v2/friends/${f.userId}`, { method: 'DELETE' }); toast('Friend removed'); friendsTab(body, ctx); } catch (e) { toast(e.message); }
      });
      return h('div', { class: 'list-item' }, avatar(person(f)),
        h('a', { class: 'grow', href: `/profile/${encodeURIComponent(f.username)}`, style: { color: 'inherit', textDecoration: 'none' } },
          h('strong', { text: f.displayName }), h('span', {}, h('span', { class: `dot${p.on ? ' on' : ''}`, style: { display: 'inline-block', marginRight: '6px' } }), p.text)),
        h('span', { class: 'badge', text: `Lv ${f.level}` }),
        h('a', { class: 'btn sm', href: `/friends/${f.userId}` }, icon('send'), 'Message'), remove);
    }))));
}

async function requestsTab(body, ctx) {
  const { incoming, outgoing } = await api('/api/v2/friend-requests');
  const act = async (url, method, message) => {
    try { await api(url, { method, body: method === 'POST' ? {} : undefined }); toast(message); await ctx.refreshSession(); requestsTab(body, ctx); } catch (e) { toast(e.message); }
  };
  const row = (r, buttons) => h('div', { class: 'list-item' }, avatar(r.user),
    h('a', { class: 'grow', href: `/profile/${encodeURIComponent(r.user.username)}`, style: { color: 'inherit', textDecoration: 'none' } }, h('strong', { text: r.user.displayName }), h('span', { text: `@${r.user.username} · ${ago(r.createdAt)}` })),
    ...buttons);
  body.replaceChildren(h('div', { class: 'grid-2' },
    h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', { text: 'Received' })),
      incoming.length ? h('div', { class: 'list' }, incoming.map(r => row(r, [
        h('button', { class: 'btn sm accent', type: 'button', text: 'Accept', onclick: () => act(`/api/v2/friend-requests/${r.id}/accept`, 'POST', `You and ${r.user.displayName} are now friends`) }),
        h('button', { class: 'btn sm ghost', type: 'button', text: 'Decline', onclick: () => act(`/api/v2/friend-requests/${r.id}/decline`, 'POST', 'Request declined') })])))
        : h('p', { class: 'muted', text: 'No requests waiting.' })),
    h('section', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h2', { text: 'Sent' })),
      outgoing.length ? h('div', { class: 'list' }, outgoing.map(r => row(r, [
        h('button', { class: 'btn sm ghost', type: 'button', text: 'Cancel', onclick: () => act(`/api/v2/friend-requests/${r.id}`, 'DELETE', 'Request cancelled') })])))
        : h('p', { class: 'muted', text: 'No requests sent.' }))));
}

async function addTab(body, ctx) {
  const send = async (userId, button) => {
    button.disabled = true;
    try { await api('/api/v2/friend-requests', { method: 'POST', body: { userId } }); button.textContent = 'Request sent'; toast('Friend request sent'); }
    catch (e) { button.disabled = false; toast(e.message); }
  };
  const codeInput = h('input', { name: 'code', placeholder: 'GREV-XXXX-XXXX', autocomplete: 'off', spellcheck: 'false', style: { textTransform: 'uppercase' } });
  const codeResult = h('div');
  const codeForm = h('form', { class: 'form' }, h('label', { class: 'field' }, 'Friend code', codeInput),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit', text: 'Find' })), codeResult);
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    codeResult.replaceChildren();
    try {
      const { user } = await api(`/api/v2/friends/lookup?code=${encodeURIComponent(codeInput.value.trim())}`);
      const add = h('button', { class: 'btn sm accent', type: 'button', text: 'Add friend', onclick: () => send(user.userId, add) });
      codeResult.append(h('div', { class: 'list-item' }, avatar({ ...user, avatarMedia: user.publicCard?.avatarMedia }), h('div', { class: 'grow' }, h('strong', { text: user.displayName }), h('span', { text: `@${user.username}` })), add));
    } catch (error) { codeResult.append(h('p', { class: 'msg bad', text: error.message })); }
  });
  const q = h('input', { type: 'search', name: 'q', placeholder: 'Name or @username', autocomplete: 'off' });
  const results = h('div', { class: 'list' });
  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    const term = q.value.trim();
    if (term.length < 2) { results.replaceChildren(); return; }
    timer = setTimeout(async () => {
      try {
        const { users } = await api(`/api/v2/users?q=${encodeURIComponent(term)}`);
        if (q.value.trim() !== term) return;
        results.replaceChildren(...(users.length ? users.map(u => {
          const action = u.isFriend ? h('a', { class: 'btn sm', href: `/friends/${u.userId}`, text: 'Message' })
            : u.outgoingPending ? h('span', { class: 'badge', text: 'Request sent' })
            : u.incomingPending ? h('a', { class: 'btn sm accent', href: '/friends?tab=requests', text: 'Respond' })
            : h('button', { class: 'btn sm accent', type: 'button', text: 'Add friend' });
          if (action.tagName === 'BUTTON') action.addEventListener('click', () => send(u.userId, action));
          return h('div', { class: 'list-item' }, avatar(u), h('a', { class: 'grow', href: `/profile/${encodeURIComponent(u.username)}`, style: { color: 'inherit', textDecoration: 'none' } }, h('strong', { text: u.displayName }), h('span', { text: `@${u.username}` })), action);
        }) : [h('p', { class: 'muted', text: 'Nobody found.' })]));
      } catch (error) { results.replaceChildren(h('p', { class: 'msg bad', text: error.message })); }
    }, 250);
  });
  body.replaceChildren(h('div', { class: 'grid-2' },
    h('section', { class: 'panel stack' }, h('div', {}, h('h2', { text: 'Add by friend code' }), h('p', { class: 'muted small', text: 'Friend codes are shown in Grev Home and at the top of this page.' })), codeForm),
    h('section', { class: 'panel stack' }, h('div', {}, h('h2', { text: 'Search members' }), h('p', { class: 'muted small', text: 'Find people by display name or username.' })), h('label', { class: 'field' }, 'Search', q), results)));
  codeInput.focus();
}

async function messagesTab(body) {
  const { conversations } = await api('/api/v2/messages');
  if (!conversations.length) { body.replaceChildren(h('div', { class: 'empty' }, h('strong', { text: 'No conversations yet' }), 'Open a friend and choose Message to start one.')); return; }
  body.replaceChildren(h('div', { class: 'panel' }, h('div', { class: 'list' }, conversations.map(c =>
    h('a', { class: 'list-item', href: `/friends/${c.userId}` }, avatar(c), h('div', { class: 'grow' }, h('strong', { text: c.displayName }), h('span', { text: c.unread ? `${c.unread} unread` : 'No new messages' })),
      c.unread ? h('span', { class: 'nav-count', style: { position: 'static' }, text: c.unread }) : null)))));
}

async function conversation(container, ctx, userId) {
  const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
  const input = h('textarea', { rows: 2, maxlength: 2000, placeholder: 'Write a message', 'aria-label': 'Message' });
  const sendBtn = h('button', { class: 'btn primary', type: 'submit' }, icon('send'), 'Send');
  const form = h('form', { class: 'chat-form' }, input, sendBtn);
  const title = h('h1', { text: 'Messages' });
  const sub = h('p', { class: 'muted small' });
  container.append(h('header', { class: 'page-head' }, h('div', {}, h('a', { class: 'eyebrow', href: '/friends?tab=messages', style: { textDecoration: 'none' } }, '← Friends'), title, sub)),
    h('section', { class: 'panel chat' }, log, form));
  let messages = [];
  let friend = null;
  try { const { friends } = await api('/api/v2/friends'); friend = friends.find(f => f.userId === userId) ?? null; } catch {}
  if (friend) { title.textContent = friend.displayName; sub.textContent = presenceLine(friend.presence).text; document.title = `${friend.displayName} · Messages · Grev.dad`; }
  const me = ctx.session.user.id;
  const draw = () => {
    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    log.replaceChildren(...(messages.length ? messages.map(m => h('div', { class: `bubble${m.senderUserId === me ? ' mine' : ''}` },
      h('p', { text: m.body }), h('time', { text: new Date(m.createdAt * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) })))
      : [h('p', { class: 'muted', style: { textAlign: 'center', margin: 'auto' }, text: 'Say hello.' })]));
    if (atBottom || !log.dataset.drawn) log.scrollTop = log.scrollHeight;
    log.dataset.drawn = '1';
  };
  const load = async () => {
    const data = await api(`/api/v2/messages/${userId}`);
    const changed = data.messages.length !== messages.length || data.messages.at(-1)?.id !== messages.at(-1)?.id;
    messages = data.messages;
    if (changed) {
      draw();
      const last = messages.at(-1);
      // Mark everything shown as read, even when the newest message is our own (sent elsewhere).
      if (last) { api(`/api/v2/messages/${userId}/read`, { method: 'POST', body: { messageId: last.id } }).then(() => ctx.refreshSession()).catch(() => {}); }
    }
  };
  try { await load(); } catch (error) { log.replaceChildren(h('p', { class: 'msg bad', text: error.message })); form.hidden = true; return; }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      const id = uuid();
      await api(`/api/v2/messages/${userId}`, { method: 'POST', body: { messageId: id, body: text } });
      messages.push({ id, senderUserId: me, body: text, createdAt: Math.floor(Date.now() / 1000) });
      input.value = ''; log.dataset.drawn = ''; draw();
    } catch (error) { toast(error.message); }
    finally { sendBtn.disabled = false; input.focus(); }
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  input.focus();
  const timer = setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 5000);
  return () => clearInterval(timer);
}
