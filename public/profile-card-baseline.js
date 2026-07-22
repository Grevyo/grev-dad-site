(() => {
  const CONTRACT='profile-card-baseline-v2';
  const CANONICAL_WIDTHS={compact:900,wide:1200,full:1440};
  const FONT_STACKS={system:'Inter,Segoe UI,Arial,sans-serif',display:'Impact,Haettenschweiler,Arial Narrow Bold,sans-serif',mono:'ui-monospace,SFMono-Regular,Consolas,Liberation Mono,monospace',serif:'Georgia,Times New Roman,serif',rounded:'Trebuchet MS,Arial Rounded MT Bold,Arial,sans-serif'};
  const overlays={none:'transparent',dark:'rgba(0,0,0,.38)',light:'rgba(255,255,255,.28)'};
  const base=window.GrevProfileCard;
  if(!base?.apply||!base?.create||!base?.applyDesign)return;
  const previousApply=base.apply.bind(base);
  const previousCreate=base.create.bind(base);
  const previousApplyDesign=base.applyDesign.bind(base);

  function normalize(value){
    const source=value?.profileCard||value||{};
    const legacyBaselineTiles=source.contract==='profile-card-baseline-v1'&&Array.isArray(source.tiles)?source.tiles:[];
    const cardTiles=Array.isArray(source.cardTiles)?source.cardTiles:legacyBaselineTiles;
    return {...source,card:source.card||{},design:source.design||{},cardTiles};
  }
  function canonicalWidth(value){
    const profile=normalize(value);
    return CANONICAL_WIDTHS[profile.design.cardWidth]||CANONICAL_WIDTHS.full;
  }
  function featureFor(tile){return tile?.feature||null;}
  function tileHref(tile){return tile.tileKind==='feature'?(featureFor(tile)?.route||null):(tile.linkUrl||null);}
  function tileTitle(tile){return tile.title||tile.linkLabel||featureFor(tile)?.name||(tile.tileKind==='link'?'External link':'Custom tile');}
  function tileDescription(tile){return tile.description||featureFor(tile)?.description||(tile.tileKind==='link'?tile.linkUrl:'')||'';}
  function tileIcon(tile){return tile.iconLabel||featureFor(tile)?.iconText||(tile.tileKind==='link'?'↗':'•');}
  function imageCss(value){return value?`url("${String(value).replaceAll('"','\\"')}")`:'none';}

  function setTileAppearance(element,tile){
    element.style.setProperty('--card-tile-text',tile.textColour||'#f4f7fb');
    element.style.setProperty('--card-tile-border',tile.borderColour||'#394657');
    element.style.setProperty('--card-tile-font',FONT_STACKS[tile.fontFamily]||FONT_STACKS.system);
    element.style.setProperty('--card-icon-text',tile.iconTextColour||'#090b0f');
    element.style.setProperty('--card-icon-background',tile.iconBackgroundColour||'#f3f5f8');
    element.style.setProperty('--card-icon-border',tile.iconBorderColour||'#667181');
    element.style.setProperty('--card-icon-fit',tile.iconMediaFit||'cover');
    element.style.setProperty('--card-mobile-width',String(Math.min(2,Math.max(1,Number(tile.width)||1))));
    element.style.setProperty('--card-mobile-height',String(Math.min(2,Math.max(1,Number(tile.height)||1))));
    if(tile.backgroundType==='media'&&tile.backgroundMedia){const fit=tile.mediaFit==='stretch'?'100% 100%':(tile.mediaFit||'cover');element.style.setProperty('--card-tile-background',`${imageCss(tile.backgroundMedia)} center/${fit} no-repeat`);}
    else if(tile.backgroundType==='gradient')element.style.setProperty('--card-tile-background',`linear-gradient(${Number(tile.backgroundAngle)||135}deg,${tile.backgroundPrimary||'#11161d'},${tile.backgroundSecondary||'#5268aa'})`);
    else element.style.setProperty('--card-tile-background',tile.backgroundPrimary||'#11161d');
    element.style.setProperty('--card-tile-overlay',tile.backgroundType==='media'?(overlays[tile.mediaOverlay]||overlays.dark):'transparent');
    element.dataset.overlay=tile.mediaOverlay||'dark';
  }
  function iconElement(tile){const icon=document.createElement('span');icon.className='profile-card-mini-icon';if(tile.iconMode==='image'&&tile.iconMedia){icon.style.backgroundImage=imageCss(tile.iconMedia);icon.textContent='';}else icon.textContent=tileIcon(tile);return icon;}
  function standardContent(tile){const content=document.createElement('div');content.className='profile-card-mini-content';const head=document.createElement('div');head.className='profile-card-mini-head';const titleWrap=document.createElement('div');titleWrap.className='profile-card-mini-title-wrap';const kind=document.createElement('small');kind.className='profile-card-mini-kind';kind.textContent=tile.tileKind==='feature'?(featureFor(tile)?.category||'Grev.dad'):(tile.tileKind==='link'?'External link':'Custom');const title=document.createElement('strong');title.className='profile-card-mini-title';title.textContent=tileTitle(tile);titleWrap.append(kind,title);head.append(iconElement(tile),titleWrap);const description=document.createElement('p');description.className='profile-card-mini-description';description.textContent=tileDescription(tile);content.append(head,description);return content;}
  function mediaContent(tile){const content=document.createElement('div');content.className='profile-card-mini-media';if(tile.customIcon){const icon=document.createElement('span');icon.className='profile-card-mini-media-icon';icon.textContent=tile.customIcon;content.append(icon);}const titleText=tile.customTitle||tileTitle(tile);if(titleText){const title=document.createElement('strong');title.className='profile-card-mini-media-title';title.textContent=titleText;content.append(title);}return content;}
  function tileElement(tile){const href=tileHref(tile);const element=href?document.createElement('a'):document.createElement('article');element.className='profile-card-mini-tile';element.dataset.tileId=String(tile.tileId||'');element.style.gridColumn=`${Math.max(0,Number(tile.x)||0)+1} / span ${Math.max(1,Number(tile.width)||1)}`;element.style.gridRow=`${Math.max(0,Number(tile.y)||0)+1} / span ${Math.max(1,Number(tile.height)||1)}`;setTileAppearance(element,tile);if(href){element.href=href;if(/^https?:\/\//i.test(href)){element.target='_blank';element.rel='noopener noreferrer';}}element.append(tile.contentMode==='media-button'?mediaContent(tile):standardContent(tile));return element;}
  function ensureTileArea(root){let area=root.querySelector('.profile-card-tile-area');if(!area){area=document.createElement('section');area.className='profile-card-tile-area';area.setAttribute('aria-label','Profile card buttons and tiles');root.append(area);}let grid=area.querySelector('.profile-card-tile-grid');if(!grid){grid=document.createElement('div');grid.className='profile-card-tile-grid';area.append(grid);}return {area,grid};}
  function renderTiles(root,value){const profile=normalize(value),{area,grid}=ensureTileArea(root),tiles=profile.cardTiles.slice().sort((a,b)=>(Number(a.y)-Number(b.y))||(Number(a.x)-Number(b.x))||(Number(a.position)-Number(b.position)));root.style.setProperty('--profile-card-tile-gap-custom',`${Number(profile.design.cardTileGap)||10}px`);root.style.setProperty('--profile-card-tile-row-custom',`${Number(profile.design.cardTileRowHeight)||92}px`);area.hidden=tiles.length===0;grid.replaceChildren(...tiles.map(tileElement));root.dataset.cardTileCount=String(tiles.length);}
  function applyCanonicalGeometry(root,profile){
    previousApplyDesign(root,profile,profile.design,{variant:'full'});
    root.dataset.cardVariant='canonical';
    root.dataset.cardWidth=profile.design.cardWidth||'full';
    root.dataset.profileCardContract=CONTRACT;
  }
  function apply(root,value){
    const profile=normalize(value);
    previousApply(root,profile);
    applyCanonicalGeometry(root,profile);
    const liveEditorOwnsTiles=root.id==='profile-card'&&typeof profileState!=='undefined'&&profileState.editing;
    if(!liveEditorOwnsTiles)renderTiles(root,profile);
    return root;
  }
  function create(value,options={}){const profile=normalize(value);const root=previousCreate(profile,{...options,variant:'full',includeTiles:false});apply(root,profile);return root;}
  function createScaled(value,options={}){
    const profile=normalize(value);
    const frame=document.createElement(options.frameTagName||'div');
    frame.className=`profile-card-scale-frame${options.frameClassName?` ${options.frameClassName}`:''}`;
    frame.dataset.profileCardScale='canonical';
    frame.dataset.scaleReady='false';
    const card=create(profile,{...options,variant:'full'});
    const width=canonicalWidth(profile);
    card.classList.add('profile-card-scale-source');
    card.style.width=`${width}px`;
    card.style.maxWidth='none';
    card.style.margin='0';
    frame.append(card);
    const resize=()=>{
      const available=frame.clientWidth;
      if(!available)return;
      const scale=Math.min(1,available/width);
      card.style.transform=`scale(${scale})`;
      frame.style.height=`${Math.ceil(card.scrollHeight*scale)}px`;
      frame.style.setProperty('--profile-card-uniform-scale',String(scale));
      frame.dataset.scaleReady='true';
    };
    if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(resize);observer.observe(frame);frame._profileCardResizeObserver=observer;}
    else window.addEventListener('resize',resize,{passive:true});
    requestAnimationFrame(resize);
    return frame;
  }
  function mount(current,value,options={}){const next=create(value,options);const id=options.id||current?.id;if(id)next.id=id;if(options.ariaLabel)next.setAttribute('aria-label',options.ariaLabel);if(current)current.replaceWith(next);return next;}

  base.apply=apply;base.create=create;base.createScaled=createScaled;base.renderTiles=renderTiles;base.normalize=normalize;base.mount=mount;base.contract=CONTRACT;
  window.GrevProfileCardBaseline={normalize,apply,create,createScaled,mount,renderTiles,canonicalWidth,contract:CONTRACT};
})();
