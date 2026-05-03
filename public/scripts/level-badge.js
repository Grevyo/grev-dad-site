(function(){
  const SHAPES=['circle','square','diamond','hexagon','shield','star','octagon','ticket','notch','elite-frame'];
  function getLevelColour(level){const l=Math.max(1,Number(level)||1);const hue=(l*37)%360;return `hsl(${hue} 82% 44%)`;}
  function getLevelBadgeMeta(level){const l=Math.max(1,Number(level)||1);const tierIndex=Math.floor((l-1)/10);const shape=SHAPES[tierIndex%SHAPES.length];const tierStart=tierIndex*10+1;return {level:l,colour:getLevelColour(l),shape,tierStart,tierEnd:tierStart+9};}
  window.getLevelColour=getLevelColour;window.getLevelBadgeMeta=getLevelBadgeMeta;
})();
