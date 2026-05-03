(function(){
  const esc=(s)=>String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const init=(n)=>{const p=String(n||'?').trim().split(/\s+/);return ((p[0]?.[0]||'?')+(p[1]?.[0]||'')).toUpperCase();};
  window.renderPlayerCard=function renderPlayerCard(profile,options={}){
    const p=profile||{};const o={showXp:true,showUserId:false,...options};
    const level=Number(p.accountLevel||1);const badge=window.getLevelBadgeMeta?window.getLevelBadgeMeta(level):{shape:'circle',colour:'#2e7dff',level};
    const av=p.avatar_url?`<img src='${esc(p.avatar_url)}' alt='avatar' />`:`<span class='compact-header-avatar-fallback'>${init(p.display_name||p.username)}</span>`;
    return `<article class='player-card'><a href='/profile.html?id=${p.id}' class='player-card-avatar compact-header-avatar'>${av}</a><div class='player-card-body'><div class='player-card-name'>${esc(p.display_name||p.username||'User')}</div><div class='player-card-username'>@${esc(p.username||'')}</div>${o.showUserId?`<div class='player-card-meta'>ID: ${Number(p.id)||0}</div>`:''}<div class='player-card-meta'>${esc(p.roleLabel||p.role||'Member')} · ${p.profile_title?esc(p.profile_title):''}</div><div class='player-card-meta'><span class='level-badge level-shape-${badge.shape}' style='background:${badge.colour}'><span class='level-badge-inner'>L${level}</span></span> ${esc(p.rank?.name||'Unranked')}</div>${o.showXp?`<div class='xp-bar'><div class='xp-bar-fill' style='width:${Number(p.accountXpPercent)||0}%'></div></div>`:''}</div></article>`;
  }
})();
