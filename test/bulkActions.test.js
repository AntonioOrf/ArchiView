const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BULK = path.join(__dirname, '..', 'src', 'renderer', 'js', 'components', 'bulkActions.ts');
const UTILS = path.join(__dirname, '..', 'src', 'renderer', 'js', 'logic', 'utils.ts');

function estraiFunzione(sorgente, nome, file) {
  const marker = 'window.' + nome + ' = function';
  const inizio = sorgente.indexOf(marker);
  assert.notStrictEqual(inizio, -1, `Funzione ${nome} non trovata in ${file}: estrazione da aggiornare`);

  let i = sorgente.indexOf('{', inizio);
  let livello = 0;
  for (; i < sorgente.length; i++) {
    if (sorgente[i] === '{') livello++;
    else if (sorgente[i] === '}') {
      livello--;
      if (livello === 0) break;
    }
  }
  assert.ok(livello === 0 && i < sorgente.length, `Corpo di ${nome} non bilanciato`);
  return sorgente.substring(inizio, i + 1) + ';';
}

function carica() {
  const bulk = fs.readFileSync(BULK, 'utf8');
  const utils = fs.readFileSync(UTILS, 'utf8');
  const nomi = [
    'regexSostituzione', 'sostituisciTesto', 'contaOccorrenze', 'anteprimaSostituzione',
    'dividiTag', 'unisciTag', 'aggiungiTagCsv', 'rimuoviTagCsv'
  ];
  const codice = [
    estraiFunzione(utils, 'normalizzaTesto', 'utils.ts')
  ].concat(nomi.map(n => estraiFunzione(bulk, n, 'bulkActions.ts'))).join('\n');

  const window = { Model: require('../out/shared/model') };
  // eslint-disable-next-line no-new-func
  new Function('window', codice)(window);
  for (const n of nomi) {
    assert.strictEqual(typeof window[n], 'function', `${n} non caricata`);
  }
  return window;
}

const w = carica();
let passati = 0;
function test(nome, fn) {
  fn();
  passati++;
  console.log('  ok  ' + nome);
}

console.log('bulkActions.test.js — funzioni pure delle azioni in massa');

test('Test 1: sostituisce tutte le occorrenze, senza distinguere le maiuscole', () => {
  assert.strictEqual(
    w.sostituisciTesto('Perugia, ASP, perugia 12', 'perugia', 'Perusia', {}),
    'Perusia, ASP, Perusia 12'
  );
});

test('Test 2: con `maiuscole` la corrispondenza e\' esatta', () => {
  assert.strictEqual(
    w.sostituisciTesto('Perugia e perugia', 'perugia', 'X', { maiuscole: true }),
    'Perugia e X'
  );
});

test('Test 3: `intere` non spezza le parole piu\' lunghe', () => {
  assert.strictEqual(w.sostituisciTesto('not notaio', 'not', 'X', { intere: true }), 'X notaio');
  assert.strictEqual(w.sostituisciTesto('not notaio', 'not', 'X', {}), 'X Xaio');
});

test('Test 4: `intere` riconosce i confini anche su testo accentato', () => {
  assert.strictEqual(w.sostituisciTesto('a Perugia, Perugiae', 'Perugia', 'Perusia', { intere: true }),
    'a Perusia, Perugiae');
  assert.strictEqual(w.sostituisciTesto('c. 1340 e c.1340', 'c', 'C', { intere: true }),
    'C. 1340 e C.1340');
});

test('Test 5: i metacaratteri della ricerca sono testo, non un modello', () => {
  assert.strictEqual(w.sostituisciTesto('c. 1340 e ca 1340', 'c.', 'circa', {}), 'circa 1340 e ca 1340');
  assert.strictEqual(w.sostituisciTesto('MS (1)', '(1)', '[1]', {}), 'MS [1]');
});

test('Test 6: $& e $1 nella sostituzione restano letterali', () => {
  assert.strictEqual(w.sostituisciTesto('costo 5', '5', '$5', {}), 'costo $5');
  assert.strictEqual(w.sostituisciTesto('a', 'a', '$&$&', {}), '$&$&');
});

test('Test 7: ricerca vuota o valore non stringa lasciano tutto com\'era', () => {
  assert.strictEqual(w.sostituisciTesto('MS 12', '', 'X', {}), 'MS 12');
  assert.strictEqual(w.regexSostituzione('', {}), null);
  assert.strictEqual(w.sostituisciTesto(undefined, 'a', 'b', {}), undefined);
  assert.strictEqual(w.sostituisciTesto(42, 'a', 'b', {}), 42);
});

test('Test 8: anteprima conta schede e occorrenze, non le confonde', () => {
  const records = [
    { segnatura: 'ASP 1, ASP 2' },
    { segnatura: 'ASP 3' },
    { segnatura: 'ASF 4' },
    { titolo: 'ASP 5' }
  ];
  const r = w.anteprimaSostituzione(records, 'segnatura', 'ASP', {});
  assert.strictEqual(r.schede, 2);
  assert.strictEqual(r.occorrenze, 3);
});

test('Test 9: sostituire con la stringa vuota cancella il testo cercato', () => {
  assert.strictEqual(w.sostituisciTesto('ASP 12', 'ASP ', '', {}), '12');
  assert.strictEqual(w.sostituisciTesto('ASP 12', 'ASP ', null, {}), '12');
});

test('Test 10: dividiTag scarta spazi e voci vuote', () => {
  assert.deepStrictEqual(w.dividiTag('  pergamena ,, notarile ,  '), ['pergamena', 'notarile']);
  assert.deepStrictEqual(w.dividiTag(null), []);
});

test('Test 11: aggiungiTagCsv non duplica per maiuscole o accenti', () => {
  assert.strictEqual(w.aggiungiTagCsv('pergamena', 'Pergamena, notarile'), 'pergamena, notarile');
  assert.strictEqual(w.aggiungiTagCsv('perugia', 'Perùgia'), 'perugia');
  assert.strictEqual(w.aggiungiTagCsv('Pergamena', 'pergamena'), 'Pergamena');
});

test('Test 12: aggiungiTagCsv parte anche da una stringa vuota', () => {
  assert.strictEqual(w.aggiungiTagCsv('', 'a, b'), 'a, b');
  assert.strictEqual(w.aggiungiTagCsv(undefined, ['a', 'b']), 'a, b');
});

test('Test 13: rimuoviTagCsv esige la corrispondenza esatta', () => {
  assert.strictEqual(w.rimuoviTagCsv('not, notaio, carta', 'not'), 'notaio, carta');
  assert.strictEqual(w.rimuoviTagCsv('Notaio, carta', 'notaio'), 'carta');
  assert.strictEqual(w.rimuoviTagCsv('a, b', ''), 'a, b');
});

console.log(`\n${passati} test superati.`);
