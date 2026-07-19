import fs from 'node:fs';

const path = 'scripts/patch-mobile-square-dashboard.mjs';
let source = fs.readFileSync(path, 'utf8');
const marker = source.indexOf("let js = fs.readFileSync('public/dashboard.js', 'utf8');");
if (marker < 0) throw new Error('Mobile patch JavaScript section was not found.');
const head = source.slice(0, marker);
let tail = source.slice(marker);
if (!tail.includes('${gap}') && tail.includes('\\${gap}')) {
  console.log('Mobile patch source templates were already escaped.');
  process.exit(0);
}
tail = tail.replaceAll('${', '\\${');
source = head + tail;
fs.writeFileSync(path, source);
console.log('Mobile patch source templates escaped.');
