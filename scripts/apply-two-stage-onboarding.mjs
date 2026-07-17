import { readFileSync, writeFileSync, rmSync } from 'node:fs';

function replaceOrFail(source, find, replacement, label) {
  if (!source.includes(find)) throw new Error(`Unable to find patch anchor: ${label}`);
  return source.replace(find, replacement);
}

let index = readFileSync('src/index.ts', 'utf8');
index = replaceOrFail(
  index,
  "return json({ok:true,next:'/intentions',message:'Account created. Tell us what brings you to Grev.dad.'},{status:201,headers:{'Set-Cookie':sessionCookie(created.token,created.maxAge,usesSecureCookies(env))}});",
  "return json({ok:true,next:'/dashboard',message:'Account created. Complete your account setup from the dashboard.'},{status:201,headers:{'Set-Cookie':sessionCookie(created.token,created.maxAge,usesSecureCookies(env))}});",
  'signup redirect'
);

const onboardingApi = `
  if(path==='/api/onboarding'&&request.method==='GET'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const [relationshipRows,intentionRows,progress]=await Promise.all([
      env.DB.prepare(\`SELECT r.id,r.slug,r.name,r.description,CASE WHEN ur.relationship_id=r.id THEN 1 ELSE 0 END AS is_selected FROM relationship_options r LEFT JOIN user_relationships ur ON ur.user_id=? WHERE r.is_active=1 ORDER BY r.sort_order,r.name\`).bind(user.id).all<{id:string;slug:string;name:string;description:string;is_selected:number}>(),
      env.DB.prepare(\`SELECT i.id,i.slug,i.name,i.description,CASE WHEN ui.user_id IS NULL THEN 0 ELSE 1 END AS is_selected FROM intention_options i LEFT JOIN user_intentions ui ON ui.intention_id=i.id AND ui.user_id=? WHERE i.is_active=1 ORDER BY i.sort_order,i.name\`).bind(user.id).all<{id:string;slug:string;name:string;description:string;is_selected:number}>(),
      env.DB.prepare(\`SELECT relationship_completed_at,intentions_completed_at FROM user_onboarding WHERE user_id=?\`).bind(user.id).first<{relationship_completed_at:number|null;intentions_completed_at:number|null}>()
    ]);
    return json({ok:true,progress:{relationshipComplete:Boolean(progress?.relationship_completed_at),intentionsComplete:Boolean(progress?.intentions_completed_at)},relationships:relationshipRows.results.map(row=>({id:row.id,slug:row.slug,name:row.name,description:row.description,selected:Boolean(row.is_selected)})),intentions:intentionRows.results.map(row=>({id:row.id,slug:row.slug,name:row.name,description:row.description,selected:Boolean(row.is_selected)}))});
  }

  if(path==='/api/onboarding/relationship'&&request.method==='POST'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const data=await readBody(request),relationshipId=String(data.relationshipId??'').trim();
    const relationship=await env.DB.prepare(\`SELECT id,name FROM relationship_options WHERE id=? AND is_active=1\`).bind(relationshipId).first<{id:string;name:string}>();
    if(!relationship)return json({ok:false,message:'Choose how you know Grev.'},{status:400});
    const now=Math.floor(Date.now()/1000);
    await env.DB.batch([
      env.DB.prepare(\`DELETE FROM group_memberships WHERE user_id=? AND group_id IN (SELECT group_id FROM relationship_group_grants)\`).bind(user.id),
      env.DB.prepare(\`INSERT INTO user_relationships(user_id,relationship_id,selected_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET relationship_id=excluded.relationship_id,updated_at=excluded.updated_at\`).bind(user.id,relationship.id,now,now),
      env.DB.prepare(\`INSERT OR IGNORE INTO group_memberships(group_id,user_id,assigned_by,assigned_at) SELECT group_id,?,?,? FROM relationship_group_grants WHERE relationship_id=?\`).bind(user.id,user.id,now,relationship.id),
      env.DB.prepare(\`INSERT INTO user_onboarding(user_id,relationship_completed_at,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET relationship_completed_at=excluded.relationship_completed_at,updated_at=excluded.updated_at\`).bind(user.id,now,now),
      audit(env,user.id,'account.relationship_selected','user',user.id,{relationshipId:relationship.id},now)
    ]);
    return json({ok:true,nextStage:'intentions',message:\`\${relationship.name} saved. Now choose what you want from Grev.dad.\`});
  }

  if(path==='/api/onboarding/intentions'&&request.method==='POST'){
    const user=await getSessionUser(request,env);if(!user)return json({ok:false,message:'Authentication required.'},{status:401});
    const data=await readBody(request),rawIds=data.intentionIds;
    if(!Array.isArray(rawIds)||rawIds.length<1||rawIds.length>20||rawIds.some(value=>typeof value!=='string'))return json({ok:false,message:'Choose at least one intention.'},{status:400});
    const intentionIds=[...new Set(rawIds.map(value=>value.trim()).filter(Boolean))];
    const activeRows=await env.DB.prepare(\`SELECT id FROM intention_options WHERE is_active=1\`).all<{id:string}>(),active=new Set(activeRows.results.map(row=>row.id));
    if(intentionIds.some(id=>!active.has(id)))return json({ok:false,message:'One or more intentions are unavailable.'},{status:400});
    const now=Math.floor(Date.now()/1000),statements:D1Statement[]=[
      env.DB.prepare(\`DELETE FROM user_intentions WHERE user_id=? AND intention_id IN (SELECT id FROM intention_options WHERE is_active=1)\`).bind(user.id),
      env.DB.prepare(\`DELETE FROM group_memberships WHERE user_id=? AND group_id IN (SELECT igg.group_id FROM intention_group_grants igg JOIN intention_options io ON io.id=igg.intention_id WHERE io.is_active=1)\`).bind(user.id)
    ];
    for(const intentionId of intentionIds){
      statements.push(env.DB.prepare(\`INSERT INTO user_intentions(user_id,intention_id,selected_at) VALUES(?,?,?)\`).bind(user.id,intentionId,now));
      statements.push(env.DB.prepare(\`INSERT OR IGNORE INTO group_memberships(group_id,user_id,assigned_by,assigned_at) SELECT group_id,?,?,? FROM intention_group_grants WHERE intention_id=?\`).bind(user.id,user.id,now,intentionId));
    }
    statements.push(env.DB.prepare(\`INSERT INTO user_onboarding(user_id,intentions_completed_at,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET intentions_completed_at=excluded.intentions_completed_at,updated_at=excluded.updated_at\`).bind(user.id,now,now));
    statements.push(audit(env,user.id,'account.intentions_updated','user',user.id,{intentionIds},now));
    await env.DB.batch(statements);
    return json({ok:true,next:'/dashboard',message:'Your Grev.dad interests and account groups have been updated.'});
  }

`;
index = replaceOrFail(index, "  if(path==='/api/intentions'&&request.method==='GET'){", onboardingApi + "  if(path==='/api/intentions'&&request.method==='GET'){", 'onboarding API insertion');
index = replaceOrFail(index, "    else if(path==='/access')response=redirect('/intentions');", "    else if(path==='/access')response=redirect('/settings');", 'access redirect');
index = replaceOrFail(index, "    else if(path==='/intentions')response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/intentions.html')):redirect('/login');", "    else if(path==='/intentions')response=redirect('/settings');\n    else if(path==='/settings')response=(await getSessionUser(request,env))?await env.ASSETS.fetch(assetRequest(request,'/settings.html')):redirect('/login');", 'settings route');
writeFileSync('src/index.ts', index);

