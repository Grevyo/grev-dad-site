import fs from 'node:fs';

const path = 'scripts/patch-tile-appearance-and-grab-offset.mjs';
let source = fs.readFileSync(path, 'utf8');
const replacements = [
  ["type TilePlacement = Dimension & TileAppearance & { featureId: string; x: number; y: number; colour?: TileColour };", "type TilePlacement = Dimension & Partial<TileAppearance> & { featureId: string; x: number; y: number; colour?: TileColour };"],
  ["article.style.backgroundImage = `linear-gradient(${appearance.backgroundAngle}deg, ${appearance.backgroundPrimary}, ${appearance.backgroundSecondary})`;", "article.style.backgroundImage = 'linear-gradient(' + appearance.backgroundAngle + 'deg, ' + appearance.backgroundPrimary + ', ' + appearance.backgroundSecondary + ')';"],
  ["article.style.backgroundImage = `url(${JSON.stringify(appearance.backgroundMedia)})`;", "article.style.backgroundImage = 'url(' + JSON.stringify(appearance.backgroundMedia) + ')';"],
  ["return `Gradient · ${preset?.name ?? 'Custom'}`;", "return 'Gradient · ' + (preset?.name ?? 'Custom');"],
  ["return `Solid · ${preset?.name ?? appearance.backgroundPrimary.toUpperCase()}`;", "return 'Solid · ' + (preset?.name ?? appearance.backgroundPrimary.toUpperCase());"],
  ["button.className = `dashboard-appearance-choice${selected ? ' selected' : ''}`;", "button.className = 'dashboard-appearance-choice' + (selected ? ' selected' : '');"],
  ["if (angleValue) angleValue.textContent = `${appearance.backgroundAngle}°`;", "if (angleValue) angleValue.textContent = String(appearance.backgroundAngle) + '°';"],
  ["refreshAppearancePreview(tile, `${item.name} background selected.`);", "refreshAppearancePreview(tile, item.name + ' background selected.');"],
  ["paletteButton(item.name, `linear-gradient(${item.angle}deg,${item.primary},${item.secondary})`,", "paletteButton(item.name, 'linear-gradient(' + item.angle + 'deg,' + item.primary + ',' + item.secondary + ')',"],
  ["refreshAppearancePreview(tile, `${item.name} gradient selected.`);", "refreshAppearancePreview(tile, item.name + ' gradient selected.');"],
  ["refreshAppearancePreview(tile, `${event.currentTarget.selectedOptions[0]?.textContent ?? value} selected.`);", "refreshAppearancePreview(tile, (event.currentTarget.selectedOptions[0]?.textContent ?? value) + ' selected.');"],
  ["refreshAppearancePreview(tile, `${event.currentTarget.selectedOptions[0]?.textContent ?? value} font selected.`);", "refreshAppearancePreview(tile, (event.currentTarget.selectedOptions[0]?.textContent ?? value) + ' font selected.');"],
  ["refreshAppearancePreview(tile, `${file.name} selected as the tile background.`);", "refreshAppearancePreview(tile, file.name + ' selected as the tile background.');"]
];
for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Missing generator syntax fix anchor: ${before}`);
  source = source.replace(before, after);
}
fs.writeFileSync(path, source);
console.log('Tile appearance patch generator syntax and placement typing corrected.');
