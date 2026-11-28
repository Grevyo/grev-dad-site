// Grev Home: link status, linked PCs, approving a new console, cloud saves and the download.
import { api } from '../api.js';
import { h, icon, ago, bytes, toast, confirmSheet } from '../ui.js';

export async function render(container, ctx) {
  document.title = 'Grev Home · Grev.dad';
  const code = (ctx.query.get('code') || '').trim().toUpperCase();
  const approval = h('div');
  const status = h('div', { class: 'panel stack' }, h('p', { class: 'muted', text: 'Loading…' }));
  const saves = h('div', { class: 'panel stack' }, h('p', { class: 'muted', text: 'Loading…' }));
  container.append(
    h('header', { class: 'page-head' }, h('div', {}, h('p', { class: 'eyebrow', text: 'Grev Home' }), h('h1', { text: 'Grev Home' })),
      h('a', { class: 'btn accent', href: '/download/grev-home' }, icon('download'), 'Download for Windows')),
    h('div', { class: 'stack' }, approval, h('div', { class: 'grid-2' }, status, saves), setupGuide()));
  drawApproval(approval, code, ctx, () => drawStatus(status, ctx));
  await Promise.all([drawStatus(status, ctx), drawSaves(saves)]);
}

function drawApproval(host, initialCode, ctx, onLinked) {
  const input = h('input', { name: 'code', placeholder: 'XXXX-XXXX', maxlength: 16, autocomplete: 'off', spellcheck: 'false', value: initialCode, style: { textTransform: 'uppercase', fontFamily: 'var(--mono)', letterSpacing: '.12em' } });
  const result = h('div', { class: 'stack' });
  const form = h('form', { class: 'row', style: { alignItems: 'end' } }, h('label', { class: 'field', style: { flex: '1', minWidth: '200px' } }, 'Link code from Grev Home', input), h('button', { class: 'btn primary', type: 'submit', text: 'Check code' }));
  host.replaceChildren(h('section', { class: `panel${initialCode ? ' raised' : ''} stack` },
    h('div', {}, h('h2', { text: 'Link a console' }), h('p', { class: 'muted small', text: 'When you link grev.dad in Grev Home it shows a code. Enter that code here to approve it.' })),
    form, result));
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
          if (decision === 'approve') { toast('Grev Home linked'); history.replaceState({}, '', '/grev-home'); await ctx.refreshSession(); onLinked(); }
        } catch (error) { toast(error.message); }
      };
      result.append(h('div', { class: 'list-item', style: { border: '1px solid var(--line)', padding: '14px' } },
        h('img', { src: '/grev-home-logo.png', alt: '', width: 44, height: 44 }),
        h('div', { class: 'grow' }, h('strong', { text: `${request.localDisplayName} on ${request.deviceName || 'a Windows PC'}` }),
          h('span', { text: `Local profile @${request.localUsername} · requested ${ago(request.createdAt)} · expires in ${Math.max(1, Math.round((request.expiresAt - Date.now() / 1000) / 60))} min` })),
        h('button', { class: 'btn ghost', type: 'button', text: 'Deny', onclick: () => decide('deny') }),
        h('button', { class: 'btn accent', type: 'button', text: 'Approve', onclick: () => decide('approve') })),
        h('p', { class: 'muted small', text: 'Only approve a code you can see on your own screen right now.' }));
    } catch (error) { result.append(h('p', { class: 'msg bad', text: error.message })); }
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); check(); });
  if (initialCode) check();
}

