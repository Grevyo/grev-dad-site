(() => {
  const state={dialog:null,cache:new Map(),activeId:null};
  function ensureDialog(){
    if(state.dialog)return state.dialog;
    const dialog=document.createElement('dialog');dialog.id='global-profile-card-popover';dialog.className='global-profile-card-popover';dialog.setAttribute('aria-label','Member profile card');
    dialog.innerHTML=`<div class="global-profile-card-shell"><button class="global-profile-card-close" type="button" aria-label="Close profile card">Close</button><div class="global-profile-card-host" data-popover-card-host><div class="global-profile-card-loading">Loading profile…</div></div><a class="global-profile-card-open" data-popover-open href="/profile">Open full profile</a><p class="global-profile-card-message" data-popover-message role="status"></p></div>`;
    document.body.append(dialog);dialog.querySelector('.global-profile-card-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});state.dialog=dialog;return dialog;
  }
  function renderProfile(profileCard){
    const dialog=ensureDialog(),host=dialog.querySelector('[data-popover-card-host]');
    if(!window.GrevProfileCardBaseline?.createScaled)throw new Error('The canonical profile card is unavailable.');
    host.replaceChildren(window.GrevProfileCardBaseline.createScaled(profileCard,{className:'global-profile-card',frameClassName:'global-profile-card-frame'}));
    dialog.querySelector('[data-popover-open]').href=`/profile/${encodeURIComponent(profileCard.id)}`;dialog.querySelector('[data-popover-message]').textContent='';
  }
  async function fetchProfileCard(profileId){
    const cached=state.cache.get(profileId);if(cached&&Date.now()-cached.at<60000)return cached.profileCard;
    const response=await fetch(`/api/profile-cards/${encodeURIComponent(profileId)}`,{cache:'no-store'}),payload=await response.json();
    if(!response.ok||!payload.profileCard)throw new Error(payload.message??'Profile card unavailable.');
    state.cache.set(profileId,{profileCard:payload.profileCard,at:Date.now()});return payload.profileCard;
  }
  async function openProfileCard(profileId){
    const dialog=ensureDialog();state.activeId=profileId;dialog.querySelector('[data-popover-card-host]').innerHTML='<div class="global-profile-card-loading">Loading profile…</div>';dialog.querySelector('[data-popover-message]').textContent='';if(!dialog.open)dialog.showModal();
    try{const profileCard=await fetchProfileCard(profileId);if(state.activeId===profileId)renderProfile(profileCard);}catch(error){dialog.querySelector('[data-popover-card-host]').replaceChildren();dialog.querySelector('[data-popover-message]').textContent=error.message;}
  }
  function profileTarget(event){const target=event.target instanceof Element?event.target.closest('[data-profile-user-id]'):null;return !target||target.closest('#global-profile-card-popover')?null:target;}
  document.addEventListener('click',event=>{const target=profileTarget(event);if(!target)return;const profileId=target.dataset.profileUserId;if(!profileId)return;if(target instanceof HTMLAnchorElement&&(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey))return;event.preventDefault();event.stopPropagation();openProfileCard(profileId);});
  document.addEventListener('keydown',event=>{const target=event.target instanceof Element?event.target.closest('[data-profile-user-id]'):null;if(!target||!['Enter',' '].includes(event.key))return;event.preventDefault();openProfileCard(target.dataset.profileUserId);});
  const observer=new MutationObserver(()=>{document.querySelectorAll('[data-profile-user-id]:not(button):not(a)').forEach(element=>{if(!element.hasAttribute('tabindex'))element.tabIndex=0;if(!element.hasAttribute('role'))element.setAttribute('role','button');if(!element.hasAttribute('aria-label'))element.setAttribute('aria-label','Open mini profile card');});});observer.observe(document.documentElement,{childList:true,subtree:true});
})();
