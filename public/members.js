(() => {
  const state={members:[],search:'',filter:'all'};
  const $=selector=>document.querySelector(selector);
  const visibleMembers=()=>{const term=state.search.toLowerCase();return state.members.filter(member=>{
    const card=member.card||{};
    const matches=!term||[member.displayName,member.username,card.headline,card.bio,card.location,member.presence?.statusText,member.presence?.activityText].filter(Boolean).join(' ').toLowerCase().includes(term);
    const filter=state.filter==='all'||(state.filter==='online'&&member.presence?.availability==='online')||(state.filter==='verified'&&member.isVerified===true)||(state.filter==='staff'&&(member.isOwner===true||member.isAdmin===true));
    return matches&&filter;
  });};

  function presenceNode(member){
    const availability=member.presence?.availability||'offline';
    if(availability==='hidden')return null;
    const wrap=document.createElement('div');wrap.className='member-profile-presence-wrap';
    const presence=document.createElement('span');presence.className=`member-presence ${availability}`;presence.textContent=availability;wrap.append(presence);
    const detail=member.presence?.activityText||member.presence?.statusText;
    if(detail){const text=document.createElement('span');text.className='member-presence-detail';text.textContent=detail;wrap.append(text);}
    return wrap;
  }

  function card(member){
    if(!window.GrevProfileCardBaseline?.create)throw new Error('The baseline profile-card component did not load.');
    const article=window.GrevProfileCardBaseline.create(member,{className:'member-profile-card',variant:'directory'});
    article.dataset.memberId=member.id;
    const footer=document.createElement('footer');footer.className='member-profile-card-footer';
    const presence=presenceNode(member);
    if(presence)footer.append(presence);else{const privateText=document.createElement('span');privateText.className='member-profile-private';privateText.textContent='Presence private';footer.append(privateText);}
    const link=document.createElement('a');link.href=`/profile/${encodeURIComponent(member.id)}`;link.textContent='Open full profile';link.setAttribute('aria-label',`Open ${member.displayName} profile`);footer.append(link);
    article.append(footer);return article;
  }

  function render(){
    const grid=$('#members-grid'),items=visibleMembers();$('#members-count').textContent=`${items.length} of ${state.members.length} members`;
    try{grid.replaceChildren(...(items.length?items.map(card):[Object.assign(document.createElement('p'),{className:'members-empty',textContent:'No members match those filters.'})]));}
    catch(error){$('#members-status').textContent=error.message;$('#members-status').className='members-status error';}
  }

  async function init(){
    try{
      const response=await fetch('/api/members',{cache:'no-store'}),payload=await response.json();
      if(!response.ok)throw new Error(payload.message||'Members could not be loaded.');
      if(payload.contract!=='profile-card-baseline-v1')throw new Error('The Members page received an outdated profile-card format.');
      state.members=payload.members||[];$('#members-status').textContent='';render();
    }catch(error){$('#members-status').textContent=error.message;$('#members-status').className='members-status error';}
  }
  $('#members-search')?.addEventListener('input',event=>{state.search=event.currentTarget.value.trim();render();});
  $('#members-filter')?.addEventListener('change',event=>{state.filter=event.currentTarget.value;render();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();