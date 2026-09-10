// Fase 3.7 — campi propri della scheda: il modello documento è una BASE, e ogni scheda può
// portare campi che il suo tipo non prevede. Come per fase3/fase4, si esercita il build in
// out/ con `node`: il modello è puro, senza Electron e senza DOM.
const assert = require('assert');
const M = require('../out/shared/model');

let passati = 0;
function test(nome, fn) {
  fn();
  passati++;
  console.log('  ok  ' + nome);
}

console.log('campiPropri.test.js — Fase 3.7');

/** Il catalogo dei campi base che nell'app vive nel renderer (CONFIG_CAMPI). */
const BASE = {
  supporto: { label: 'Supporto', type: 'text' },
  attori_dinamici: { label: 'Persone / Attori', type: 'dynamic_list', authority: 'persona' }
};

const TIPO = { id: 'imbreviature', nome: 'Imbreviature', campi: ['supporto', 'attori_dinamici'] };

function scheda(extra) {
  return Object.assign({ id: 'r1', cartella: '', tipoDocumento: 'imbreviature' }, extra || {});
}

// --- Lettura ------------------------------------------------------------------

test('3.7.1: senza campi propri la scheda ha esattamente i campi del tipo', () => {
  const def = M.campiDellaScheda(scheda(), TIPO, BASE);
  assert.deepStrictEqual(def.map(d => d.id), ['supporto', 'attori_dinamici']);
});

test('3.7.2: i campi propri vengono IN CODA a quelli del tipo, con la loro definizione', () => {
  const m = scheda({ campiPropri: [{ id: 'Filigrana', tipo: 'text', label: 'Filigrana' }] });
  const def = M.campiDellaScheda(m, TIPO, BASE);
  assert.deepStrictEqual(def.map(d => d.id), ['supporto', 'attori_dinamici', 'Filigrana']);
  assert.strictEqual(def[2].label, 'Filigrana');
});

test('3.7.3: il TIPO vince sul campo proprio con lo stesso id (niente doppioni)', () => {
  // Il caso del campo promosso al modello da un collega: la definizione buona è quella del
  // tipo, e il campo non deve comparire due volte nel form.
  const m = scheda({ campiPropri: [{ id: 'supporto', tipo: 'number', label: 'Supporto mio' }] });
  const def = M.campiDellaScheda(m, TIPO, BASE);
  assert.deepStrictEqual(def.map(d => d.id), ['supporto', 'attori_dinamici']);
  assert.strictEqual(def[0].tipo, 'text');
});

test('3.7.4: un campo proprio senza etichetta la prende dal proprio id', () => {
  // Per un campo inventato non esiste una i18n `field_<id>`: senza questa regola la colonna
  // del CSV porterebbe l'id grezzo in un file destinato a un altro strumento.
  const m = scheda({ campiPropri: [{ id: 'Numero di carte', tipo: 'number' }] });
  assert.strictEqual(M.campiPropri(m)[0].label, 'Numero di carte');
});

test('3.7.5: voci senza id, doppie o non oggetti vengono ignorate', () => {
  const m = scheda({ campiPropri: ['x', null, { tipo: 'text' }, { id: 'A', tipo: 'text' }, { id: 'A', tipo: 'number' }] });
  assert.deepStrictEqual(M.campiPropri(m).map(d => d.id), ['A']);
  assert.strictEqual(M.campiPropri(m)[0].tipo, 'text');
});

test('3.7.6: un campo proprio può essere tipizzato come uno del modello', () => {
  const m = scheda({ campiPropri: [{ id: 'Datazione copia', tipo: 'date', label: 'Datazione copia' }] });
  const def = M.campiDellaScheda(m, TIPO, BASE).filter(d => d.tipo === 'date');
  assert.deepStrictEqual(def.map(d => d.id), ['Datazione copia']);
});

test('3.7.7: un campo proprio enum legato a un vocabolario risolve i valori dal db', () => {
  const d = { vocabolari: { supporti: { nome: 'Supporti', valori: ['pergamena', 'carta'] } } };
  const m = scheda({ campiPropri: [{ id: 'Rigatura', tipo: 'enum', label: 'Rigatura', vocabolario: 'supporti' }] });
  const def = M.campiDellaScheda(m, TIPO, BASE, d);
  assert.deepStrictEqual(def[2].opzioni, ['pergamena', 'carta']);
});

// --- Scrittura ----------------------------------------------------------------

test('3.7.8: la chiave SPARISCE quando non restano campi propri (impronta del record)', () => {
  const m = scheda({ campiPropri: [{ id: 'A', tipo: 'text', label: 'A' }] });
  M.scriviCampiPropri(m, []);
  assert.ok(!('campiPropri' in m), 'un `[]` cambierebbe getRecordHash su schede mai toccate');
});