let app = readFileSync('public/app.js', 'utf8');
app = replaceOrFail(app, "  location.replace(payload.next ?? '/intentions');", "  location.replace(payload.next ?? '/dashboard');", 'signup frontend redirect');
app = replaceOrFail(app, "  }\n}\n\nasync function loadProfile() {", "  }\n  await loadOnboardingModal();\n}\n\n" + `let onboardingState = null;

async function fetchOnboardingState() {
  const response = await fetch('/api/onboarding', { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message ?? 'Unable to load account setup.');
  onboardingState = payload;
  return payload;
}

function makeOnboardingChoice(option, type, name) {
  const label = document.createElement('label');
  label.className = \`onboarding-choice\${option.selected ? ' selected' : ''}\`;
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.value = option.id;
  input.checked = Boolean(option.selected);
  const marker = document.createElement('span');
  marker.className = 'onboarding-choice-marker';
  marker.textContent = option.selected ? 'Selected' : 'Select';
  const title = document.createElement('strong');
  title.textContent = option.name;
  const description = document.createElement('p');
  description.textContent = option.description;
  label.append(input, marker, title, description);
  input.addEventListener('change', () => {
    if (type === 'radio') {
      label.parentElement?.querySelectorAll('.onboarding-choice').forEach(card => card.classList.remove('selected'));
      label.parentElement?.querySelectorAll('.onboarding-choice-marker').forEach(item => { item.textContent = 'Select'; });
    }
    label.classList.toggle('selected', input.checked);
    marker.textContent = input.checked ? 'Selected' : 'Select';
  });
  return label;
}

function renderOnboardingChoices(target, options, type, name) {
  if (!target) return;
  target.replaceChildren(...options.map(option => makeOnboardingChoice(option, type, name)));
}

function showOnboardingStage(stage) {
  const relationshipForm = $('#onboarding-relationship-form');
  const intentionsForm = $('#onboarding-intentions-form');
  const step = $('#onboarding-step');
  const title = $('#onboarding-title');
  const description = $('#onboarding-description');
  if (!relationshipForm || !intentionsForm) return;
  const relationshipStage = stage === 'relationship';
  relationshipForm.hidden = !relationshipStage;
  intentionsForm.hidden = relationshipStage;
  if (step) step.textContent = relationshipStage ? 'Step 1 of 2' : 'Step 2 of 2';
  if (title) title.textContent = relationshipStage ? 'How do you know Grev?' : 'What are your intentions with Grev.dad?';
  if (description) description.textContent = relationshipStage
    ? 'Choose the option that best describes your relationship with Grev. This adds the matching account group.'
    : 'Choose everything that interests you. These selections add the matching account groups and shape what Grev.dad can show you.';
}

async function loadOnboardingModal() {
  const overlay = $('#onboarding-overlay');
  if (!overlay) return;
  const state = await fetchOnboardingState();
  if (state.progress.relationshipComplete && state.progress.intentionsComplete) {
    overlay.hidden = true;
    document.body.classList.remove('modal-open');
    return;
  }
  renderOnboardingChoices($('#onboarding-relationship-list'), state.relationships, 'radio', 'onboardingRelationship');
  renderOnboardingChoices($('#onboarding-intention-list'), state.intentions, 'checkbox', 'onboardingIntention');
  showOnboardingStage(state.progress.relationshipComplete ? 'intentions' : 'relationship');
  overlay.hidden = false;
  document.body.classList.add('modal-open');
}

$('#onboarding-relationship-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const selected = document.querySelector('input[name="onboardingRelationship"]:checked');
  if (!selected) return showTargetMessage('#onboarding-message', 'Choose how you know Grev.');
  showTargetMessage('#onboarding-message', 'Saving relationship…', true);
  const response = await fetch('/api/onboarding/relationship', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relationshipId: selected.value }) });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#onboarding-message', payload.message ?? 'Unable to save relationship.');
  const state = await fetchOnboardingState();
  renderOnboardingChoices($('#onboarding-intention-list'), state.intentions, 'checkbox', 'onboardingIntention');
  showTargetMessage('#onboarding-message', '', true);
  showOnboardingStage('intentions');
});

$('#onboarding-intentions-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const intentionIds = [...document.querySelectorAll('input[name="onboardingIntention"]:checked')].map(input => input.value);
  if (!intentionIds.length) return showTargetMessage('#onboarding-message', 'Choose at least one intention.');
  showTargetMessage('#onboarding-message', 'Saving intentions…', true);
  const response = await fetch('/api/onboarding/intentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentionIds }) });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#onboarding-message', payload.message ?? 'Unable to save intentions.');
  $('#onboarding-overlay').hidden = true;
  document.body.classList.remove('modal-open');
  showTargetMessage('#onboarding-message', '', true);
});

async function loadSettings() {
  if (!$('#settings-relationship-list')) return;
  const state = await fetchOnboardingState();
  renderOnboardingChoices($('#settings-relationship-list'), state.relationships, 'radio', 'settingsRelationship');
  renderOnboardingChoices($('#settings-intention-list'), state.intentions, 'checkbox', 'settingsIntention');
}

$('#settings-relationship-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const selected = document.querySelector('input[name="settingsRelationship"]:checked');
  if (!selected) return showTargetMessage('#settings-relationship-message', 'Choose how you know Grev.');
  const response = await fetch('/api/onboarding/relationship', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ relationshipId: selected.value }) });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#settings-relationship-message', payload.message ?? 'Unable to save relationship.');
  showTargetMessage('#settings-relationship-message', payload.message, true);
  await loadSettings();
});

$('#settings-intentions-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const intentionIds = [...document.querySelectorAll('input[name="settingsIntention"]:checked')].map(input => input.value);
  if (!intentionIds.length) return showTargetMessage('#settings-intentions-message', 'Choose at least one intention.');
  const response = await fetch('/api/onboarding/intentions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentionIds }) });
  const payload = await response.json();
  if (!response.ok) return showTargetMessage('#settings-intentions-message', payload.message ?? 'Unable to save intentions.');
  showTargetMessage('#settings-intentions-message', payload.message, true);
  await loadSettings();
});

async function loadProfile() {`, 'dashboard onboarding insertion');
app = replaceOrFail(app, "  const ownProfile = $('#own-profile-note');\n  if (ownProfile) ownProfile.hidden = !profile.isSelf;", "  const ownProfile = $('#own-profile-note');\n  if (ownProfile) ownProfile.hidden = !profile.isSelf;\n  const settingsLink = $('#profile-settings-link');\n  if (settingsLink) settingsLink.hidden = !profile.isSelf;", 'profile settings link');
app = app + "\nloadSettings().catch(error => { if ($('#settings-error')) $('#settings-error').textContent = error.message; });\n";
writeFileSync('public/app.js', app);

