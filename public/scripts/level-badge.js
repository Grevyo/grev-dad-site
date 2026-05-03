(function(){
  const SHAPES=['circle','square','diamond','hexagon','shield','star','octagon','ticket','notch','elite-frame'];
  function getLevelBadgeMeta(level){
    const l=Math.max(1,Number(level)||1);
    const hue=(l*37)%360;
    const colour=`hsl(${hue} 85% 45%)`;
    const tierIndex=Math.floor((l-1)/10);
    const shape=SHAPES[tierIndex%SHAPES.length];
    const tierStart=tierIndex*10+1;
    return {level:l,colour,textColour:'#fff',shape,tierStart,tierEnd:tierStart+9};
  }
  function renderLevelBadge(level,options){
    const meta=getLevelBadgeMeta(level);
    const cls=options?.className?` ${options.className}`:'';
    const node=document.createElement('span');
    node.className=`level-badge level-shape-${meta.shape}${cls}`;
    node.style.background=meta.colour;
    node.style.color=meta.textColour;
    const inner=document.createElement('span');
    inner.className='level-badge-inner';
    inner.textContent=`Lv. ${meta.level}`;
    node.append(inner);
    return node;
  }
  window.getLevelBadgeMeta=getLevelBadgeMeta;
  window.renderLevelBadge=renderLevelBadge;
})();
