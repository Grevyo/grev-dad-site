(() => {
  const state={members:[],search:'',filter:'all'};
  const $=selector=>document.querySelector(selector);
  const initials=value=>String(value||'Member').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'M';
  const role=member=>member.owner?'Owner':member.admin?'Administrator':member.verified?'Verified member':'Member';
  const visibleMembers=()=>{const term=state.search.toLowerCase();return state.members.filter(member=>{
    const matches=!term||[member.displayName,member.username,member.profile?.headline,member.profile?.bio,member.profile?.location,member.presence?.statusText,member.presence?.activityText].filter(Boolean).join(' ').toLowerCase().includes(term);
    const filter=state.filter==='all'||(state.filter==='online'&&member.presence?.availability==='online')||(state.filter==='verified'&&member.verified)||(state.filter==='staff'&&(member.owner||member.admin));
    return matches&&filter;
  });};
  function card(member){
    const article=document.createElement('article');article.className='member-card';
    const colours=member.profile?.colours||{};article.style.setProperty('--member-primary',colours.primary||'#11161d');article.style.setProperty('--member-secondary',colours.secondary||'#3157c9');article.style.setProperty('--member-text',colours.text||'#f4f7fb');article.style.setProperty('--member-border',colours.border||'#394657');
    const header=document.createElement('div');header.className='member-card-header';
    const avatar=document.createElement('div');avatar.className='member-avatar';if(member.profile?.avatar){const image=document.createElement('img');image.src=member.profile.avatar;image.alt=`${member.displayName} profile picture`;image.loading='lazy';avatar.append(image);}else avatar.textContent=initials(member.displayName);
    const presence=document.createElement('span');presence.className=`member-presence ${member.presence?.availability||'offline'}`;presence.textContent=member.presence?.availability==='hidden'?'Private':member.presence?.availability||'offline';header.append(avatar,presence);
    const body=document.createElement('div');body.className='member-card-body';const name=document.createElement('h2');name.textContent=member.displayName;body.append(name);
    if(member.username){const username=document.createElement('span');username.className='member-username';username.textContent=`@${member.username}`;body.append(username);}
    const badges=document.createElement('div');badges.className='member-badges';[role(member),member.presence?.statusText].filter(Boolean).forEach(text=>{const badge=document.createElement('span');badge.className='member-badge';badge.textContent=text;badges.append(badge);});body.append(badges);
    if(member.profile?.headline){const headline=document.createElement('p');headline.className='member-headline';headline.textContent=member.profile.headline;body.append(headline);}
    if(member.profile?.bio){const bio=document.createElement('p');bio.className='member-bio';bio.textContent=member.profile.bio;body.append(bio);}
    const meta=document.createElement('div');meta.className='member-meta';if(member.profile?.location){const location=document.createElement('span');location.textContent=`📍 ${member.profile.location}`;meta.append(location);}if(member.presence?.activityText){const activity=document.createElement('span');activity.textContent=`${member.presence.activityType||'doing'} · ${member.presence.activityText}`;meta.append(activity);}body.append(meta);
    const actions=document.createElement('div');actions.className='member-card-actions';const link=document.createElement('a');link.href=`/profile/${encodeURIComponent(member.id)}`;link.textContent='Open profile';const since=document.createElement('span');since.textContent=member.memberSince?`Member since ${new Date(member.memberSince*1000).toLocaleDateString([],{month:'short',year:'numeric'})}`:'';actions.append(link,since);body.append(actions);
    article.append(header,body);return article;
  }
  function render(){const grid=$('#members-grid'),items=visibleMembers();$('#members-count').textContent=`${items.length} of ${state.members.length} members`;grid.replaceChildren(...(items.length?items.map(card):[Object.assign(document.createElement('p'),{className:'members-empty',textContent:'No members match those filters.'})]));}
  async function init(){try{const response=await fetch('/api/members',{cache:'no-store'}),payload=await response.json();if(!response.ok)throw new Error(payload.message||'Members could not be loaded.');state.members=payload.members||[];$('#members-status').textContent='';render();}catch(error){$('#members-status').textContent=error.message;$('#members-status').className='members-status error';}}
  $('#members-search')?.addEventListener('input',event=>{state.search=event.currentTarget.value.trim();render();});
  $('#members-filter')?.addEventListener('change',event=>{state.filter=event.currentTarget.value;render();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
