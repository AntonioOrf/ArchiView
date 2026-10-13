// PIANO-SCHEDA-AFFIANCATA, Fase 3 — la regola del separatore fra colonne.
//
// `proporzioneSeparatore` vive in utils.ts: si ESTRAE il sorgente reale e lo si valuta, come
// in trascrizioneAllegati.test.js, invece di copiarne una versione che può divergere.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const UTILS = path.join(__dirname, '..', 'src', 'renderer', 'js', 'logic', 'utils.ts');

function estraiFunzione(sorgente, nome) {
  const marker = 'window.' + nome + ' = function';
  const inizio = sorgente.indexOf(marker);
  assert.notStrictEqual(inizio, -1, `Funzione ${nome} non trovata in utils.ts: estrazione da aggiornare`);
  let i = sorgente.indexOf('{', inizio);
  let livello = 0;
  for (; i < sorgente.length; i++) {
    if (sorgente[i] === '{') livello++;
    else if (sorgente[i] === '}' && --livello === 0) break;
  }
  return sorgente.substring(inizio, i + 1) + ';';
}

const window = {};
// eslint-disable-next-line no-new-func
new Function('window', estraiFunzione(fs.readFileSync(UTILS, 'utf8'), 'proporzioneSeparatore'))(window);
const p = window.proporzioneSeparatore;

console.log('Running separatore tests...');
assert.strictEqual(p(10), 25, 'sotto il limite: 25');
assert.strictEqual(p(90), 75, 'sopra il limite: 75');
assert.strictEqual(p(51.5), 50, 'vicino a metà si aggancia');
assert.strictEqual(p(52), 52, 'a 2 punti non si aggancia più: le frecce escono dall\'aggancio');
assert.strictEqual(p(34.5), 100 / 3, 'vicino a 1/3 si aggancia');
assert.strictEqual(p(65.5), 200 / 3, 'vicino a 2/3 si aggancia');
assert.strictEqual(p(40), 40, 'altrove resta dov\'è');
assert.strictEqual(p(100 / 3 + 1.99999, false), 100 / 3 + 1.99999, 'da tastiera nessun aggancio: dal terzo si esce');
assert.strictEqual(p(80, false), 75, 'da tastiera i limiti valgono');
assert.strictEqual(p('37.5%'.replace('%', '')), 37.5, 'accetta la stringa salvata');
assert.strictEqual(p(NaN), 50, 'valore illeggibile: metà');
assert.strictEqual(p(undefined), 50, 'nessun valore: metà');
console.log('✅ Tutti i test separatore passati con successo!');
