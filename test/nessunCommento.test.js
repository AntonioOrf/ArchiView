const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { togli, elencoFile } = require('../scripts/togli-commenti');

const RADICE = path.join(__dirname, '..');
const sporchi = [];
for (const f of elencoFile()) {
  const testo = fs.readFileSync(path.join(RADICE, f), 'utf8');
  const r = togli(testo, f);
  if (r.tolti || r.testo !== testo) sporchi.push(`${f} (${r.tolti})`);
}

assert.deepStrictEqual(sporchi, [], 'commenti nei sorgenti, togliere con: node scripts/togli-commenti.js\n' + sporchi.join('\n'));
console.log('nessunCommento: ok');