writeFileSync('public/dashboard.html', `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard · Grev.dad</title><link rel="stylesheet" href="/styles.css"></head>
<body>
<header><strong>Grev.dad</strong><div><a id="owner-setup-link" class="header-link" href="/owner-setup" hidden>Owner setup</a><a id="admin-link" class="header-link" href="/admin" hidden>Admin centre</a><a class="header-link" href="/settings">Profile settings</a><a class="header-link" href="/profile">My profile</a><span id="badge">Checking…</span><button id="logout">Log out</button></div></header>
<main class="dashboard">
<p class="eyebrow">Member dashboard</p><h1>Welcome, <span id="name">member</span>.</h1><p>Your relationship and interest groups determine which Grev.dad areas and policies apply to your account.</p>
<section class="grid">
<article id="owner-setup-card" hidden><small>One-time setup</small><h2>Configure the Owner</h2><p>This sole account can securely become the Grev.dad Owner after confirming its password.</p><a class="action-link" href="/owner-setup">Start Owner setup</a></article>
<article><small>Account groups</small><h2>Your access profile</h2><p>Review how you know Grev and the Grev.dad interests attached to your account.</p><a class="action-link" href="/settings">Open profile settings</a></article>
<article><small>Permanent profile</small><h2>Stable profile URL</h2><p>Your profile address uses your permanent account ID, so it never changes when your username changes.</p><a id="profile-link" class="action-link" href="/profile">View profile</a></article>
<article><small>Username</small><h2 id="username">—</h2><form id="username-form" class="compact-form"><label>Change username<input id="username-input" name="username" required minlength="3" maxlength="24"></label><button type="submit">Save username</button></form><p id="username-message" role="status"></p></article>
<article><small>Verification</small><h2>Account status</h2><p id="verification">Checking verification…</p></article>
<article><small>Policy access</small><h2>Group-based permissions</h2><p>Relationship, interest, private and administrative groups can all be targeted by Grev.dad policies.</p></article>
</section>
</main>
<div id="onboarding-overlay" class="onboarding-overlay" hidden>
<section class="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
<div class="onboarding-heading"><span id="onboarding-step">Step 1 of 2</span><strong>ACCOUNT SETUP</strong></div>
<h2 id="onboarding-title">How do you know Grev?</h2>
<p id="onboarding-description"></p>
<form id="onboarding-relationship-form"><div id="onboarding-relationship-list" class="onboarding-choice-grid"></div><button type="submit">Continue</button></form>
<form id="onboarding-intentions-form" hidden><div id="onboarding-intention-list" class="onboarding-choice-grid"></div><button type="submit">Finish account setup</button></form>
<p id="onboarding-message" role="status"></p>
</section>
</div>
<script src="/app.js" defer></script>
</body></html>`);

