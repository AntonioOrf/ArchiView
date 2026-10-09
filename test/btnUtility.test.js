// Audit front-end P2-4 — guardia sulla cascata.
//
// style.css è fuori da @layer: `.btn-primary/-secondary/-ghost/-danger/-danger-ghost`
// impongono colore e fondo e vincono sulle utility Tailwind (layered) scritte accanto.
// Un `btn-ghost text-red-600` dichiara un rosso che lo schermo non mostra. Passano solo le
// utility rimappate con !important in style.css (stone-*, white, amber-50/100/800/900)
// e senza varianti: `hover:`/`dark:` non sono mai rimappate. Per il pericolo: .btn-danger-ghost.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const RADICE = path.join(__dirname, '..', 'src', 'renderer');

function file(dir) {
  const out = [];
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) { if (voce.name !== 'vendor') out.push(...file(p)); }
    else if (/\.(ts|html)$/.test(voce.name) && !voce.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const STRINGA_BTN = /(["'`])([^"'`]*\bbtn-(?:primary|secondary|ghost|danger|danger-ghost)\b[^"'`]*)\1/g;
// Nome di colore da 3+ lettere: esclude i lati (`border-l-0`, `border-x-2`).
const COLORE = /^(?:[a-z-]+:)*(?:text|bg|border)-[a-z]{3,}-\d+(?:\/\d+)?$/;
const RIMAPPATA = /^(?:text|bg|border)-(?:stone-\d+|amber-(?:50|100|800|900))(?:\/50)?$/;

const violazioni = [];
for (const f of file(RADICE)) {
  const righe = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  righe.forEach((riga, n) => {
    for (const m of riga.matchAll(STRINGA_BTN)) {
      const inerti = m[2].split(/\s+/).filter(c => COLORE.test(c) && !RIMAPPATA.test(c));
      if (inerti.length) violazioni.push(`${path.relative(RADICE, f)}:${n + 1} ${inerti.join(' ')}`);
    }
  });
}

assert.deepStrictEqual(violazioni, [], 'utility cromatiche annullate da .btn-*:\n' + violazioni.join('\n'));
console.log('btnUtility: ok');