async function drawStatus(host, ctx) {
  let data;
  try { data = await api('/api/grev-home/browser/link'); }
  catch (error) { host.replaceChildren(h('p', { class: 'msg bad', text: error.message })); return; }
  if (!data.linked) {
    host.replaceChildren(h('div', { class: 'panel-head' }, h('div', {}, h('h2', { text: 'Not linked yet' }), h('p', { text: 'Link Grev Home to sync your profile, friends, messages and cloud saves.' })),
      h('span', { class: 'badge warn', text: 'Not linked' })));
    return;
  }
  const unlink = h('button', { class: 'btn sm danger', type: 'button', text: 'Unlink Grev Home' });
  unlink.addEventListener('click', async () => {
    if (!await confirmSheet('Unlink Grev Home?', 'Every PC will be signed out of this account. Your profile, friends and saves stay on grev.dad.', 'Unlink')) return;
    try { await api('/api/grev-home/browser/link', { method: 'DELETE' }); toast('Grev Home unlinked'); await ctx.refreshSession(); drawStatus(host, ctx); } catch (e) { toast(e.message); }
  });
  host.replaceChildren(
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', { text: 'Linked' }), h('p', { text: `Local profile ${data.link.localDisplayName} (@${data.link.localUsername}) · last seen ${data.link.lastSeenAt ? ago(data.link.lastSeenAt) : 'never'}` })),
      h('span', { class: 'badge ok', text: 'Linked' })),
    h('div', { class: 'list' }, data.devices.length ? data.devices.map(d => {
      const out = h('button', { class: 'btn sm ghost', type: 'button', text: 'Sign out' });
      out.addEventListener('click', async () => {
        if (!await confirmSheet(`Sign out ${d.deviceName}?`, 'That PC will need a new link code to sign back in.', 'Sign out')) return;
        try { await api(`/api/grev-home/browser/devices/${d.id}`, { method: 'DELETE' }); toast('PC signed out'); drawStatus(host, ctx); } catch (e) { toast(e.message); }
      });
      return h('div', { class: 'list-item' }, icon('console'), h('div', { class: 'grow' }, h('strong', { text: d.deviceName || 'Windows PC' }), h('span', { text: `Used ${d.lastUsedAt ? ago(d.lastUsedAt) : 'not yet'} · linked ${ago(d.createdAt)}` })), out);
    }) : [h('p', { class: 'muted', text: 'No PCs are signed in right now.' })]),
    h('div', { class: 'row' }, unlink));
}

async function drawSaves(host) {
  let data;
  try { data = await api('/api/v2/saves'); }
  catch (error) { host.replaceChildren(h('p', { class: 'msg bad', text: error.message })); return; }
  const total = data.saves.reduce((sum, s) => sum + (s.sizeBytes || 0), 0);
  host.replaceChildren(
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', {}, 'Cloud saves'), h('p', { text: data.saves.length ? `${data.saves.length} game${data.saves.length === 1 ? '' : 's'} · ${bytes(total)}` : 'Backed up from Grev Home.' })), icon('cloud')),
    !data.available ? h('p', { class: 'msg', style: { color: 'var(--warn)' }, text: 'Cloud save storage is still being set up on grev.dad. Saves stay on your PC until it is ready.' }) : '',
    data.saves.length ? h('div', { class: 'list' }, data.saves.map(s => h('div', { class: 'list-item' },
      h('div', { class: 'grow' }, h('strong', { text: s.appId }), h('span', { text: `${bytes(s.sizeBytes)} · updated ${ago(s.updatedAt)}` })))))
      : h('p', { class: 'muted', text: 'Turn on cloud saves for a game in Grev Home and it will appear here.' }));
}

function setupGuide() {
  const step = (n, title, text) => h('li', {}, h('strong', { text: `${n}. ${title}` }), h('span', { class: 'muted', text }));
  return h('section', { class: 'panel stack' },
    h('div', {}, h('h2', { text: 'Setting up Grev Home' }), h('p', { class: 'muted small', text: 'A controller-first console for your Windows PC.' })),
    h('ol', { class: 'steps' },
      step(1, 'Install', 'Download GrevHomeSetup.exe above and run it. Grev Home updates itself after that.'),
      step(2, 'Create a local profile', 'Pick a name and picture with your controller on first launch.'),
      step(3, 'Link this account', 'Choose to link grev.dad in Grev Home, then approve its code on this page.'),
      step(4, 'Add games and emulators', 'Use the Grev Store to install emulators, then add your games.')));
}
