(function(){
  const esc=(s)=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const init=(n)=>{const p=String(n||'?').trim().split(/\s+/);return ((p[0]?.[0]||'?')+(p[1]?.[0]||'')).toUpperCase();};
  const safeHttpUrl=(value)=>{const text=String(value||'').trim();if(!/^https?:\/\//i.test(text))return '';if(/^\s*(javascript|data|vbscript|file):/i.test(text))return '';return text;};
  const levelHtml=(level)=>{if(window.grevDad?.level?.render){const w=document.createElement('span');w.append(window.grevDad.level.render(level));return w.innerHTML;}return `Lv. ${Number(level)||1}`;};
  const TILE_KEYS=['name','username','role','level','rank','xp','status','steam','leetify'];
  const TILE_DEFAULT_ORDER={name:10,username:20,role:30,level:40,rank:50,xp:60,status:70,steam:80,leetify:90};
  const DEFAULTS={name:{span:'2x1',fontStyle:'bold',fontFamily:'default',size:'lg',align:'left',colour:'',order:10},username:{span:'1x1',fontStyle:'normal',fontFamily:'default',size:'sm',align:'left',colour:'',order:20},role:{span:'1x1',fontStyle:'normal',fontFamily:'default',size:'sm',align:'left',colour:'',order:30},level:{span:'1x1',fontStyle:'normal',fontFamily:'default',size:'md',align:'center',colour:'',order:40},rank:{span:'1x1',fontStyle:'bold',fontFamily:'default',size:'sm',align:'left',colour:'',order:50},xp:{span:'2x1',fontStyle:'normal',fontFamily:'default',size:'sm',align:'left',colour:'',order:60},status:{span:'2x1',fontStyle:'italic',fontFamily:'default',size:'sm',align:'left',colour:'',order:70},steam:{span:'1x1',fontStyle:'bold',fontFamily:'default',size:'sm',align:'center',colour:'',order:80},leetify:{span:'1x1',fontStyle:'bold',fontFamily:'default',size:'sm',align:'center',colour:'',order:90}};
  const ALLOWED={span:new Set(['1x1','2x1','1x2','2x2']),fontStyle:new Set(['normal','bold','italic','bold_italic','mono']),fontFamily:new Set(['default','system','serif','mono','condensed','wide','display']),size:new Set(['xs','sm','md','lg','xl']),align:new Set(['left','center','right'])};
  const mergeSettings=(profile)=>{let raw=profile?.cardTileSettings; if(!raw&&profile?.card_tile_settings_json){try{raw=JSON.parse(profile.card_tile_settings_json);}catch{raw={};}} raw=raw&&typeof raw==='object'?raw:{}; const out={}; TILE_KEYS.forEach((k)=>{const r=raw[k]&&typeof raw[k]==='object'?raw[k]:{}; const d=DEFAULTS[k]; out[k]={span:ALLOWED.span.has(r.span)?r.span:d.span,fontStyle:ALLOWED.fontStyle.has(r.fontStyle)?r.fontStyle:d.fontStyle,fontFamily:ALLOWED.fontFamily.has(r.fontFamily)?r.fontFamily:d.fontFamily,size:ALLOWED.size.has(r.size)?r.size:d.size,align:ALLOWED.align.has(r.align)?r.align:d.align,colour:/^#[0-9a-fA-F]{6}$/.test(String(r.colour||''))?String(r.colour):'',order:Number.isInteger(Number(r.order))&&Number(r.order)>=1&&Number(r.order)<=999?Number(r.order):d.order};}); return out;};
  const tileClass=(s,variant)=>{const span=(variant==='header'?(s.span==='2x2'?'2x1':'1x1'):s.span);const size=(variant==='header'&&s.size==='xl')?'md':s.size;return `card-span-${span} card-font-${s.fontStyle.replace('_','-')} card-font-family-${s.fontFamily} card-text-${size} card-align-${s.align}`;};
  const buildTile=(klass,key,label,value,settings,variant)=>({key,html:`<div class='player-card-tile ${klass} ${tileClass(settings[key],variant)}' ${settings[key].colour?`style='--tile-colour:${esc(settings[key].colour)}'`:''}>${label?`<div class='player-card-tile-label'>${label}</div>`:''}${value}</div>`});
  window.renderPlayerCard=function(profile,options={}){
    const p=profile||{}; const o={showXp:true,showUserId:false,useCardSettings:true,variant:'full',...options}; const settings=mergeSettings(p);
    const show=(k,d=1)=>o.useCardSettings?(Number(p[k]??d)===1):d===1;
    const steamUrl=safeHttpUrl(p.steam_url); const leetifyUrl=safeHttpUrl(p.leetify_url);
    const avatarUrl=(p.avatar_url||''); const level=Number(p.accountLevel||1); const rank=esc(p.rank?.name||'Unranked');
    const avatar=avatarUrl&&show('card_show_avatar',1)?`<img src='${esc(avatarUrl)}' alt='avatar'/>`:`<span class='compact-header-avatar-fallback'>${init(p.display_name||p.username)}</span>`;
    const bg=p.card_background_url?`background-image:url("${esc(p.card_background_url)}");background-size:cover;background-position:center;background-repeat:no-repeat;`:(p.card_background_colour?`background-color:${esc(p.card_background_colour)};`:'' );
    const st=`${bg}${p.card_text_colour?`--player-card-name-colour:${esc(p.card_text_colour)};`:''}${p.card_body_text_colour?`--player-card-body-colour:${esc(p.card_body_text_colour)};`:''}${p.card_border_colour?`border-color:${esc(p.card_border_colour)};`:''}`;
    const levelLine=show('card_show_level',1)?`${levelHtml(level)}`:''; const rankLine=show('card_show_rank',1)?`<span>${rank}</span>`:'';
    if (o.variant === 'header') return `<a href='/profile.html' class='header-player-card player-card player-card-custom player-card-header-variant' style='${st}' title='Open profile'><span class='player-card-avatar compact-header-avatar'>${avatar}</span><span class='player-card-body player-card-content compact-header-text'>${show('card_show_display_name',1)?`<span class='player-card-name compact-header-name'>${esc(p.display_name||p.username||'User')}</span>`:''}${show('card_show_username',1)?`<span class='player-card-username compact-header-username'>@${esc(p.username||'')}</span>`:''}<span class='compact-header-meta'>${levelLine}${rankLine?` · ${rankLine}`:''}</span>${(show('card_show_xp',1)&&o.showXp)?`<span class='xp-bar xp-bar-header'><span class='xp-bar-fill' style='width:${Number(p.accountXpPercent)||0}%'></span></span>`:''}</span></a>`;
    const variantClass=`player-card-${esc(o.variant||'full')}-variant`; const isSnapshot=o.variant==='snapshot'; const tiles=[];
    if (show('card_show_display_name',1)) tiles.push(buildTile('player-card-tile-name','name','',`<div class='player-card-name'>${esc(p.display_name||p.username||'User')}</div>`,settings,o.variant));
    if (show('card_show_username',1)) tiles.push(buildTile('player-card-tile-username','username','Username',`<div class='player-card-username'>@${esc(p.username||'')}</div>`,settings,o.variant));
    if (!isSnapshot && o.showUserId && show('card_show_user_id',0)) tiles.push(buildTile('player-card-tile-id','username','User ID',`<div class='player-card-meta'>${Number(p.id)||0}</div>`,settings,o.variant));
    if (show('card_show_role',1)) tiles.push(buildTile('player-card-tile-role','role','Role',`<div class='player-card-meta'>${esc(p.roleLabel||p.role||'Member')}</div>`,settings,o.variant));
    if (levelLine) tiles.push(buildTile('player-card-tile-level','level','grev.dad.level',`<div class='player-card-meta player-card-level-row'>${levelLine}</div>`,settings,o.variant));
    if (rankLine) tiles.push(buildTile('player-card-tile-rank','rank','Rank',`<div class='player-card-meta'>${rank}</div>`,settings,o.variant));
    if (o.showXp&&show('card_show_xp',1)) tiles.push(buildTile('player-card-tile-xp','xp','XP',`<div class='player-card-meta'>${Number(p.accountXp)||0} XP</div><div class='xp-bar'><div class='xp-bar-fill' style='width:${Number(p.accountXpPercent)||0}%'></div></div>`,settings,o.variant));
    if (!isSnapshot && show('card_show_status',0)&&p.status_message) tiles.push(buildTile('player-card-tile-status','status','Status',`<div class='player-card-meta'>${esc(p.status_message)}</div>`,settings,o.variant));
    if (show('card_show_steam',0)&&steamUrl) tiles.push(buildTile('player-card-tile-steam','steam','Steam',`<a class='player-card-link' href='${esc(steamUrl)}' target='_blank' rel='noopener noreferrer'>View profile</a>`,settings,o.variant));
    if (show('card_show_leetify',0)&&leetifyUrl) tiles.push(buildTile('player-card-tile-leetify','leetify','Leetify',`<a class='player-card-link' href='${esc(leetifyUrl)}' target='_blank' rel='noopener noreferrer'>View profile</a>`,settings,o.variant));
    if (!isSnapshot) {
      tiles.sort((a,b)=>{
        const ao=settings[a.key]?.order ?? TILE_DEFAULT_ORDER[a.key] ?? 999;
        const bo=settings[b.key]?.order ?? TILE_DEFAULT_ORDER[b.key] ?? 999;
        return ao-bo || (TILE_DEFAULT_ORDER[a.key]??999)-(TILE_DEFAULT_ORDER[b.key]??999);
      });
    } else {
      tiles.sort((a,b)=>{const ao=settings[a.key]?.order ?? TILE_DEFAULT_ORDER[a.key] ?? 999; const bo=settings[b.key]?.order ?? TILE_DEFAULT_ORDER[b.key] ?? 999; return ao-bo;});
    }
    return `<article class='player-card player-card-custom ${variantClass}' style='${st}'><a href='/profile.html?id=${Number(p.id)||0}' class='player-card-avatar compact-header-avatar'>${avatar}</a><div class='player-card-body player-card-content'><div class='player-card-info-grid'>${tiles.map((t)=>t.html).join('')}</div></div></article>`;
  };
})();