test('3.7.9: scrivere toglie ciò che il TIPO già dichiara (campo promosso al modello)', () => {
  const m = scheda();
  M.scriviCampiPropri(m, [{ id: 'supporto', tipo: 'text', label: 'Supporto' }, { id: 'Filigrana', tipo: 'text' }], TIPO);
  assert.deepStrictEqual(m.campiPropri.map(d => d.id), ['Filigrana']);
});

test('3.7.10: `campiPropri` è una chiave di servizio (mai una colonna del CSV)', () => {
  assert.ok(M.CHIAVI_SERVIZIO.indexOf('campiPropri') !== -1);
});

// --- Merge a tre vie ----------------------------------------------------------

const defA = { id: 'A', tipo: 'text', label: 'A' };
const defB = { id: 'B', tipo: 'text', label: 'B' };

test('3.7.11: due colleghi aggiungono DUE campi diversi: si uniscono, nessun conflitto', () => {
  // Con il confronto per chiave intera questo era un conflitto, e il perdente restava con un
  // valore orfano: presente nel record, invisibile nel form.
  const base = scheda({ lastModified: 1 });
  const locale = scheda({ lastModified: 2, campiPropri: [defA], A: 'uno' });
  const esterno = scheda({ lastModified: 3, campiPropri: [defB], B: 'due' });

  const { fuso, conflitti } = M.fondiRecord(base, locale, esterno);
  assert.deepStrictEqual(conflitti, []);
  assert.deepStrictEqual(fuso.campiPropri.map(d => d.id), ['A', 'B']);
  assert.strictEqual(fuso.A, 'uno');
  assert.strictEqual(fuso.B, 'due');
});

test('3.7.12: lo STESSO id con due definizioni diverse è un conflitto, e resta il locale', () => {
  const base = scheda({ lastModified: 1 });
  const locale = scheda({ lastModified: 2, campiPropri: [{ id: 'A', tipo: 'text', label: 'A' }] });
  const esterno = scheda({ lastModified: 3, campiPropri: [{ id: 'A', tipo: 'number', label: 'A' }] });

  const { fuso, conflitti } = M.fondiRecord(base, locale, esterno);
  assert.deepStrictEqual(conflitti, ['campiPropri']);
  assert.strictEqual(fuso.campiPropri[0].tipo, 'text');
});

test('3.7.13: un campo TOLTO da un lato sparisce, non viene rimesso dall\'unione', () => {
  const base = scheda({ lastModified: 1, campiPropri: [defA, defB] });
  const locale = scheda({ lastModified: 2, campiPropri: [defA, defB] });
  const esterno = scheda({ lastModified: 3, campiPropri: [defA] });

  const { fuso, conflitti } = M.fondiRecord(base, locale, esterno);
  assert.deepStrictEqual(conflitti, []);
  assert.deepStrictEqual(fuso.campiPropri.map(d => d.id), ['A']);
});

test('3.7.14: la chiave sparisce dal fuso quando entrambi i lati svuotano', () => {
  const base = scheda({ lastModified: 1, campiPropri: [defA] });
  const locale = scheda({ lastModified: 2 });
  const esterno = scheda({ lastModified: 3 });
  const { fuso } = M.fondiRecord(base, locale, esterno);
  assert.ok(!('campiPropri' in fuso));
});

test('3.7.15: l\'ordine è quello locale, poi ciò che arriva da fuori', () => {
  const base = scheda({ lastModified: 1 });
  const locale = scheda({ lastModified: 2, campiPropri: [defB] });
  const esterno = scheda({ lastModified: 3, campiPropri: [defA] });
  const { fuso } = M.fondiRecord(base, locale, esterno);
  assert.deepStrictEqual(fuso.campiPropri.map(d => d.id), ['B', 'A']);
});

test('3.7.16: unisciCampiPropri: il primo elenco vince sui doppioni', () => {
  const uniti = M.unisciCampiPropri([{ id: 'A', tipo: 'text', label: 'mio' }], [{ id: 'A', tipo: 'number', label: 'suo' }, defB]);
  assert.deepStrictEqual(uniti.map(d => d.id), ['A', 'B']);
  assert.strictEqual(uniti[0].label, 'mio');
});

// --- Ordine dei campi nella scheda (Fase 3.8) ---------------------------------

