(() => {
  const header=document.querySelector('body>header');
  if(!header||header.dataset.globalShell==='true')return;
  header.dataset.globalShell='true';
  const original=header.innerHTML;
  const originalHeaderControls=[...header.querySelectorAll('[id]')].map(node=>node.cloneNode(true));
  const path=location.pathname;
  const active=href=>path===href||path.startsWith(`${href}/`)?' active':'';
  const extrasActive=path==='/news'||path.startsWith('/news/')||path==='/hub'||path.startsWith('/hub/');
  header.className='global-site-header';
  header.innerHTML=`
    <a class="global-site-brand" href="/dashboard" aria-label="Grev.dad dashboard"><img src="/grev-dad-logo.svg" alt="Grev.dad"><strong class="global-site-brand-title" data-site-title>Grev.dad</strong><small data-site-environment></small></a>
    <nav class="global-site-nav" aria-label="Main navigation">
      <a class="header-link${active('/dashboard')}" href="/dashboard">Dashboard</a>
      <details id="global-extras-menu" class="global-extras-menu${extrasActive?' active':''}">
        <summary class="header-link">Extras</summary>
        <div class="global-extras-panel">
          <a id="global-news-link" class="global-extras-link${active('/news')}" href="/news"><strong>Grev News</strong><small>Your subscribed news feed</small></a>
          <a id="global-news-subscriptions-link" class="global-extras-link" href="/news#subscriptions"><strong>News subscriptions</strong><small>Choose CS2 updates and teams</small></a>
          <a id="global-content-hub-link" class="global-extras-link${active('/hub')}" href="/hub"><strong>Content</strong><small>Shared posts and community content</small></a>
        </div>
      </details>
      <a id="global-members-link" class="header-link${active('/members')}" href="/members">Members</a>
      <a id="profile-link" class="header-link${active('/profile')}" href="/profile">My profile</a>
      <a class="header-link${active('/settings')}" href="/settings">Settings</a>
      <a id="admin-link" class="header-link${active('/admin')}" href="/admin" hidden>Admin centre</a>
    </nav>
    <div class="global-header-actions"><span id="global-header-notice" class="global-header-notice" hidden></span><span id="badge" class="global-account-badge">Member</span><button id="logout" type="button">Log out</button></div>`;
  const compatibility=document.createElement('div');
  compatibility.className='global-header-compat';
  compatibility.hidden=true;
  for(const node of originalHeaderControls){if(node.id&&!document.getElementById(node.id))compatibility.append(node);}
  if(compatibility.children.length)header.append(compatibility);

  function closeExtras(){const menu=header.querySelector('#global-extras-menu');if(menu instanceof HTMLDetailsElement)menu.open=false;}
  document.addEventListener('pointerdown',event=>{const menu=header.querySelector('#global-extras-menu');if(menu instanceof HTMLDetailsElement&&menu.open&&!menu.contains(event.target))menu.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeExtras();});
  header.querySelectorAll('.global-extras-link').forEach(link=>link.addEventListener('click',closeExtras));

  function ensureAdminTabs(isAdmin){
    let tabs=document.querySelector('.admin-global-tabs');
    if(!isAdmin||!path.startsWith('/admin')){tabs?.remove();return;}
    if(tabs)return;
    tabs=document.createElement('nav');
    tabs.className='admin-global-tabs';
    tabs.setAttribute('aria-label','Admin centre sections');
    const links=[['overview','Overview'],['accounts','Accounts'],['default-dashboard','Default dashboard'],['features','Dashboard features'],['news','Grev News'],['groups','Groups & access'],['chat','Chat & communities'],['progression','Achievements & XP'],['settings','Settings & audit']];
    for(const[id,label]of links){const link=document.createElement('a');link.href=id==='features'?'/admin/dashboard':id==='news'?'/admin/news':`/admin#${id}`;link.textContent=label;if((id==='features'&&path==='/admin/dashboard')||(id==='news'&&path==='/admin/news')||(path==='/admin'&&(location.hash.slice(1)||'overview')===id))link.classList.add('active');tabs.append(link);}
    header.insertAdjacentElement('afterend',tabs);
  }

  async function logout(){await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});location.replace('/');}
  header.querySelector('#logout')?.addEventListener('click',logout);

  async function init(){
    try{
      const [sessionResponse,settingsResponse]=await Promise.all([fetch('/api/auth/session',{cache:'no-store'}),fetch('/api/site/settings',{cache:'no-store'})]);
      const session=await sessionResponse.json();
      if(!session.authenticated||!session.user){header.innerHTML=original;header.className='';header.dataset.globalShell='false';return;}
      const user=session.user;
      const settings=settingsResponse.ok?(await settingsResponse.json()).settings:null;
      const title=settings?.siteTitle||'Grev.dad';
      header.querySelector('[data-site-title]').textContent=title;
      const logo=header.querySelector('.global-site-brand img');if(logo)logo.alt=title;
      document.querySelector('#admin-link').hidden=!user.isAdmin;
      document.querySelector('#profile-link').href=`/profile/${encodeURIComponent(user.id)}`;
      const badge=document.querySelector('#badge');
      if(badge)badge.textContent=user.isOwner?'Owner':user.isAdmin?'Administrator':user.isVerified?'Verified':'Member';
      const environment=header.querySelector('[data-site-environment]');
      if(environment)environment.textContent=location.hostname.startsWith('pbe.')?'PBE':'';
      const notice=header.querySelector('#global-header-notice');
      if(notice&&settings?.headerNotice){notice.textContent=settings.headerNotice;notice.hidden=false;}
      ensureAdminTabs(Boolean(user.isAdmin));
      document.dispatchEvent(new CustomEvent('grev:global-header-ready',{detail:{user,settings}}));
    }catch{header.querySelector('[data-site-title]').textContent='Grev.dad';}
  }
  init();
  addEventListener('hashchange',()=>ensureAdminTabs(!document.querySelector('#admin-link')?.hidden));
})();
