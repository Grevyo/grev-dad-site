(() => {
  const state={members:[],search:'',filter:'all'};
  const $=selector=>document.querySelector(selector);
  const cardFor=member=>member.profile?.card||{};
  const visibleMembers=()=>{const term=state.search.toLowerCase();return state.members.filter(member=>{
    const card=cardFor(member);
    const matches=!term||[card.displayName,member.username,card.headline,card.bio,card.location,member.presence?.statusText,member.presence?.activityText].filter(Boolean).join(' ').toLowerCase().includes(term);
    const filter=state.filter==='all'||(state.filter==='online'&&member.presence?.availability==='online')||(state.filter==='verified'&&member.verified===true)||(state.filter==='staff'&&(member.owner===true||member.admin===true));
    return matches&&filter;
  });};

  function presenceNode(member){
    const availability=member.presence?.availability||'offline';
    if(availability==='hidden')return null;
    const wrap=document.createElement('div');wrap.className='member-profile-presence-wrap';
    const presence=document.createElement('span');presence.className=`member-presence ${availability}`;presence.textContent=availability;
    wrap.append(presence);
    const detail=member.presence?.activityText||member.presence?.statusText;
    if(detail){const text=document.createElement('span');text.className='member-presence-detail';text.textContent=detail;wrap.append(text);}
    return wrap;
  }

  function card(member){
    if(!window.GrevProfileCard?.create)throw new Error('The shared profile-card component did not load.');
    const profile={
      username:member.username,
      isOwner:member.owner===true,
      isAdmin:member.admin===true,
      isVerified:member.verified===true,
      createdAt:member.memberSince,
      card:member.profile?.card,
      design:member.profile?.design
    };
    const article=window.GrevProfileCard.create(profile,{className:'member-profile-card',variant:'directory'});
    article.dataset.memberId=member.id;

    const footer=document.createElement('footer');footer.className='member-profile-card-footer';
    const presence=presenceNode(member);
    if(presence)footer.append(presence);
    else{const spacer=document.createElement('span');spacer.className='member-profile-private';spacer.textContent='Presence private';footer.append(spacer);}
    const link=document.createElement('a');link.href=`/profile/${encodeURIComponent(member.id)}`;link.textContent='Open full profile';link.setAttribute('aria-label',`Open ${member.displayName} profile`);footer.append(link);
    article.append(footer);
    return article;
  }

  function render(){
    const grid=$('#members-grid'),items=visibleMembers();
    $('#members-count').textContent=`${items.length} of ${state.members.length} members`;
    try{
      grid.replaceChildren(...(items.length?items.map(card):[Object.assign(document.createElement('p'),{className:'members-empty',textContent:'No members match those filters.'})]));
    }catch(error){
      $('#members-status').textContent=error.message;
      $('#members-status').className='members-status error';
    }
  }

  async function init(){
    try{
      const response=await fetch('/api/members',{cache:'no-store'}),payload=await response.json();
      if(!response.ok)throw new Error(payload.message||'Members could not be loaded.');
      state.members=payload.members||[];
      $('#members-status').textContent='';
      render();
    }catch(error){
      $('#members-status').textContent=error.message;
      $('#members-status').className='members-status error';
    }
  }
  $('#members-search')?.addEventListener('input',event=>{state.search=event.currentTarget.value.trim();render();});
  $('#members-filter')?.addEventListener('change',event=>{state.filter=event.currentTarget.value;render();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();