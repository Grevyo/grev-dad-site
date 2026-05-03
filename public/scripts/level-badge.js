(function(){
  const SHAPES=['circle','square','diamond','hexagon','shield','star','octagon','ticket','notch','elite-frame'];
  const clampLevel=(level)=>Math.max(1,Number(level)||1);
  function getMeta(level){
    const l=clampLevel(level);
    const hue=(l*37)%360;
    const colour=`hsl(${hue} 85% 45%)`;
    const tierIndex=Math.floor((l-1)/10);
    const shape=SHAPES[tierIndex%SHAPES.length];
    return {level:l,colour,textColour:'#fff',shape,tierStart:tierIndex*10+1,tierEnd:tierIndex*10+10};
  }
  function colourFor(level){return getMeta(level).colour;}
  function shapeFor(level){return getMeta(level).shape;}
  function render(level,options){
    const meta=getMeta(level);
    const cls=options?.className?` ${options.className}`:'';
    const node=document.createElement('span');
    node.className=`grev-level level-badge grev-level-shape-${meta.shape} level-shape-${meta.shape}${cls}`;
    node.style.background=meta.colour;
    node.style.color=meta.textColour;
    const inner=document.createElement('span');
    inner.className='grev-level-inner level-badge-inner';
    inner.textContent=options?.label===false?String(meta.level):`Lv. ${meta.level}`;
    node.append(inner);
    return node;
  }
  window.grevDad=window.grevDad||{};
  window.grevDad.level={getMeta,render,colourFor,shapeFor};
  window.getLevelBadgeMeta=getMeta;
  window.renderLevelBadge=render;
})();