writeFileSync('public/profile.html', `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile · Grev.dad</title><link rel="stylesheet" href="/styles.css"></head>
<body>
<header><strong>Grev.dad</strong><div><a class="header-link" href="/dashboard">Dashboard</a><a id="profile-settings-link" class="header-link" href="/settings" hidden>Profile settings</a><button id="logout">Log out</button></div></header>
<main class="dashboard profile-page">
<p class="eyebrow">Member profile</p>
<section class="profile-hero">
<div class="profile-avatar" aria-hidden="true">G</div>
<div><div id="profile-badge" class="profile-badge">Checking…</div><h1 id="profile-name">Loading…</h1><p id="profile-username">—</p></div>
</section>
<section class="grid profile-grid">
<article><small>Account status</small><h2 id="profile-status">Loading…</h2><p id="own-profile-note" hidden>This is your permanent profile URL. Your relationship and interest groups can be changed from profile settings.</p></article>
<article><small>Member since</small><h2 id="profile-member-since">—</h2><p>Profile content and custom tiles will be added after the account foundation is complete.</p></article>
<article><small>Profile address</small><h2>Permanent link</h2><p>This URL is attached to the account ID rather than the username.</p></article>
</section>
</main>
<script src="/app.js" defer></script>
</body></html>`);

writeFileSync('public/settings.html', `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile settings · Grev.dad</title><link rel="stylesheet" href="/styles.css"></head>
<body>
<header><strong>Grev.dad</strong><div><a class="header-link" href="/dashboard">Dashboard</a><a class="header-link" href="/profile">My profile</a><button id="logout">Log out</button></div></header>
<main class="dashboard settings-page">
<p class="eyebrow">Profile settings</p>
<h1>Your account groups.</h1>
<p>These are self-service account groups. Policies can use them to decide which Grev.dad areas, tiles and features are available. Hidden private groups are controlled separately by administrators.</p>
<p id="settings-error" class="error" role="status"></p>
<section class="settings-grid">
<article class="settings-panel">
<span class="settings-number">01</span><h2>How do you know Grev?</h2><p>Choose one relationship. Saving replaces your previous relationship group.</p>
<form id="settings-relationship-form"><div id="settings-relationship-list" class="onboarding-choice-grid"></div><button type="submit">Save relationship</button><p id="settings-relationship-message" role="status"></p></form>
</article>
<article class="settings-panel">
<span class="settings-number">02</span><h2>What are your intentions with Grev.dad?</h2><p>Choose every interest that applies. Saving updates your interest group memberships.</p>
<form id="settings-intentions-form"><div id="settings-intention-list" class="onboarding-choice-grid"></div><button type="submit">Save intentions</button><p id="settings-intentions-message" role="status"></p></form>
</article>
</section>
</main>
<script src="/app.js" defer></script>
</body></html>`);

