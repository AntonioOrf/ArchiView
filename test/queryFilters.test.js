const assert = require('assert');
const fs = require('fs');
const path = require('path');

const UTILS = path.join(__dirname, '..', 'out', 'renderer', 'js', 'logic', 'utils.js');

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

function estraiCostante(sorgente, nome) {
  const marker = 'const ' + nome + ' = {';
  const inizio = sorgente.indexOf(marker);
  assert.notStrictEqual(inizio, -1, `Costante ${nome} non trovata in utils.ts`);
  const fine = sorgente.indexOf('};', inizio);
  assert.notStrictEqual(fine, -1, `Costante ${nome} non chiusa`);
  return sorgente.substring(inizio, fine + 2);
}

function caricaFunzioni() {
  const src = (fs.readFileSync(UTILS, 'utf8') + '\n' + fs.readFileSync(UTILS.replace('utils.js', 'ricercaLogic.js'), 'utf8'));
  const codice = [
    estraiFunzione(src, 'normalizzaTesto'),
    estraiFunzione(src, 'testoIndicizzabile'),
    estraiFunzione(src, 'analizzaQuery'),
    estraiCostante(src, 'ALIAS_CAMPI_QUERY'),
    estraiFunzione(src, 'recordPassaCampi'),
    estraiFunzione(src, 'recordPassaFiltri'),
    estraiFunzione(src, 'cartellaNelSottoalbero'),
    estraiFunzione(src, 'contaFiltriAvanzati')
  ].join('\n');

  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', codice)(window);
  for (const f of ['analizzaQuery', 'recordPassaCampi', 'recordPassaFiltri', 'cartellaNelSottoalbero', 'contaFiltriAvanzati']) {
    assert.strictEqual(typeof window[f], 'function', `${f} non caricata`);
  }
  return window;
}

