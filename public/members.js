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
    if(!window.GrevProfileCardBaseline?.createScaled)throw new Error('The canonical profile-card scaler did not load.');
    const href=`/profile/${encodeURIComponent(member.id)}`;
    const frame=window.GrevProfileCardBaseline.createScaled(member,{className:'member-profile-card',frameClassName:'member-profile-entry'});
    frame.dataset.memberId=member.id;
    frame.tabIndex=0;
    frame.setAttribute('role','link');
    frame.setAttribute('aria-label',`Open ${member.displayName} profile`);
    frame.addEventListener('click',event=>{
      const target=event.target instanceof Element?event.target:null;
      if(target?.closest('a,button,input,select,textarea,[role="button"]'))return;
      location.assign(href);
    });
    frame.addEventListener('keydown',event=>{
      if(event.target!==frame||!['Enter',' '].includes(event.key))return;
      event.preventDefault();
      location.assign(href);
    });
    return frame;
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
