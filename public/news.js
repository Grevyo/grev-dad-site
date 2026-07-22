(() => {
  const $ = selector => document.querySelector(selector);
  const state = { posts: [] };
  const date = value => new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(Number(value)*1000));
  function card(post, featured=false){
    const article=document.createElement('article');article.className=`news-card${featured?' featured':''}`;
    const media=document.createElement('div');media.className='news-card-media';if(post.image_url)media.style.backgroundImage=`linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.28)),url("${String(post.image_url).replaceAll('"','\\"')}")`;
    const body=document.createElement('div');body.className='news-card-body';
    const meta=document.createElement('div');meta.className='news-card-meta';
    const category=document.createElement('span');category.textContent=post.category;const published=document.createElement('time');published.dateTime=new Date(Number(post.published_at)*1000).toISOString();published.textContent=date(post.published_at);meta.append(category,published);
    const title=document.createElement('h2');title.textContent=post.title;
    const summary=document.createElement('p');summary.textContent=post.summary||post.body||'';
    body.append(meta,title,summary);
    if(Array.isArray(post.teamTags)&&post.teamTags.length){const tags=document.createElement('div');tags.className='news-team-tags';post.teamTags.forEach(value=>{const tag=document.createElement('span');tag.textContent=value;tags.append(tag)});body.append(tags)}
    const actions=document.createElement('div');actions.className='news-card-actions';
    if(post.source_url){const link=document.createElement('a');link.href=post.source_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=post.source_name?`Read at ${post.source_name}`:'Read source';actions.append(link)}
    const source=document.createElement('span');source.className='news-card-source';source.textContent=post.source_name&&!post.source_url?post.source_name:'Grev News';actions.append(source);body.append(actions);
    article.append(media,body);return article;
  }
  function render(){
    const featured=$('#news-featured'),grid=$('#news-grid'),empty=$('#news-empty');featured.replaceChildren();grid.replaceChildren();
    const leading=state.posts.find(post=>Number(post.is_featured)===1);if(leading){featured.append(card(leading,true));featured.hidden=false}else featured.hidden=true;
    state.posts.filter(post=>post!==leading).forEach(post=>grid.append(card(post)));
    empty.hidden=state.posts.length>0;
  }
  async function load(){
    const params=new URLSearchParams({limit:'80'});const category=$('#news-category').value;const team=$('#news-team').value.trim();if(category!=='all')params.set('category',category);if(team)params.set('team',team);
    $('#news-message').textContent='Loading Grev News…';$('#news-message').className='news-message';
    try{const response=await fetch(`/api/news?${params}`,{cache:'no-store'});const payload=await response.json();if(!response.ok)throw new Error(payload.message||'Unable to load Grev News.');state.posts=payload.posts||[];render();$('#news-message').textContent=state.posts.length?`${state.posts.length} news ${state.posts.length===1?'story':'stories'}.`:'No matching stories.'}catch(error){$('#news-message').textContent=error.message;$('#news-message').className='news-message error'}
  }
  let timer;$('#news-category')?.addEventListener('change',load);$('#news-team')?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(load,250)});load();
})();
