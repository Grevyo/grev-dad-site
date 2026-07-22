(() => {
  const FEATURE_ID='feature-grev-news';
  let modelPromise=null;
  let observer=null;

  async function request(url,options={}){
    const response=await fetch(url,{cache:'no-store',...options});
    const payload=await response.json();
    if(!response.ok)throw new Error(payload.message||'Unable to load your news subscriptions.');
    return payload;
  }
  function model(){return modelPromise??=(request('/api/news/subscriptions').catch(error=>{modelPromise=null;throw error;}));}
  function optionsFor(payload){
    const result=[{value:'subscribed',label:'My subscriptions'}];
    if(payload.subscriptions?.grev)result.push({value:'grev',label:'Grev News'});
    if(payload.subscriptions?.cs2)result.push({value:'cs2',label:'CS2 updates'});
    for(const team of payload.subscriptions?.teams??[])result.push({value:`team:${team.key}`,label:team.label});
    return result;
  }
  async function updateHeadline(tile,scope){
    const headline=tile.querySelector('.dashboard-news-headline');
    const label=tile.querySelector('.dashboard-content-label');
    const content=tile.querySelector('.dashboard-news-tile');
    if(label)label.textContent='YOUR NEWS';
    if(headline)headline.textContent='Loading your latest news…';
    try{
      const payload=await request(`/api/news/personalized?scope=${encodeURIComponent(scope)}&limit=1`);
      const post=payload.posts?.[0];
      if(headline)headline.textContent=post?.title||'No news has been published for this subscription yet.';
      if(content instanceof HTMLAnchorElement)content.href=`/news?scope=${encodeURIComponent(scope)}`;
    }catch(error){if(headline)headline.textContent=error.message;}
  }
  async function enhance(){
    const tile=document.querySelector(`.dashboard-tile[data-feature-id="${FEATURE_ID}"]`);
    const content=tile?.querySelector('.dashboard-news-tile');
    if(!tile||!content||!(content instanceof HTMLAnchorElement))return;
    if(tile.querySelector('.dashboard-news-filter'))return;
    try{
      const payload=await model();
      if(!tile.isConnected||tile.querySelector('.dashboard-news-filter'))return;
      const shell=document.createElement('label');shell.className='dashboard-news-filter';shell.textContent='Show';
      const select=document.createElement('select');select.setAttribute('aria-label','Choose which subscribed news appears in this tile');
      for(const option of optionsFor(payload)){const node=document.createElement('option');node.value=option.value;node.textContent=option.label;select.append(node);}
      select.value=[...select.options].some(option=>option.value===payload.dashboardFilter)?payload.dashboardFilter:'subscribed';
      for(const eventName of ['pointerdown','mousedown','click'])select.addEventListener(event=>{event.stopPropagation();if(eventName==='click')event.preventDefault();});
      select.addEventListener('change',async event=>{
        event.stopPropagation();
        const scope=select.value;
        select.disabled=true;
        try{
          await request('/api/news/dashboard-preference',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({scope})});
          payload.dashboardFilter=scope;
          await updateHeadline(tile,scope);
        }catch(error){console.error(error);}finally{select.disabled=false;}
      });
      shell.append(select);
      const headline=content.querySelector('.dashboard-news-headline');
      if(headline)headline.before(shell);else content.append(shell);
      await updateHeadline(tile,select.value);
    }catch(error){console.error(error);}
  }
  function start(){
    void enhance();
    const grid=document.querySelector('#dashboard-grid');
    if(grid){observer?.disconnect();observer=new MutationObserver(()=>void enhance());observer.observe(grid,{childList:true,subtree:true});}
    document.addEventListener('grev:news-subscriptions-changed',()=>{modelPromise=null;document.querySelectorAll('.dashboard-news-filter').forEach(node=>node.remove());void enhance();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
