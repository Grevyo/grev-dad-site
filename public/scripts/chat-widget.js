(function () {
  if (window.GREVChat) return;

  const state = {
    rooms: [],
    selectedRoomId: null,
    lastMessageId: 0,
    poller: null,
    open: false,
    currentUserId: null
  };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function getInitials(displayName, username) {
    const source = (displayName || username || '').trim();
    if (!source) return '?';
    const bits = source.split(/\s+/).filter(Boolean);
    if (bits.length > 1) return (bits[0][0] + bits[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  }

  async function api(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({ ok: false, error: 'Invalid JSON' }));
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Request failed');
    return data;
  }

  function renderMessages(messages, target, append) {
    if (!append) target.textContent = '';
    (messages || []).forEach((m) => {
      const row = el('div', 'chat-message' + (state.currentUserId === m.sender_user_id ? ' chat-message-own' : ''));
      const profile = el('div', 'chat-message-profile');
      const avatar = el('div', 'chat-message-avatar');
      if (m.sender_avatar_url) {
        const img = document.createElement('img');
        img.src = m.sender_avatar_url;
        img.alt = (m.sender_display_name || m.sender_username || 'User') + ' avatar';
        avatar.append(img);
      } else {
        avatar.textContent = getInitials(m.sender_display_name, m.sender_username);
      }
      profile.append(avatar);

      const content = el('div', 'chat-message-content');
      const meta = el('div', 'chat-message-meta');
      const rank = m.sender_rank?.name || 'Unranked';
      const level = Number(m.sender_accountLevel) > 0 ? Number(m.sender_accountLevel) : 1;
      meta.textContent = '';
      meta.append(document.createTextNode(`${m.sender_display_name || m.sender_username} · @${m.sender_username || 'unknown'} · `));
      if (window.renderLevelBadge) meta.append(window.renderLevelBadge(level));
      else meta.append(document.createTextNode(`Lv. ${level}`));
      meta.append(document.createTextNode(` · ${rank} · ${new Date(m.created_at).toLocaleTimeString()}`));
      const body = el('div', 'chat-message-body');
      body.textContent = m.body || '';
      content.append(meta, body);

      row.append(profile, content);
      target.append(row);
      state.lastMessageId = Math.max(state.lastMessageId, Number(m.id) || 0);
    });
  }

  function ensureMounted() {
    if (document.getElementById('chat-launcher')) return;
    const launcher = el('button', 'chat-launcher', 'Chat');
    launcher.id = 'chat-launcher';

    const popup = el('section', 'chat-popup');
    popup.id = 'chat-popup';
    popup.innerHTML = '<div class="chat-header"><strong>Chat</strong><button type="button" id="chat-close">−</button></div><div class="chat-private-start"><input id="chat-dm-user" placeholder="username"/><button id="chat-dm-start" type="button">Start</button></div><select id="chat-room-list" class="chat-room-list"></select><div id="chat-message-list" class="chat-message-list">Loading…</div><div class="chat-input-row"><input id="chat-input" maxlength="1000" placeholder="Message"/><button id="chat-send" type="button">Send</button></div>';

    document.body.append(launcher, popup);
    launcher.onclick = async function () {
      state.open = true;
      popup.classList.add('chat-popup-open');
      await loadRooms();
    };
    popup.querySelector('#chat-close').onclick = function () {
      state.open = false;
      popup.classList.remove('chat-popup-open');
    };
    popup.querySelector('#chat-room-list').onchange = function (event) { selectRoom(Number(event.target.value)); };
    popup.querySelector('#chat-send').onclick = sendMessage;
    popup.querySelector('#chat-dm-start').onclick = startDm;
    window.addEventListener('beforeunload', function () { if (state.poller) clearInterval(state.poller); });
  }

  async function loadRooms() {
    try {
      const d = await api('/api/chat/rooms');
      state.rooms = d.rooms || [];
      const sel = document.getElementById('chat-room-list');
      if (!sel) return;
      sel.textContent = '';
      state.rooms.forEach((r) => {
        const label = r.name + (r.unread_count ? ` (${r.unread_count})` : '');
        const option = el('option', '', label);
        option.value = String(r.id);
        sel.append(option);
      });
      if (!state.selectedRoomId && state.rooms[0]) state.selectedRoomId = state.rooms[0].id;
      if (state.selectedRoomId) {
        sel.value = String(state.selectedRoomId);
        await loadMessages(false);
      }
      if (state.poller) clearInterval(state.poller);
      state.poller = setInterval(function () {
        if (state.open && state.selectedRoomId) loadMessages(true);
      }, 5000);
    } catch {
      const list = document.getElementById('chat-message-list');
      if (list) list.textContent = 'Chat unavailable.';
    }
  }

  async function loadMessages(incremental) {
    const list = document.getElementById('chat-message-list');
    if (!list || !state.selectedRoomId) return;
    try {
      const q = `/api/chat/messages?room_id=${state.selectedRoomId}${incremental && state.lastMessageId ? `&after_id=${state.lastMessageId}` : ''}`;
      const d = await api(q);
      if (!incremental) state.lastMessageId = 0;
      renderMessages(d.messages || [], list, incremental);
      list.scrollTop = list.scrollHeight;
    } catch {
      list.textContent = 'Chat unavailable.';
    }
  }

  async function sendMessage() {
    const input = document.getElementById('chat-input');
    const body = (input?.value || '').trim();
    if (!body || !state.selectedRoomId) return;
    try {
      await api('/api/chat/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ room_id: state.selectedRoomId, body }) });
      input.value = '';
      await loadMessages(true);
    } catch {}
  }

  async function startDm() {
    const input = document.getElementById('chat-dm-user');
    const username = (input?.value || '').trim();
    if (!username) return;
    try {
      const d = await api('/api/chat/direct', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username }) });
      state.selectedRoomId = d.room.id;
      input.value = '';
      await loadRooms();
    } catch {}
  }

  async function selectRoom(roomId) {
    state.selectedRoomId = roomId;
    state.lastMessageId = 0;
    await loadMessages(false);
  }

  function mount() { ensureMounted(); }

  function destroy() {
    if (state.poller) {
      clearInterval(state.poller);
      state.poller = null;
    }
    state.open = false;
    const launcher = document.getElementById('chat-launcher');
    const popup = document.getElementById('chat-popup');
    if (launcher) launcher.remove();
    if (popup) popup.remove();
  }

  window.GREVChat = {
    mount,
    destroy,
    currentUserId: null,
    openRoom: async function (id) {
      ensureMounted();
      state.open = true;
      state.selectedRoomId = id;
      state.currentUserId = Number(window.GREVChat.currentUserId) || null;
      document.getElementById('chat-popup').classList.add('chat-popup-open');
      await loadRooms();
    }
  };

  Object.defineProperty(window.GREVChat, 'currentUserId', {
    get() { return state.currentUserId; },
    set(v) { state.currentUserId = Number(v) || null; }
  });
})();
