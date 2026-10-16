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
    else if (sorgente[i] === '}') {
      livello--;
      if (livello === 0) break;
    }
  }
  assert.ok(livello === 0 && i < sorgente.length, `Corpo di ${nome} non bilanciato`);
  return sorgente.substring(inizio, i + 1) + ';';
}

function caricaFunzioni() {
  const src = (fs.readFileSync(UTILS, 'utf8') + '\n' + fs.readFileSync(UTILS.replace('utils.ts', 'ricercaLogic.ts'), 'utf8'));
  const codice = estraiFunzione(src, 'normalizzaTesto') + '\n' + estraiFunzione(src, 'tokenizzaRicerca')
    + '\n' + estraiFunzione(src, 'posizioneOriginale');
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

  const COMBINING_GRAVE = String.fromCharCode(0x0300);
  const APOSTROFI_CURVI = [0x2018, 0x2019, 0x02bc, 0x02b9, 0x2032].map(c => String.fromCharCode(c));

  assert.strictEqual(normalizzaTesto('Perùgia'), 'perugia');
  assert.strictEqual(normalizzaTesto('podestà'), 'podesta');
  assert.strictEqual(normalizzaTesto('NOTÀIO'), 'notaio');
  assert.strictEqual(normalizzaTesto('Peru' + COMBINING_GRAVE + 'gia'), 'perugia');
  console.log('✅ Test 1: diacritici rimossi e testo minuscolizzato.');

  for (const s of ['Perùgia', 'podestà e capitano', 'senza accenti', 'È così']) {
    assert.strictEqual(normalizzaTesto(s).length, s.length,
      `La normalizzazione deve preservare la lunghezza di "${s}"`);
  }
  console.log('✅ Test 2: lunghezza preservata sul testo precomposto.');

  for (const ap of APOSTROFI_CURVI) {
    assert.strictEqual(normalizzaTesto('Sant' + ap + 'Angelo'), "sant'angelo");
  }
  assert.strictEqual(normalizzaTesto("Sant'Angelo"), "sant'angelo");
  console.log('✅ Test 3: apostrofi curvi normalizzati su quello dritto.');

  assert.strictEqual(normalizzaTesto(null), '');
  assert.strictEqual(normalizzaTesto(undefined), '');
  assert.strictEqual(normalizzaTesto(0), '0');
  assert.strictEqual(normalizzaTesto(1340), '1340');
  console.log('✅ Test 4: null/undefined/numeri gestiti senza eccezioni.');

  assert.deepStrictEqual(tokenizzaRicerca('notaio 1340'), ['notaio', '1340']);
  assert.deepStrictEqual(tokenizzaRicerca('  notaio   1340  '), ['notaio', '1340']);
  assert.deepStrictEqual(tokenizzaRicerca('PERÙGIA'), ['perugia']);
  console.log('✅ Test 5: query spezzata in token normalizzati.');

  assert.deepStrictEqual(tokenizzaRicerca(''), []);
  assert.deepStrictEqual(tokenizzaRicerca('   '), []);
  assert.deepStrictEqual(tokenizzaRicerca(null), []);
  assert.deepStrictEqual(tokenizzaRicerca(undefined), []);
  console.log('✅ Test 6: query vuota non produce token.');

  const hay = normalizzaTesto('Rogito del notaio in Perùgia, anno 1340');
  for (const q of ['perugia', 'PERUGIA', 'perùgia', 'notaio 1340', 'rogito perugia']) {
    const tokens = tokenizzaRicerca(q);
    assert.ok(tokens.every(t => hay.includes(t)), `"${q}" deve trovare il record`);
  }
  assert.ok(!tokenizzaRicerca('notaio 1350').every(t => hay.includes(t)),
    'Un token assente deve escludere il record (AND, non OR)');
  console.log('✅ Test 7: match AND sui token, accenti indifferenti.');

  const S_LUNGA = String.fromCharCode(0x017f);
  const R_ROTONDA = String.fromCharCode(0xa75b);
  const AE = String.fromCharCode(0x00e6);
  assert.strictEqual(normalizzaTesto('uita'), normalizzaTesto('Vita'));
  assert.strictEqual(normalizzaTesto('Iesus'), normalizzaTesto('Jesus'));
  assert.strictEqual(normalizzaTesto(S_LUNGA + 'anctu' + S_LUNGA), 'sanctus');
  assert.strictEqual(normalizzaTesto('ma' + R_ROTONDA + 'tiri'), 'martiri');
  assert.strictEqual(normalizzaTesto('Vit' + AE + ' ' + AE + 'terna'), 'uitae aeterna');
  console.log('✅ Test 8: u/v, i/j, s lunga, r rotonda, ae legata.');

  const { posizioneOriginale } = caricaFunzioni();
  const orig = 'in uit' + AE + ' ' + AE + 'ternae';
  const norm = normalizzaTesto(orig);
  const j = norm.indexOf('aeternae');
  assert.strictEqual(orig.slice(posizioneOriginale(orig, j), posizioneOriginale(orig, j + 8)), AE + 'ternae');
  console.log('✅ Test 9: posizione del match riportata sull\'originale.');

  console.log('Tutti i test searchNormalize passati con successo!\n');
}

runTests();
