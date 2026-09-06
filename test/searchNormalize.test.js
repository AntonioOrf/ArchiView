const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Esercita le funzioni REALI di normalizzazione della ricerca.
// Il renderer non è importabile (tutto vive su `window`, il bundle ha effetti collaterali
// all'avvio), quindi si estrae il sorgente delle due funzioni da utils.ts e lo si valuta
// contro un `window` finto. Se la loro forma cambia, l'estrazione fallisce in modo
// rumoroso invece di testare silenziosamente una copia divergente.
const UTILS = path.join(__dirname, '..', 'src', 'renderer', 'js', 'logic', 'utils.ts');

function estraiFunzione(sorgente, nome) {
  const marker = 'window.' + nome + ' = function';
  const inizio = sorgente.indexOf(marker);
  assert.notStrictEqual(inizio, -1, `Funzione ${nome} non trovata in utils.ts: estrazione da aggiornare`);

  // Conteggio graffe a partire dalla prima '{' del corpo.
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

function caricaFunzioni() {
  const src = fs.readFileSync(UTILS, 'utf8');
  const codice = estraiFunzione(src, 'normalizzaTesto') + '\n' + estraiFunzione(src, 'tokenizzaRicerca');
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', codice)(window);
  assert.strictEqual(typeof window.normalizzaTesto, 'function');
  assert.strictEqual(typeof window.tokenizzaRicerca, 'function');
  return window;
}

function runTests() {
  console.log('Running searchNormalize tests...');
  const { normalizzaTesto, tokenizzaRicerca } = caricaFunzioni();

  // Caratteri critici costruiti per codepoint: come letterali sarebbero invisibili nel
  // sorgente e a rischio di essere mangiati da un editor o da una conversione di encoding.
  const COMBINING_GRAVE = String.fromCharCode(0x0300); // segno combinante ` (NFD)
  const APOSTROFI_CURVI = [0x2018, 0x2019, 0x02bc, 0x02b9, 0x2032].map(c => String.fromCharCode(c));

  // 1) Diacritici: è il caso che rendeva la ricerca inaffidabile su testo latino/medievale.
  assert.strictEqual(normalizzaTesto('Perùgia'), 'perugia');
  assert.strictEqual(normalizzaTesto('podestà'), 'podesta');
  assert.strictEqual(normalizzaTesto('NOTÀIO'), 'notaio');
  // Testo gia' decomposto (base + segno combinante): stesso risultato, pur accorciandosi.
  assert.strictEqual(normalizzaTesto('Peru' + COMBINING_GRAVE + 'gia'), 'perugia');
  console.log('✅ Test 1: diacritici rimossi e testo minuscolizzato.');

  // 2) Preservazione della lunghezza sul testo precomposto: gli offset degli snippet
  //    di ricerca ci si appoggiano per evidenziare la porzione giusta.
  for (const s of ['Perùgia', 'podestà e capitano', 'senza accenti', 'È così']) {
    assert.strictEqual(normalizzaTesto(s).length, s.length,
      `La normalizzazione deve preservare la lunghezza di "${s}"`);
  }
  console.log('✅ Test 2: lunghezza preservata sul testo precomposto.');

  // 3) Varianti tipografiche dell'apostrofo unificate (testo incollato da Word).
  for (const ap of APOSTROFI_CURVI) {
    assert.strictEqual(normalizzaTesto('Sant' + ap + 'Angelo'), "sant'angelo");
  }
  assert.strictEqual(normalizzaTesto("Sant'Angelo"), "sant'angelo");
  console.log('✅ Test 3: apostrofi curvi normalizzati su quello dritto.');

  // 4) Input degeneri: mai un throw, l'indice si costruisce su record incompleti.
  assert.strictEqual(normalizzaTesto(null), '');
  assert.strictEqual(normalizzaTesto(undefined), '');
  assert.strictEqual(normalizzaTesto(0), '0');
  assert.strictEqual(normalizzaTesto(1340), '1340');
  console.log('✅ Test 4: null/undefined/numeri gestiti senza eccezioni.');

  // 5) Tokenizzazione: AND su più parole, spazi ridondanti ignorati.
  assert.deepStrictEqual(tokenizzaRicerca('notaio 1340'), ['notaio', '1340']);
  assert.deepStrictEqual(tokenizzaRicerca('  notaio   1340  '), ['notaio', '1340']);
  assert.deepStrictEqual(tokenizzaRicerca('PERÙGIA'), ['perugia']);
  console.log('✅ Test 5: query spezzata in token normalizzati.');

  // 6) Query vuota → nessun token, cioè nessun filtro (non "nessun risultato").
  assert.deepStrictEqual(tokenizzaRicerca(''), []);
  assert.deepStrictEqual(tokenizzaRicerca('   '), []);
  assert.deepStrictEqual(tokenizzaRicerca(null), []);
  assert.deepStrictEqual(tokenizzaRicerca(undefined), []);
  console.log('✅ Test 6: query vuota non produce token.');

  // 7) Il match della griglia è un includes() sui token: verifica end-to-end della
  //    proprietà che conta, cioè che l'accento non impedisca più il ritrovamento.
  const hay = normalizzaTesto('Rogito del notaio in Perùgia, anno 1340');
  for (const q of ['perugia', 'PERUGIA', 'perùgia', 'notaio 1340', 'rogito perugia']) {
    const tokens = tokenizzaRicerca(q);
    assert.ok(tokens.every(t => hay.includes(t)), `"${q}" deve trovare il record`);
  }
  assert.ok(!tokenizzaRicerca('notaio 1350').every(t => hay.includes(t)),
    'Un token assente deve escludere il record (AND, non OR)');
  console.log('✅ Test 7: match AND sui token, accenti indifferenti.');

  console.log('Tutti i test searchNormalize passati con successo!\n');
}

runTests();
