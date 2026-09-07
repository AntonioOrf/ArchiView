const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Esercita le funzioni REALI della Fase 1.3 (filtri avanzati e sintassi campo:valore).
// Stesso metodo di searchNormalize.test.js: il renderer non e' importabile (tutto vive su
// `window`, il bundle ha effetti collaterali all'avvio), quindi si estrae il sorgente da
// utils.ts e lo si valuta contro un `window` finto. Se la forma di una funzione cambia,
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

/** La mappa degli alias e' una const top-level: serve anche lei a recordPassaCampi. */
function estraiCostante(sorgente, nome) {
  const marker = 'const ' + nome + ' = {';
  const inizio = sorgente.indexOf(marker);
  assert.notStrictEqual(inizio, -1, `Costante ${nome} non trovata in utils.ts`);
  const fine = sorgente.indexOf('};', inizio);
  assert.notStrictEqual(fine, -1, `Costante ${nome} non chiusa`);
  return sorgente.substring(inizio, fine + 2);
}

function caricaFunzioni() {
  const src = fs.readFileSync(UTILS, 'utf8');
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

  // 1) Query semplice: nessun vincolo per campo, token normalizzati.
  let q = W.analizzaQuery('Notaio Perùgia');
  assert.deepStrictEqual(q.testo, ['notaio', 'perugia']);
  assert.deepStrictEqual(q.campi, []);
  console.log('OK Test 1: query libera, token normalizzati.');

  // 2) campo:valore, anche fra virgolette e mescolato a token liberi.
  q = W.analizzaQuery('notaio:rossi 1340 titolo:"vendita di terreno"');
  assert.deepStrictEqual(q.testo, ['1340']);
  assert.deepStrictEqual(q.campi, [
    { campo: 'notaio', valore: 'rossi' },
    { campo: 'titolo', valore: 'vendita di terreno' }
  ]);
  console.log('OK Test 2: vincoli campo:valore, con e senza virgolette.');

  // 3) `campo:` a meta' digitazione viene IGNORATO. Senza questo, ogni battuta fra
  //    "notaio" e "notaio:x" filtrerebbe per il token letterale "notaio:" e svuoterebbe
  //    la lista sotto le dita dell'utente.
  q = W.analizzaQuery('notaio: ');
  assert.deepStrictEqual(q.testo, []);
  assert.deepStrictEqual(q.campi, []);
  console.log('OK Test 3: campo: senza valore ignorato.');

  // 4) Frase fra virgolette = un token solo (ricerca di sequenza, non di parole sparse).
  q = W.analizzaQuery('"data topica" firenze');
  assert.deepStrictEqual(q.testo, ['data topica', 'firenze']);
  console.log('OK Test 4: frase esatta tenuta come token unico.');

  // 5) recordPassaCampi: il confronto sul NOME del campo e' normalizzato (i tipi
  //    documento hanno campi come `Notaio` e `Marginalia`, con la maiuscola).
  const scheda = {
    id: 'a', segnatura: 'MS 12', Notaio: 'Giovanni Rossi', tags: 'pergamena, latino',
    tipoDocumento: 'imbreviature', cartella: 'Notarile',
    attori_dinamici: [{ k: 'Venditore', v: 'Bartolo da Sassoferrato' }],
    lastModified: Date.parse('2026-03-10T12:00:00')
  };
  assert.strictEqual(W.recordPassaCampi(scheda, [{ campo: 'notaio', valore: 'rossi' }]), true);
  assert.strictEqual(W.recordPassaCampi(scheda, [{ campo: 'notaio', valore: 'bianchi' }]), false);
  console.log('OK Test 5: nome del campo confrontato in forma normalizzata.');

  // 6) Un campo che il record NON possiede lo esclude. E' il punto della sintassi:
  //    `notaio:rossi` deve dare le schede notarili, non tutte quelle senza quel campo.
  assert.strictEqual(W.recordPassaCampi({ id: 'b', titolo: 'rossi' }, [{ campo: 'notaio', valore: 'rossi' }]), false);
  console.log('OK Test 6: campo assente = record escluso.');

  // 7) Le dynamic_list sono cercabili per campo (i nomi di persona vivono li' dentro).
  assert.strictEqual(W.recordPassaCampi(scheda, [{ campo: 'attori_dinamici', valore: 'sassoferrato' }]), true);
  console.log('OK Test 7: dynamic_list indicizzata anche per il filtro per campo.');

  // 8) Alias: `tag:` e `tipo:` sono quello che si digita, non `tags`/`tipodocumento`.
  assert.strictEqual(W.recordPassaCampi(scheda, [{ campo: 'tag', valore: 'pergamena' }]), true);
  assert.strictEqual(W.recordPassaCampi(scheda, [{ campo: 'tipo', valore: 'imbreviature' }]), true);
  console.log('OK Test 8: alias tag: e tipo: risolti.');

  // 9) Vincoli multipli in AND.
  assert.strictEqual(W.recordPassaCampi(scheda, [
    { campo: 'notaio', valore: 'rossi' }, { campo: 'tag', valore: 'latino' }
  ]), true);
  assert.strictEqual(W.recordPassaCampi(scheda, [
    { campo: 'notaio', valore: 'rossi' }, { campo: 'tag', valore: 'carta' }
  ]), false);
  console.log('OK Test 9: piu\' vincoli in AND.');

  // 10) Filtro per tipo. Il default `manoscritto` vale per i record senza tipoDocumento.
  assert.strictEqual(W.recordPassaFiltri(scheda, { tipo: 'imbreviature' }), true);
  assert.strictEqual(W.recordPassaFiltri(scheda, { tipo: 'fiscali' }), false);
  assert.strictEqual(W.recordPassaFiltri({ id: 'c' }, { tipo: 'manoscritto' }), true);
  console.log('OK Test 10: filtro per tipo documento, con default manoscritto.');

  // 11) Presenza di allegati, senza mutare il record: un predicato di filtro che scrive
  //     `m.allegati = []` su ogni scheda scorsa sporcherebbe il database a ogni render.
  const senzaAllegati = { id: 'd' };
  assert.strictEqual(W.recordPassaFiltri(senzaAllegati, { allegati: 'si' }), false);
  assert.strictEqual(W.recordPassaFiltri(senzaAllegati, { allegati: 'no' }), true);
  assert.ok(!('allegati' in senzaAllegati), 'recordPassaFiltri non deve scrivere sul record');
  assert.strictEqual(W.recordPassaFiltri({ id: 'e', allegati: [{ nome: 'x.jpg' }] }, { allegati: 'si' }), true);
  console.log('OK Test 11: filtro allegati corretto e senza effetti sul record.');

  // 12) "Ha trascrizione": un contenteditable svuotato lascia markup vuoto. Senza lo
  //     strip dei tag, ogni scheda mai aperta in trascrizione risulterebbe trascritta.
  assert.strictEqual(W.recordPassaFiltri({ id: 'f', trascrizione: '<p><br></p>' }, { trascrizione: 'si' }), false);
  assert.strictEqual(W.recordPassaFiltri({ id: 'f', trascrizione: '<p><br></p>' }, { trascrizione: 'no' }), true);
  assert.strictEqual(W.recordPassaFiltri({ id: 'g', trascrizione: '<p>In nomine Domini</p>' }, { trascrizione: 'si' }), true);
  console.log('OK Test 12: trascrizione vuota riconosciuta come assente.');

  // 13) Intervallo di date, inclusivo su ENTRAMBI gli estremi: "fino al 10" deve
  //     contenere una modifica fatta il 10 a mezzogiorno.
  assert.strictEqual(W.recordPassaFiltri(scheda, { daData: '2026-03-10', aData: '2026-03-10' }), true);
  assert.strictEqual(W.recordPassaFiltri(scheda, { daData: '2026-03-11' }), false);
  assert.strictEqual(W.recordPassaFiltri(scheda, { aData: '2026-03-09' }), false);
  console.log('OK Test 13: intervallo di data modifica inclusivo.');

  // 14) Un record senza lastModified non entra in un intervallo richiesto.
  assert.strictEqual(W.recordPassaFiltri({ id: 'h' }, { daData: '2020-01-01' }), false);
  assert.strictEqual(W.recordPassaFiltri({ id: 'h' }, {}), true);
  console.log('OK Test 14: record senza data escluso dagli intervalli.');

  // 15) Sottoalbero delle cartelle: prefisso solo su confine di segmento, altrimenti
  //     "Notarile" tirerebbe dentro anche "Notarile2".
  assert.strictEqual(W.cartellaNelSottoalbero('Notarile/Imbreviature', 'Notarile'), true);
  assert.strictEqual(W.cartellaNelSottoalbero('Notarile', 'Notarile'), true);
  assert.strictEqual(W.cartellaNelSottoalbero('Notarile2', 'Notarile'), false);
  assert.strictEqual(W.cartellaNelSottoalbero('Fiscale', 'Notarile'), false);
  // Radice virtuale: il suo sottoalbero e' l'archivio intero.
  assert.strictEqual(W.cartellaNelSottoalbero('Qualsiasi/Cosa', ''), true);
  console.log('OK Test 15: sottoalbero cartelle su confine di segmento.');

  // 16) Conteggio per il badge: zero filtri = nessun badge.
  assert.strictEqual(W.contaFiltriAvanzati(null), 0);
  assert.strictEqual(W.contaFiltriAvanzati({ tipo: '', sottocartelle: false, daData: '', aData: '', allegati: '', trascrizione: '' }), 0);
  assert.strictEqual(W.contaFiltriAvanzati({ tipo: 'x', sottocartelle: true, allegati: 'si' }), 3);
  console.log('OK Test 16: conteggio dei filtri avanzati attivi.');

  console.log('\nqueryFilters: tutti i test superati.');
}

runTests();