test('3.8.1: senza ordine dichiarato vale quello naturale (tipo, poi campi propri)', () => {
  const m = scheda({ campiPropri: [{ id: 'A', tipo: 'text', label: 'A' }] });
  assert.deepStrictEqual(M.campiDellaScheda(m, TIPO, BASE).map(d => d.id),
    ['supporto', 'attori_dinamici', 'A']);
});

test('3.8.2: `ordineCampi` riordina i campi di QUESTA scheda', () => {
  const m = scheda({
    campiPropri: [{ id: 'A', tipo: 'text', label: 'A' }],
    ordineCampi: ['A', 'attori_dinamici', 'supporto']
  });
  assert.deepStrictEqual(M.campiDellaScheda(m, TIPO, BASE).map(d => d.id),
    ['A', 'attori_dinamici', 'supporto']);
  // Il MODELLO non si tocca: è tutto il punto della scelta per-scheda.
  assert.deepStrictEqual(TIPO.campi, ['supporto', 'attori_dinamici']);
});

test('3.8.3: un ordine PARZIALE mette il resto in coda, nell ordine naturale', () => {
  // Serve a sopravvivere a un modello che cambia: un campo aggiunto al tipo dopo il riordino
  // deve comparire comunque, invece di sparire perché nessuno lo aveva elencato.
  const m = scheda({ ordineCampi: ['attori_dinamici'] });
  assert.deepStrictEqual(M.campiDellaScheda(m, TIPO, BASE).map(d => d.id),
    ['attori_dinamici', 'supporto']);
});

test('3.8.4: gli id che non esistono (più) vengono ignorati', () => {
  const m = scheda({ ordineCampi: ['fantasma', 'attori_dinamici', 'fantasma'] });
  assert.deepStrictEqual(M.campiDellaScheda(m, TIPO, BASE).map(d => d.id),
    ['attori_dinamici', 'supporto']);
});

test('3.8.5: un ordine uguale a quello naturale NON si salva', () => {
  const naturali = M.campiDellaScheda(scheda(), TIPO, BASE);
  const m = scheda();
  M.scriviOrdineCampi(m, naturali.map(d => d.id), naturali);
  assert.ok(!('ordineCampi' in m), 'una chiave in più cambierebbe getRecordHash');

  M.scriviOrdineCampi(m, ['attori_dinamici', 'supporto'], naturali);
  assert.deepStrictEqual(m.ordineCampi, ['attori_dinamici', 'supporto']);
});

test('3.8.6: scrivendo si scartano gli id che non sono campi della scheda', () => {
  const naturali = M.campiDellaScheda(scheda(), TIPO, BASE);
  const m = scheda();
  M.scriviOrdineCampi(m, ['attori_dinamici', 'fantasma', 'supporto'], naturali);
  assert.deepStrictEqual(m.ordineCampi, ['attori_dinamici', 'supporto']);
});

test('3.8.7: `ordineCampi` è una chiave di servizio (mai una colonna del CSV)', () => {
  assert.ok(M.CHIAVI_SERVIZIO.indexOf('ordineCampi') !== -1);
});

test('3.8.8: due riordini diversi della stessa scheda sono un conflitto vero', () => {
  const base = scheda({ lastModified: 1 });
  const locale = scheda({ lastModified: 2, ordineCampi: ['attori_dinamici', 'supporto'] });
  const esterno = scheda({ lastModified: 3, ordineCampi: ['supporto', 'attori_dinamici'] });
  const { fuso, conflitti } = M.fondiRecord(base, locale, esterno);
  // Nessun caso speciale: l'ordine è una scelta sola, e due scelte diverse vanno decise
  // dall'utente. Nel fuso resta il locale, come per ogni altro campo.
  assert.deepStrictEqual(conflitti, ['ordineCampi']);
  assert.deepStrictEqual(fuso.ordineCampi, ['attori_dinamici', 'supporto']);
});

test('3.8.9: chi riordina e chi aggiunge un campo proprio non si ostacolano', () => {
  const base = scheda({ lastModified: 1 });
  const locale = scheda({ lastModified: 2, ordineCampi: ['attori_dinamici', 'supporto'] });
  const esterno = scheda({ lastModified: 3, campiPropri: [{ id: 'A', tipo: 'text', label: 'A' }], A: 'x' });
  const { fuso, conflitti } = M.fondiRecord(base, locale, esterno);
  assert.deepStrictEqual(conflitti, []);
  // Il campo arrivato da fuori non è nell'ordine: finisce in coda, non sparisce.
  assert.deepStrictEqual(M.campiDellaScheda(fuso, TIPO, BASE).map(d => d.id),
    ['attori_dinamici', 'supporto', 'A']);
});

console.log(`\n${passati} test superati.`);
