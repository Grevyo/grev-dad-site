// Admin: account overview, verification, suspension and (for the owner) administrator access.
import { api } from '../api.js';
import { h, avatar, ago, toast, confirmSheet } from '../ui.js';

export async function render(container, ctx) {
  document.title = 'Admin · Grev.dad';
  const summaryHost = h('div', { class: 'stats-row' });
  const q = h('input', { type: 'search', placeholder: 'Search name, username or email', 'aria-label': 'Search accounts' });
  const status = h('select', { 'aria-label': 'Status' }, ['all', 'active', 'suspended', 'disabled'].map(s => h('option', { value: s, text: s[0].toUpperCase() + s.slice(1) })));
  const list = h('div', { class: 'list' });
  container.append(
    h('header', { class: 'page-head' }, h('div', {}, h('p', { class: 'eyebrow', text: 'Admin' }), h('h1', { text: 'Accounts' }))),
    h('div', { class: 'stack' }, summaryHost,
      h('section', { class: 'panel stack' }, h('div', { class: 'row' }, h('div', { style: { flex: '1', minWidth: '220px' } }, q), h('div', { style: { width: '160px' } }, status)), list)));

  const loadSummary = async () => {
    const { summary } = await api('/api/admin/summary');
    summaryHost.replaceChildren(...[['Accounts', summary.total], ['Active', summary.active], ['Suspended', summary.suspended], ['Unverified', summary.unverified], ['Admins', summary.admins]]
      .map(([k, v]) => h('div', { class: 'panel stat' }, h('span', { class: 'muted small', text: k }), h('strong', { text: String(v) }))));
  };
  const loadUsers = async () => {
    const { users } = await api(`/api/admin/users?q=${encodeURIComponent(q.value.trim())}&status=${status.value}`);
    list.replaceChildren(...(users.length ? users.map(u => row(u)) : [h('p', { class: 'muted', text: 'No accounts match.' })]));
  };
  const act = async (url, body, message) => {
    try { const r = await api(url, { method: 'POST', body }); toast(r.message || message); await Promise.all([loadUsers(), loadSummary()]); } catch (e) { toast(e.message); }
  };
  const row = (u) => {
    const self = u.id === ctx.session.user.id;
    const buttons = [];
    if (!u.isOwner || ctx.session.user.isOwner) buttons.push(h('button', { class: 'btn sm', type: 'button', text: u.isVerified ? 'Unverify' : 'Verify', onclick: () => act(`/api/admin/users/${u.id}/verification`, { verified: !u.isVerified }) }));
    if (!u.isOwner && !self) buttons.push(u.status === 'active'
      ? h('button', { class: 'btn sm danger', type: 'button', text: 'Suspend', onclick: async () => { if (await confirmSheet(`Suspend ${u.displayName}?`, 'They will be signed out everywhere, including Grev Home, until reactivated.', 'Suspend')) act(`/api/admin/users/${u.id}/status`, { status: 'suspended' }); } })
      : h('button', { class: 'btn sm', type: 'button', text: 'Reactivate', onclick: () => act(`/api/admin/users/${u.id}/status`, { status: 'active' }) }));
    if (ctx.session.user.isOwner && !u.isOwner) buttons.push(h('button', { class: 'btn sm ghost', type: 'button', text: u.isAdmin ? 'Remove admin' : 'Make admin', onclick: async () => { if (u.isAdmin || await confirmSheet(`Make ${u.displayName} an admin?`, 'Admins can verify and suspend accounts.', 'Make admin', false)) act(`/api/admin/users/${u.id}/administrator`, { isAdmin: !u.isAdmin }); } }));
    return h('div', { class: 'list-item', style: { flexWrap: 'wrap' } }, avatar(u),
      h('a', { class: 'grow', href: `/profile/${encodeURIComponent(u.username)}`, style: { color: 'inherit', textDecoration: 'none', minWidth: '180px' } },
        h('strong', { text: u.displayName }), h('span', { text: `@${u.username}${u.email ? ` · ${u.email}` : ''} · joined ${ago(u.createdAt)}` })),
      h('div', { class: 'row', style: { gap: '6px' } },
        u.isOwner ? h('span', { class: 'badge accent', text: 'Owner' }) : u.isAdmin ? h('span', { class: 'badge accent', text: 'Admin' }) : null,
        u.isVerified ? h('span', { class: 'badge ok', text: 'Verified' }) : null,
        u.status !== 'active' ? h('span', { class: 'badge warn', text: u.status }) : null, ...buttons));
  };
  let timer;
  q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => loadUsers().catch(e => toast(e.message)), 250); });
  status.addEventListener('change', () => loadUsers().catch(e => toast(e.message)));
  await Promise.all([loadSummary(), loadUsers()]);
  return () => clearTimeout(timer);
}
