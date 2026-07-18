import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Non-unique patch anchor: ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (before === after) throw new Error(`No changes produced for ${path}`);
  fs.writeFileSync(path, after);
}

patch('public/dashboard.js', source => {
  source = replaceOnce(
    source,
    "    const settings = document.createElement('button');\n    settings.type = 'button';",
    "    let blockTileDrag = false;\n    const settings = document.createElement('button');\n    settings.type = 'button';",
    'tile drag guard state'
  );
  source = replaceOnce(
    source,
    "    settings.addEventListener('pointerdown', event => event.stopPropagation());\n    settings.addEventListener('dragstart', event => event.preventDefault());\n    settings.addEventListener('click', event => {\n      event.stopPropagation();\n      openTileSettings(feature.id);\n    });",
    "    settings.addEventListener('pointerdown', event => {\n      blockTileDrag = true;\n      event.stopPropagation();\n    });\n    settings.addEventListener('pointerup', () => { blockTileDrag = false; });\n    settings.addEventListener('pointercancel', () => { blockTileDrag = false; });\n    settings.addEventListener('dragstart', event => event.preventDefault());\n    settings.addEventListener('click', event => {\n      blockTileDrag = false;\n      event.stopPropagation();\n      openTileSettings(feature.id);\n    });",
    'settings drag guard events'
  );
  source = replaceOnce(
    source,
    "      if (isSingleColumnFallback() || event.target.closest('button,select,input,a')) {\n        event.preventDefault();\n        return;\n      }",
    "      if (isSingleColumnFallback() || blockTileDrag || event.target.closest('button,select,input,a')) {\n        blockTileDrag = false;\n        event.preventDefault();\n        return;\n      }",
    'guard article dragstart'
  );
  return source;
});

patch('public/dashboard.css', source => {
  source += `\n@media(max-height:686px) and (min-width:901px){\n  .dashboard-workspace:has(.dashboard-editor-catalogue-panel:not([hidden])){grid-template-columns:1fr}\n  .dashboard-editor-catalogue-panel{position:static;max-height:none}\n}\n`;
  return source;
});

console.log('Whole-tile drag review fixes applied.');
