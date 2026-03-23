(function () {
  const POLL_INTERVAL_MS = 10000;
  const WIDGET_ID = 'casino-chat-widget';
  if (document.getElementById(WIDGET_ID)) return;

  const style = document.createElement('style');
  style.textContent = `
    .casino-chat-widget {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 90;
      display: grid;
      justify-items: end;
      gap: 12px;
      max-width: min(420px, calc(100vw - 24px));
    }
    .casino-chat-widget__panel {
      width: min(420px, calc(100vw - 24px));
      max-height: min(78vh, 720px);
      border: 1px solid var(--border);
      border-radius: 22px;
      background: color-mix(in srgb, var(--surface-strong) 94%, rgba(7, 12, 22, 0.96));
      box-shadow: 0 28px 60px rgba(0,0,0,0.35);
      overflow: hidden;
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr) auto auto;
      backdrop-filter: blur(18px);
    }
    .casino-chat-widget__panel[hidden] { display: none; }
    .casino-chat-widget__toggle {
      min-width: 168px;
      border-radius: 999px;
      box-shadow: 0 16px 30px rgba(0,0,0,0.3);
    }
    .casino-chat-widget__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px 10px;
      background: linear-gradient(135deg, rgba(248, 196, 68, 0.16), rgba(104, 193, 255, 0.12));
      border-bottom: 1px solid var(--border);
    }
    .casino-chat-widget__title { margin: 0; font-size: 1.05rem; }
    .casino-chat-widget__close {
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      border-radius: 999px;
      width: 36px;
      height: 36px;
      font-size: 1.2rem;
      cursor: pointer;
    }
    .casino-chat-widget__copy {
      margin: 0;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .casino-chat-widget__status,
    .casino-chat-widget__guest {
      margin: 14px 16px 0;
    }
    .casino-chat-widget__messages {
      margin: 14px 16px 0;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: color-mix(in srgb, var(--surface) 90%, transparent);
      min-height: 240px;
      max-height: min(42vh, 420px);
      overflow-y: auto;
      padding: 14px;
      display: grid;
      gap: 12px;
    }
    .casino-chat-widget__empty,
    .casino-chat-widget__time { color: var(--muted); }
    .casino-chat-widget__message {
      padding: 12px 13px;
      border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
      border-radius: 12px;
      background: color-mix(in srgb, var(--surface) 90%, transparent);
    }
    .casino-chat-widget__meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 0.86rem; }
    .casino-chat-widget__author { display: inline-flex; align-items: center; gap: 10px; }
    .casino-chat-widget__avatar, .casino-chat-widget__avatar-placeholder { width: 32px; height: 32px; border-radius: 999px; flex-shrink: 0; }
    .casino-chat-widget__avatar { object-fit: cover; border: 1px solid var(--border); }
    .casino-chat-widget__avatar-placeholder { display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 18%, var(--surface)); font-weight: 800; }
    .casino-chat-widget__user { font-weight: 700; color: var(--text); }
    .casino-chat-widget__group { color: var(--text); background: color-mix(in srgb, var(--accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent); border-radius: 999px; padding: 2px 8px; }
    .casino-chat-widget__text { color: var(--text); line-height: 1.55; white-space: pre-wrap; word-break: break-word; }
    .casino-chat-widget__form {
      display: grid;
      gap: 12px;
      padding: 14px 16px 16px;
    }
    .casino-chat-widget__textarea { min-height: 92px; resize: vertical; }
    @media (max-width: 640px) {
      .casino-chat-widget {
        right: 12px;
        left: 12px;
        bottom: 12px;
        justify-items: stretch;
        max-width: none;
      }
      .casino-chat-widget__panel,
      .casino-chat-widget__toggle {
        width: 100%;
      }
      .casino-chat-widget__panel {
        max-height: min(82vh, 720px);
        border-radius: 18px;
      }
      .casino-chat-widget__messages {
        min-height: 200px;
        max-height: min(38vh, 360px);
      }
    }
  `;
  document.head.appendChild(style);

  const root = document.createElement('aside');
  root.id = WIDGET_ID;
  root.className = 'casino-chat-widget';
  root.innerHTML = `
    <section class="casino-chat-widget__panel" hidden>
      <div class="casino-chat-widget__header">
        <div>
          <p class="eyebrow">🎰 Live table chat</p>
          <h2 class="casino-chat-widget__title">Casino Chat</h2>
          <p class="casino-chat-widget__copy">Open this anywhere in the casino, including inside games.</p>
        </div>
        <button class="casino-chat-widget__close" type="button" aria-label="Close casino chat">×</button>
      </div>
      <div class="casino-chat-widget__status alert alert-info">Loading casino chat...</div>
      <div class="casino-chat-widget__messages"><div class="casino-chat-widget__empty">No messages yet.</div></div>
      <div class="casino-chat-widget__guest alert alert-info hidden">You need to be logged in to send messages in casino chat.</div>
      <form class="casino-chat-widget__form hidden">
        <div class="form-group">
          <label class="form-label" for="casino-chat-widget-message">Talk to the table</label>
          <textarea id="casino-chat-widget-message" class="form-input form-textarea casino-chat-widget__textarea" maxlength="1000" placeholder="Call your shot, celebrate, or complain about red hitting again..."></textarea>
        </div>
        <div class="button-row">
          <button class="btn btn-primary" type="submit">Send message</button>
        </div>
      </form>
    </section>
    <button class="btn btn-primary casino-chat-widget__toggle" type="button" aria-expanded="false">Open Casino Chat</button>
  `;
  document.body.appendChild(root);

  const panel = root.querySelector('.casino-chat-widget__panel');
  const toggleBtn = root.querySelector('.casino-chat-widget__toggle');
  const closeBtn = root.querySelector('.casino-chat-widget__close');
  const statusEl = root.querySelector('.casino-chat-widget__status');
  const messagesEl = root.querySelector('.casino-chat-widget__messages');
  const guestEl = root.querySelector('.casino-chat-widget__guest');
  const formEl = root.querySelector('.casino-chat-widget__form');
  const inputEl = root.querySelector('#casino-chat-widget-message');
  const sendBtn = formEl.querySelector('button[type="submit"]');
  let currentUser = null;
  let pollId = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function setOpen(nextOpen) {
    panel.hidden = !nextOpen;
    toggleBtn.textContent = nextOpen ? 'Hide Casino Chat' : 'Open Casino Chat';
    toggleBtn.setAttribute('aria-expanded', String(nextOpen));
    if (nextOpen) inputEl.focus();
  }
  function setAuthState(user) {
    currentUser = user || null;
    const authed = Boolean(currentUser);
    formEl.classList.toggle('hidden', !authed);
    guestEl.classList.toggle('hidden', authed);
  }
  function renderMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      messagesEl.innerHTML = '<div class="casino-chat-widget__empty">No messages yet.</div>';
      return;
    }
    messagesEl.innerHTML = messages.map((message) => {
      const username = escapeHtml(message.author_username || 'Unknown');
      const group = escapeHtml(message.author_group || 'Member');
      const timestamp = escapeHtml(formatTime(message.created_at));
      const text = escapeHtml(message.message || '');
      const avatarUrl = typeof message.avatar_url === 'string' ? message.avatar_url.trim() : '';
      const firstLetter = escapeHtml((username || '?').charAt(0).toUpperCase());
      const avatar = avatarUrl
        ? `<img class="casino-chat-widget__avatar" src="${escapeHtml(avatarUrl)}" alt="${username} avatar" />`
        : `<div class="casino-chat-widget__avatar-placeholder">${firstLetter}</div>`;
      return `<article class="casino-chat-widget__message"><div class="casino-chat-widget__meta"><span class="casino-chat-widget__author">${avatar}<span class="casino-chat-widget__user">${username}</span></span><span class="casino-chat-widget__group">${group}</span><span class="casino-chat-widget__time">${timestamp}</span></div><div class="casino-chat-widget__text">${text}</div></article>`;
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  async function loadCurrentUser() {
    if (typeof window.fetchCurrentUser !== 'function') return setAuthState(null);
    const user = await window.fetchCurrentUser({ preferCache: true });
    setAuthState(user);
  }
  async function loadChat(showLoading) {
    try {
      if (showLoading) {
        statusEl.textContent = 'Loading casino chat...';
        statusEl.className = 'casino-chat-widget__status alert alert-info';
      }
      const response = await fetch('/api/chat/casino', { credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to load casino chat');
      renderMessages(data.messages || []);
      statusEl.textContent = currentUser ? 'Casino chat is live.' : 'Viewing casino chat as a guest.';
      statusEl.className = 'casino-chat-widget__status alert alert-success';
    } catch (error) {
      console.error(error);
      statusEl.textContent = error.message || 'Could not load casino chat.';
      statusEl.className = 'casino-chat-widget__status alert alert-error';
    }
  }
  async function handleSubmit(event) {
    event.preventDefault();
    if (!currentUser) return;
    const message = inputEl.value.trim();
    if (!message) return;
    sendBtn.disabled = true;
    try {
      const response = await fetch('/api/chat/casino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Failed to send message');
      inputEl.value = '';
      await loadChat(false);
    } catch (error) {
      console.error(error);
      statusEl.textContent = error.message || 'Could not send message.';
      statusEl.className = 'casino-chat-widget__status alert alert-error';
    } finally {
      sendBtn.disabled = false;
    }
  }

  toggleBtn.addEventListener('click', () => setOpen(panel.hidden));
  closeBtn.addEventListener('click', () => setOpen(false));
  formEl.addEventListener('submit', handleSubmit);
  window.addEventListener('beforeunload', () => { if (pollId) window.clearInterval(pollId); });

  document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUser();
    await loadChat(true);
    pollId = window.setInterval(() => loadChat(false), POLL_INTERVAL_MS);
  });
})();
