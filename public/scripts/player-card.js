(function(){
  const esc=(s)=>String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const init=(n)=>{const p=String(n||'?').trim().split(/\s+/);return ((p[0]?.[0]||'?')+(p[1]?.[0]||'')).toUpperCase();};
  window.renderPlayerCard=function(profile,options={}){
    const p=profile||{};
    const o={showXp:true,showUserId:false,useCardSettings:true,variant:'default',...options};
    const show=(k,d=1)=>o.useCardSettings?(Number(p[k]??d)===1):d===1;
    const avatarUrl=(p.avatar_url||'');
    const level=Number(p.accountLevel||1);
    const rank=esc(p.rank?.name||'Unranked');
    const avatar=avatarUrl&&show('card_show_avatar',1)
      ?`<img src='${esc(avatarUrl)}' alt='avatar'/>`
      :`<span class='compact-header-avatar-fallback'>${init(p.display_name||p.username)}</span>`;
    const bg=p.card_background_url
      ?`background-image:url("${esc(p.card_background_url)}");background-size:cover;background-position:center;`
      :(p.card_background_colour?`background:${esc(p.card_background_colour)};`:'' );
    const st=`${bg}${p.card_text_colour?`color:${esc(p.card_text_colour)};`:''}${p.card_border_colour?`border-color:${esc(p.card_border_colour)};`:''}`;

    if (o.variant === 'header') {
      return `<a href='/profile.html' class='header-player-card player-card player-card-custom player-card-header-variant' style='${st}' title='Open profile'><span class='player-card-avatar compact-header-avatar'>${avatar}</span><span class='player-card-body player-card-content compact-header-text'>${show('card_show_display_name',1)?`<span class='player-card-name compact-header-name'>${esc(p.display_name||p.username||'User')}</span>`:''}${show('card_show_username',1)?`<span class='player-card-username compact-header-username'>@${esc(p.username||'')}</span>`:''}<span class='compact-header-meta'>${show('card_show_level',1)?`Level ${level}`:'Level 1'}${show('card_show_rank',1)?` · ${rank}`:''}</span>${(show('card_show_xp',1)&&o.showXp)?`<span class='xp-bar xp-bar-header'><span class='xp-bar-fill' style='width:${Number(p.accountXpPercent)||0}%'></span></span>`:''}</span></a>`;
    }

    return `<article class='player-card player-card-custom' style='${st}'><div class='player-card-background'></div><a href='/profile.html?id=${Number(p.id)||0}' class='player-card-avatar compact-header-avatar'>${avatar}</a><div class='player-card-body player-card-content'>${show('card_show_display_name',1)?`<div class='player-card-name'>${esc(p.display_name||p.username||'User')}</div>`:''}${show('card_show_username',1)?`<div class='player-card-username'>@${esc(p.username||'')}</div>`:''}${(o.showUserId&&show('card_show_user_id',0))?`<div class='player-card-meta'>ID: ${Number(p.id)||0}</div>`:''}${show('card_show_role',1)?`<div class='player-card-meta'>${esc(p.roleLabel||p.role||'Member')}</div>`:''}${show('card_show_level',1)?`<div class='player-card-meta'>Level ${level}</div>`:''}${show('card_show_rank',1)?`<div class='player-card-meta'>${rank}</div>`:''}${(o.showXp&&show('card_show_xp',1))?`<div class='xp-bar'><div class='xp-bar-fill' style='width:${Number(p.accountXpPercent)||0}%'></div></div>`:''}</div></article>`;
  };
})();
