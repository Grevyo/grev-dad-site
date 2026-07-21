(() => {
  const FONT_STACKS={
    system:'Inter,Segoe UI,Arial,sans-serif',display:'Impact,Haettenschweiler,Arial Narrow Bold,sans-serif',
    mono:'ui-monospace,SFMono-Regular,Consolas,Liberation Mono,monospace',serif:'Georgia,Times New Roman,serif',
    rounded:'Trebuchet MS,Arial Rounded MT Bold,Arial,sans-serif'
  };
  const overlays={none:'transparent',dark:'rgba(0,0,0,.38)',light:'rgba(255,255,255,.28)'};
  const base=window.GrevProfileCard;
  if(!base?.apply||!base?.create)return;
  const previousApply=base.apply.bind(base);
  const previousCreate=base.create.bind(base);

  function normalize(value){
    const source=value?.profileCard||value||{};
    const tiles=Array.isArray(source.tiles)?source.tiles:(Array.isArray(source.cardTiles)?source.cardTiles:[]);
    return {...source,card:source.card||{},design:source.design||{},tiles,cardTiles:tiles};
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
    if(tile.backgroundType==='media'&&tile.backgroundMedia){
      const fit=tile.mediaFit==='stretch'?'100% 100%':(tile.mediaFit||'cover');
      element.style.setProperty('--card-tile-background',`${imageCss(tile.backgroundMedia)} center/${fit} no-repeat`);
    }else if(tile.backgroundType==='gradient'){
      element.style.setProperty('--card-tile-background',`linear-gradient(${Number(tile.backgroundAngle)||135}deg,${tile.backgroundPrimary||'#11161d'},${tile.backgroundSecondary||'#5268aa'})`);
    }else element.style.setProperty('--card-tile-background',tile.backgroundPrimary||'#11161d');
    element.style.setProperty('--card-tile-overlay',tile.backgroundType==='media'?(overlays[tile.mediaOverlay]||overlays.dark):'transparent');
    element.dataset.overlay=tile.mediaOverlay||'dark';
  }

  function iconElement(tile){
    const icon=document.createElement('span');icon.className='profile-card-mini-icon';
    if(tile.iconMode==='image'&&tile.iconMedia){icon.style.backgroundImage=imageCss(tile.iconMedia);icon.textContent='';}
    else icon.textContent=tileIcon(tile);
    return icon;
  }
  function standardContent(tile){
    const content=document.createElement('div');content.className='profile-card-mini-content';
    const head=document.createElement('div');head.className='profile-card-mini-head';
    const titleWrap=document.createElement('div');titleWrap.className='profile-card-mini-title-wrap';
    const kind=document.createElement('small');kind.className='profile-card-mini-kind';kind.textContent=tile.tileKind==='feature'?(featureFor(tile)?.category||'Grev.dad'):(tile.tileKind==='link'?'External link':'Custom');
    const title=document.createElement('strong');title.className='profile-card-mini-title';title.textContent=tileTitle(tile);
    titleWrap.append(kind,title);head.append(iconElement(tile),titleWrap);
    const description=document.createElement('p');description.className='profile-card-mini-description';description.textContent=tileDescription(tile);
    content.append(head,description);return content;
  }
  function mediaContent(tile){
    const content=document.createElement('div');content.className='profile-card-mini-media';
    if(tile.customIcon){const icon=document.createElement('span');icon.className='profile-card-mini-media-icon';icon.textContent=tile.customIcon;content.append(icon);}
    const titleText=tile.customTitle||tileTitle(tile);
    if(titleText){const title=document.createElement('strong');title.className='profile-card-mini-media-title';title.textContent=titleText;content.append(title);}
    return content;
  }
  function tileElement(tile){
    const href=tileHref(tile);const element=href?document.createElement('a'):document.createElement('article');
    element.className='profile-card-mini-tile';element.dataset.tileId=String(tile.tileId||'');
    element.style.gridColumn=`${Math.max(0,Number(tile.x)||0)+1} / span ${Math.max(1,Number(tile.width)||1)}`;
    element.style.gridRow=`${Math.max(0,Number(tile.y)||0)+1} / span ${Math.max(1,Number(tile.height)||1)}`;
    setTileAppearance(element,tile);
    if(href){element.href=href;if(/^https?:\/\//i.test(href)){element.target='_blank';element.rel='noopener noreferrer';}}
    element.append(tile.contentMode==='media-button'?mediaContent(tile):standardContent(tile));
    return element;
  }
  function ensureTileArea(root){
    let area=root.querySelector('.profile-card-tile-area');
    if(!area){area=document.createElement('section');area.className='profile-card-tile-area';area.setAttribute('aria-label','Profile card buttons and tiles');root.append(area);}
    let grid=area.querySelector('.profile-card-tile-grid');
    if(!grid){grid=document.createElement('div');grid.className='profile-card-tile-grid';area.append(grid);}
    return {area,grid};
  }
  function renderTiles(root,value){
    const profile=normalize(value),{area,grid}=ensureTileArea(root),tiles=profile.tiles.slice().sort((a,b)=>(Number(a.y)-Number(b.y))||(Number(a.x)-Number(b.x))||(Number(a.position)-Number(b.position)));
    root.style.setProperty('--profile-card-tile-gap-custom',`${Number(profile.design.cardTileGap)||10}px`);
    root.style.setProperty('--profile-card-tile-row-custom',`${Number(profile.design.cardTileRowHeight)||92}px`);
    area.hidden=tiles.length===0;grid.replaceChildren(...tiles.map(tileElement));root.dataset.cardTileCount=String(tiles.length);
  }
  function apply(root,value,options={}){
    const profile=normalize(value);previousApply(root,profile);renderTiles(root,profile);root.dataset.profileCardContract='baseline-v1';
    if(options.variant)root.dataset.cardVariant=options.variant;
    return root;
  }
  function create(value,options={}){
    const profile=normalize(value);const root=previousCreate(profile,{...options,includeTiles:false});
    if(options.variant)root.dataset.cardVariant=options.variant;apply(root,profile,options);return root;
  }

  base.apply=apply;base.create=create;base.renderTiles=renderTiles;base.normalize=normalize;base.contract='profile-card-baseline-v1';
  window.GrevProfileCardBaseline={normalize,apply,create,renderTiles,contract:'profile-card-baseline-v1'};
})();