function runTests() {
  console.log('Running queryFilters tests...');
  const W = caricaFunzioni();

  let q = W.analizzaQuery('Notaio Perùgia');
  assert.deepStrictEqual(q.testo, ['notaio', 'perugia']);
  assert.deepStrictEqual(q.campi, []);
  console.log('OK Test 1: query libera, token normalizzati.');

  q = W.analizzaQuery('notaio:rossi 1340 titolo:"vendita di terreno"');
  assert.deepStrictEqual(q.testo, ['1340']);
  assert.deepStrictEqual(q.campi, [
    { campo: 'notaio', valore: 'rossi' },
    { campo: 'titolo', valore: 'uendita di terreno' }
  ]);
  console.log('OK Test 2: vincoli campo:valore, con e senza virgolette.');

  q = W.analizzaQuery('notaio: ');
  assert.deepStrictEqual(q.testo, []);
  assert.deepStrictEqual(q.campi, []);
  console.log('OK Test 3: campo: senza valore ignorato.');

  q = W.analizzaQuery('"data topica" firenze');
  assert.deepStrictEqual(q.testo, ['data topica', 'firenze']);
  console.log('OK Test 4: frase esatta tenuta come token unico.');

  const scheda = {
    id: 'a', segnatura: 'MS 12', Notaio: 'Giovanni Rossi', tags: 'pergamena, latino',
    tipoDocumento: 'imbreviature', cartella: 'Notarile',
    attori_dinamici: [{ k: 'Venditore', v: 'Bartolo da Sassoferrato' }],
    lastModified: Date.parse('2026-03-10T12:00:00')
  };
  assert.strictEqual(W.recordPassaCampi(scheda, [{ campo: 'notaio', valore: 'rossi' }]), true);
  assert.strictEqual(W.recordPassaCampi(scheda, [{ campo: 'notaio', valore: 'bianchi' }]), false);
  console.log('OK Test 5: nome del campo confrontato in forma normalizzata.');

  assert.strictEqual(W.recordPassaCampi({ id: 'b', titolo: 'rossi' }, [{ campo: 'notaio', valore: 'rossi' }]), false);
  console.log('OK Test 6: campo assente = record escluso.');

  assert.strictEqual(W.recordPassaCampi(scheda, [{ campo: 'attori_dinamici', valore: 'sassoferrato' }]), true);
  console.log('OK Test 7: dynamic_list indicizzata anche per il filtro per campo.');

  assert.strictEqual(W.recordPassaCampi(scheda, [{ campo: 'tag', valore: 'pergamena' }]), true);
  assert.strictEqual(W.recordPassaCampi(scheda, W.analizzaQuery('tipo:imbreviature').campi), true);
  assert.strictEqual(W.recordPassaCampi(scheda, W.analizzaQuery('archivio:notarile').campi), true);
  console.log('OK Test 8: alias tag:, tipo: e archivio: risolti.');

  assert.strictEqual(W.recordPassaCampi(scheda, [
    { campo: 'notaio', valore: 'rossi' }, { campo: 'tag', valore: 'latino' }
  ]), true);
  assert.strictEqual(W.recordPassaCampi(scheda, [
    { campo: 'notaio', valore: 'rossi' }, { campo: 'tag', valore: 'carta' }
  ]), false);
  console.log('OK Test 9: piu\' vincoli in AND.');

  assert.strictEqual(W.recordPassaFiltri(scheda, { tipo: 'imbreviature' }), true);
  assert.strictEqual(W.recordPassaFiltri(scheda, { tipo: 'fiscali' }), false);
  assert.strictEqual(W.recordPassaFiltri({ id: 'c' }, { tipo: 'manoscritto' }), true);
  console.log('OK Test 10: filtro per tipo documento, con default manoscritto.');

  const senzaAllegati = { id: 'd' };
  assert.strictEqual(W.recordPassaFiltri(senzaAllegati, { allegati: 'si' }), false);
  assert.strictEqual(W.recordPassaFiltri(senzaAllegati, { allegati: 'no' }), true);
  assert.ok(!('allegati' in senzaAllegati), 'recordPassaFiltri non deve scrivere sul record');
  assert.strictEqual(W.recordPassaFiltri({ id: 'e', allegati: [{ nome: 'x.jpg' }] }, { allegati: 'si' }), true);
  console.log('OK Test 11: filtro allegati corretto e senza effetti sul record.');

  assert.strictEqual(W.recordPassaFiltri({ id: 'f', trascrizione: '<p><br></p>' }, { trascrizione: 'si' }), false);
  assert.strictEqual(W.recordPassaFiltri({ id: 'f', trascrizione: '<p><br></p>' }, { trascrizione: 'no' }), true);
  assert.strictEqual(W.recordPassaFiltri({ id: 'g', trascrizione: '<p>In nomine Domini</p>' }, { trascrizione: 'si' }), true);
  console.log('OK Test 12: trascrizione vuota riconosciuta come assente.');

  assert.strictEqual(W.recordPassaFiltri(scheda, { daData: '2026-03-10', aData: '2026-03-10' }), true);
  assert.strictEqual(W.recordPassaFiltri(scheda, { daData: '2026-03-11' }), false);
  assert.strictEqual(W.recordPassaFiltri(scheda, { aData: '2026-03-09' }), false);
  console.log('OK Test 13: intervallo di data modifica inclusivo.');

  assert.strictEqual(W.recordPassaFiltri({ id: 'h' }, { daData: '2020-01-01' }), false);
  assert.strictEqual(W.recordPassaFiltri({ id: 'h' }, {}), true);
  console.log('OK Test 14: record senza data escluso dagli intervalli.');

  assert.strictEqual(W.cartellaNelSottoalbero('Notarile/Imbreviature', 'Notarile'), true);
  assert.strictEqual(W.cartellaNelSottoalbero('Notarile', 'Notarile'), true);
  assert.strictEqual(W.cartellaNelSottoalbero('Notarile2', 'Notarile'), false);
  assert.strictEqual(W.cartellaNelSottoalbero('Fiscale', 'Notarile'), false);
  assert.strictEqual(W.cartellaNelSottoalbero('Qualsiasi/Cosa', ''), true);
  console.log('OK Test 15: sottoalbero cartelle su confine di segmento.');

  assert.strictEqual(W.contaFiltriAvanzati(null), 0);
  assert.strictEqual(W.contaFiltriAvanzati({ tipo: '', sottocartelle: false, daData: '', aData: '', allegati: '', trascrizione: '' }), 0);
  assert.strictEqual(W.contaFiltriAvanzati({ tipo: 'x', sottocartelle: true, allegati: 'si' }), 3);
  console.log('OK Test 16: conteggio dei filtri avanzati attivi.');

  console.log('\nqueryFilters: tutti i test superati.');
}

runTests();
