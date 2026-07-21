(() => {
  const state={members:[],search:'',filter:'all'};
  const $=selector=>document.querySelector(selector);
  const visibleMembers=()=>{const term=state.search.toLowerCase();return state.members.filter(member=>{
    const card=member.card||{};
    const matches=!term||[member.displayName,member.username,card.headline,card.bio,card.location,member.presence?.statusText,member.presence?.activityText].filter(Boolean).join(' ').toLowerCase().includes(term);
    const filter=state.filter==='all'||(state.filter==='online'&&member.presence?.availability==='online')||(state.filter==='verified'&&member.isVerified===true)||(state.filter==='staff'&&(member.isOwner===true||member.isAdmin===true));
    return matches&&filter;
  });};

  function card(member){
    if(!window.GrevProfileCardBaseline?.create)throw new Error('The baseline profile-card component did not load.');
    const entry=document.createElement('section');entry.className='member-profile-entry';
    const profileCard=window.GrevProfileCardBaseline.create(member,{className:'member-profile-card',variant:'directory'});
    profileCard.dataset.memberId=member.id;
    const action=document.createElement('a');
    action.className='member-profile-open';
    action.href=`/profile/${encodeURIComponent(member.id)}`;
    action.textContent='Open full profile';
    action.setAttribute('aria-label',`Open ${member.displayName} profile`);
    entry.append(profileCard,action);
    return entry;
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
      if(payload.contract!=='profile-card-baseline-v2')throw new Error('The Members page received an outdated profile-card format.');
      state.members=payload.members||[];$('#members-status').textContent='';render();
    }catch(error){$('#members-status').textContent=error.message;$('#members-status').className='members-status error';}
  }
  $('#members-search')?.addEventListener('input',event=>{state.search=event.currentTarget.value.trim();render();});
  $('#members-filter')?.addEventListener('change',event=>{state.filter=event.currentTarget.value;render();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();