let styles = readFileSync('public/styles.css', 'utf8');
styles += `

body.modal-open{overflow:hidden}
.onboarding-overlay{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:rgba(3,5,8,.88);backdrop-filter:blur(3px)}
.onboarding-dialog{width:min(980px,100%);max-height:calc(100vh - 48px);overflow:auto;padding:34px;border:1px solid var(--line-strong);background:#0d1015;box-shadow:14px 14px 0 #000}
.onboarding-heading{display:flex;justify-content:space-between;gap:20px;padding-bottom:14px;border-bottom:1px solid var(--line);color:var(--accent-strong);font-size:.75rem;font-weight:950;letter-spacing:.15em}
.onboarding-dialog h2{margin:26px 0 10px;font-size:clamp(2.2rem,6vw,4.4rem);line-height:.95;letter-spacing:-.045em}
.onboarding-dialog>p{color:var(--muted);line-height:1.65}
.onboarding-dialog form{margin-top:26px}
.onboarding-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.onboarding-choice{position:relative;display:block;min-height:155px;padding:20px;border:1px solid var(--line);background:var(--panel);cursor:pointer;transition:transform .14s ease,border-color .14s ease,background .14s ease}
.onboarding-choice:hover{transform:translate(-2px,-2px);border-color:var(--line-strong);box-shadow:5px 5px 0 #000}
.onboarding-choice.selected{border-color:var(--accent);background:#121827;box-shadow:inset 5px 0 0 var(--accent)}
.onboarding-choice input{position:absolute;opacity:0;pointer-events:none}
.onboarding-choice-marker{display:block;color:#98a4b5;font-size:.7rem;font-weight:950;letter-spacing:.13em;text-transform:uppercase}
.onboarding-choice.selected .onboarding-choice-marker{color:var(--accent-strong)}
.onboarding-choice strong{display:block;margin:20px 0 8px;font-size:1.35rem}
.onboarding-choice p{margin:0;color:var(--muted);font-weight:500;line-height:1.5}
#onboarding-message{min-height:28px;margin:12px 0 0;padding:0}
.settings-page>h1{max-width:900px}
.settings-grid{display:grid;gap:16px;margin-top:38px}
.settings-panel{position:relative;padding:28px;border:1px solid var(--line-strong);background:var(--panel)}
.settings-panel::before{content:"";position:absolute;top:-1px;left:-1px;width:70px;height:4px;background:var(--accent)}
.settings-number{color:var(--accent-strong);font-size:.75rem;font-weight:950;letter-spacing:.16em}
.settings-panel h2{margin:16px 0 8px;font-size:2rem}
.settings-panel>p{color:var(--muted);line-height:1.6}
.settings-panel form{margin-top:24px}
@media(max-width:800px){.onboarding-dialog{padding:24px}.onboarding-choice-grid{grid-template-columns:1fr}.onboarding-choice{min-height:135px}}
`;
writeFileSync('public/styles.css', styles);

rmSync('scripts/apply-two-stage-onboarding.mjs');
rmSync('.github/workflows/apply-two-stage-onboarding.yml');
