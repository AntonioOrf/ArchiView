const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Esercita la funzione REALE di confronto naturale delle segnature.
// Stessa tecnica di searchNormalize.test.js: il renderer non è importabile (tutto vive
// su `window`, il bundle ha effetti collaterali all'avvio), quindi si estrae il sorgente
// da utils.ts e lo si valuta contro un `window` finto. Se la forma della funzione cambia,
// l'estrazione fallisce in modo rumoroso invece di testare una copia divergente.
const UTILS = path.join(__dirname, '..', 'src', 'renderer', 'js', 'logic', 'utils.ts');

function estraiFunzione(sorgente, nome) {
  const marker = 'window.' + nome + ' = function';
  const inizio = sorgente.indexOf(marker);
  assert.notStrictEqual(inizio, -1, `Funzione ${nome} non trovata in utils.ts: estrazione da aggiornare`);

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
  // confrontaNaturale delega a normalizzaTesto: va caricata anch'essa, non simulata.
  const codice = estraiFunzione(src, 'normalizzaTesto') + '\n' + estraiFunzione(src, 'confrontaNaturale');
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', codice)(window);
  assert.strictEqual(typeof window.confrontaNaturale, 'function');
  return window;
}

function runTests() {
  console.log('Running naturalSort tests...');
  const { confrontaNaturale } = caricaFunzioni();

  const ordina = (arr) => arr.slice().sort(confrontaNaturale);

  // 1) Il motivo per cui questa funzione esiste: lessicograficamente "MS 10" < "MS 2".
  assert.ok(confrontaNaturale('MS 2', 'MS 10') < 0, '"MS 2" deve precedere "MS 10"');
  assert.deepStrictEqual(
    ordina(['MS 10', 'MS 2', 'MS 1', 'MS 21', 'MS 3']),
    ['MS 1', 'MS 2', 'MS 3', 'MS 10', 'MS 21']
  );
  console.log('✅ Test 1: i numeri nelle segnature si ordinano per valore, non per cifra.');

  // 2) Segmenti misti tipici di una segnatura archivistica.
  assert.deepStrictEqual(
    ordina(['Reg. 3/12', 'Reg. 3/2', 'Reg. 10/1', 'Reg. 3/10']),
    ['Reg. 3/2', 'Reg. 3/10', 'Reg. 3/12', 'Reg. 10/1']
  );
  console.log('✅ Test 2: segmenti multipli confrontati segmento per segmento.');

  // 3) Accenti e maiuscole non separano voci che l'utente considera uguali.
  assert.strictEqual(confrontaNaturale('Perùgia', 'perugia'), 0);
  assert.strictEqual(confrontaNaturale('NOTAIO', 'notaio'), 0);
  console.log('✅ Test 3: confronto insensibile ad accenti e maiuscole.');

  // 4) I vuoti vanno SEMPRE in coda: sono record incompleti, non "primi in ordine".
  assert.ok(confrontaNaturale('', 'MS 1') > 0);
  assert.ok(confrontaNaturale('   ', 'MS 1') > 0);
  assert.ok(confrontaNaturale('MS 1', '') < 0);
  assert.strictEqual(confrontaNaturale('', ''), 0);
  assert.deepStrictEqual(ordina(['MS 2', '', 'MS 1', null]), ['MS 1', 'MS 2', '', null]);
  console.log('✅ Test 4: valori vuoti/nulli in coda.');

  // 5) Input degeneri: mai un throw. L'ordinamento gira su record incompleti.
  assert.strictEqual(confrontaNaturale(null, null), 0);
  assert.strictEqual(confrontaNaturale(undefined, undefined), 0);
  assert.ok(confrontaNaturale(2, 10) < 0, 'anche i numeri veri si confrontano per valore');
  assert.ok(confrontaNaturale(1340, 'MS 1') !== undefined);
  console.log('✅ Test 5: null/undefined/numeri gestiti senza eccezioni.');

  // 6) Antisimmetria: se A precede B, B segue A. Un comparatore che la viola
  //    produce ordinamenti dipendenti dall'ordine di partenza (e paginazione instabile).
  const campioni = ['MS 1', 'MS 10', 'Perùgia', '', 'Reg. 3/2', 'notaio', null];
  for (const a of campioni) {
    for (const b of campioni) {
      const ab = confrontaNaturale(a, b);
      const ba = confrontaNaturale(b, a);
      // `===` e non strictEqual: Math.sign(0) è 0 e -Math.sign(0) è -0, che
      // assert.strictEqual considera diversi mentre per un comparatore sono lo stesso.
      assert.ok(Math.sign(ab) === -Math.sign(ba), `Antisimmetria violata su "${a}" / "${b}"`);
    }
  }
  console.log('✅ Test 6: comparatore antisimmetrico su tutte le coppie.');

  console.log('Tutti i test naturalSort passati con successo!\n');
}

runTests();
