// Fase 4 — sicurezza del dato: merge campo per campo (4.4), rotazione degli snapshot (4.2)
// e scadenza del cestino (4.1). Sono le tre funzioni pure della fase: vivono in
// `shared/model.ts` proprio per essere provate qui, con `node` e senza Electron, sul BUILD
// reale in `out/` — non su una copia che può divergere (vedi searchNormalize.test.js).
const assert = require('assert');
const M = require('../out/shared/model');

let passati = 0;
function test(nome, fn) {
  fn();
  passati++;
  console.log('  ok  ' + nome);
}

console.log('fase4.test.js — merge per campo, rotazione snapshot, scadenza cestino');

// =============================================================================
// 4.4 — Merge campo per campo
// =============================================================================

function scheda(extra) {
  return Object.assign({
    id: 'r1', cartella: '', tipoDocumento: 'imbreviature',
    segnatura: 'ASP 1', notaio: 'Rossi', trascrizione: '<p>uno</p>',
    lastModified: 1000, modificatoDa: 'Tizio', creatoDa: 'Tizio'
  }, extra || {});
}

test('campi diversi toccati dalle due parti: nessun conflitto, entrambe le modifiche restano', () => {
  const base = scheda();
  const locale = scheda({ notaio: 'Bianchi', lastModified: 2000 });
  const esterno = scheda({ trascrizione: '<p>due</p>', lastModified: 3000, modificatoDa: 'Caio' });

  const { fuso, conflitti } = M.fondiRecord(base, locale, esterno);
  assert.deepStrictEqual(conflitti, []);
  assert.strictEqual(fuso.notaio, 'Bianchi');          // il mio
  assert.strictEqual(fuso.trascrizione, '<p>due</p>'); // il suo
  // Il record fuso è nuovo: porta il timestamp più alto, o al confronto successivo il lato
  // rimasto indietro rientrerebbe.
  assert.strictEqual(fuso.lastModified, 3000);
});

test('stesso campo, valori diversi: conflitto, e nel fuso resta il locale', () => {
  const base = scheda();
  const locale = scheda({ notaio: 'Bianchi' });
  const esterno = scheda({ notaio: 'Verdi' });

  const { fuso, conflitti } = M.fondiRecord(base, locale, esterno);
  assert.deepStrictEqual(conflitti, ['notaio']);
  assert.strictEqual(fuso.notaio, 'Bianchi');
});

test('stesso campo, stesso valore: non è un conflitto', () => {
  const base = scheda();
  const uguale = scheda({ notaio: 'Verdi' });
  const { conflitti } = M.fondiRecord(base, uguale, scheda({ notaio: 'Verdi' }));
  assert.deepStrictEqual(conflitti, []);
});

test('un campo aggiunto solo dall\'esterno entra nel fuso; uno tolto solo dall\'esterno sparisce', () => {
  const base = scheda();
  const locale = scheda();
  const conNuovo = scheda({ dataCronica: '1345' });
  assert.strictEqual(M.fondiRecord(base, locale, conNuovo).fuso.dataCronica, '1345');

  // Le chiavi che esistono solo quando hanno contenuto (`relazioni`, 3.5) si cancellano
  // togliendo la chiave: il merge deve saperlo esprimere, o l'ultimo collegamento tolto da
  // un collega tornerebbe in piedi al primo sync.
  const conRelazioni = scheda({ relazioni: [{ id: 'r2' }] });
  const senza = scheda();
  const esito = M.fondiRecord(conRelazioni, conRelazioni, senza);
  assert.deepStrictEqual(esito.conflitti, []);
  assert.ok(!('relazioni' in esito.fuso), 'la chiave doveva sparire');
});

test('i timestamp e la firma non sono contenuto: non generano conflitti', () => {
  const base = scheda();
  const locale = scheda({ lastModified: 5000, modificatoDa: 'Tizio' });
  const esterno = scheda({ lastModified: 9000, modificatoDa: 'Caio' });
  const { fuso, conflitti } = M.fondiRecord(base, locale, esterno);
  assert.deepStrictEqual(conflitti, []);
  // Nessun contenuto è arrivato dall'esterno: la firma resta quella locale.
  assert.strictEqual(fuso.modificatoDa, 'Tizio');
});

test('allegatoTipo segue allegati e non si fonde da solo', () => {
  const base = scheda({ allegati: [], allegatoTipo: '' });
  const locale = scheda({ allegati: [], allegatoTipo: '' });
  const esterno = scheda({ allegati: [{ nome: 'a.pdf' }], allegatoTipo: 'pdf' });
  const { fuso } = M.fondiRecord(base, locale, esterno);
  assert.strictEqual(fuso.allegatoTipo, 'pdf');
});

// =============================================================================
// 4.2 — Rotazione degli snapshot
// =============================================================================

const GIORNO = 86400000;
const ORA_FISSA = new Date(2026, 8, 10, 12, 0, 0).getTime(); // 10 settembre 2026, ora locale

/** Uno snapshot a `giorniFa` giorni e `oreFa` ore dall'istante di riferimento. */
function snap(nome, giorniFa, oreFa) {
  return { nome, creatoIl: ORA_FISSA - giorniFa * GIORNO - (oreFa || 0) * 3600000 };
}

test('i primi N snapshot si tengono a prescindere dall\'età', () => {
  const voci = [snap('a', 0), snap('b', 0, 1), snap('c', 0, 2), snap('d', 400), snap('e', 401)];
  const { tenere, eliminare } = M.rotazioneSnapshot(voci, { recenti: 3, giorni: 0, ora: ORA_FISSA });
  assert.deepStrictEqual(tenere, ['a', 'b', 'c']);
  // I due vecchi cadono: nessuno dei due criteri li salva.
  assert.deepStrictEqual(eliminare.sort(), ['d', 'e']);
});

test('di ogni giorno resta il più recente, per i giorni dichiarati', () => {
  const voci = [
    snap('oggi-tardi', 0), snap('oggi-presto', 0, 6),
    snap('ieri-tardi', 1), snap('ieri-presto', 1, 6),
    snap('vecchio', 10)
  ];
  // `recenti: 0` isola il secondo criterio: senza, i primi N lo maschererebbero.
  const { tenere } = M.rotazioneSnapshot(voci, { recenti: 0, giorni: 30, ora: ORA_FISSA });
  assert.deepStrictEqual(tenere.sort(), ['ieri-tardi', 'oggi-tardi', 'vecchio'].sort());
});

test('oltre la finestra dei giorni non si tiene nulla', () => {
  const voci = [snap('dentro', 29), snap('fuori', 31)];
  const { tenere, eliminare } = M.rotazioneSnapshot(voci, { recenti: 0, giorni: 30, ora: ORA_FISSA });
  assert.deepStrictEqual(tenere, ['dentro']);
  assert.deepStrictEqual(eliminare, ['fuori']);
});

test('i due criteri si sommano, non si escludono', () => {
  // Il più vecchio è fuori dalla finestra dei giorni ma dentro i "recenti": sopravvive.
  const voci = [snap('a', 0), snap('b', 100)];
  const { tenere, eliminare } = M.rotazioneSnapshot(voci, { recenti: 5, giorni: 30, ora: ORA_FISSA });
  assert.deepStrictEqual(tenere.sort(), ['a', 'b']);
  assert.deepStrictEqual(eliminare, []);
});

test('un elenco vuoto non elimina nulla e non lancia', () => {
  const esito = M.rotazioneSnapshot([], {});
  assert.deepStrictEqual(esito.tenere, []);
  assert.deepStrictEqual(esito.eliminare, []);
});

// =============================================================================
// 4.1 — Scadenza del cestino
// =============================================================================

function voce(id, giorniFa) {
  return { deletedAt: ORA_FISSA - giorniFa * GIORNO, record: { id } };
}

test('le voci scadute spariscono, le altre restano ordinate dalla più recente', () => {
  const voci = [voce('vecchia', 40), voce('nuova', 1), voce('media', 10)];
  const validi = M.cestinoValido(voci, { giorni: 30, ora: ORA_FISSA });
  assert.deepStrictEqual(validi.map(v => v.record.id), ['nuova', 'media']);
});

test('`giorni: 0` vuol dire "non conservare nulla", non "conservare per sempre"', () => {
  assert.deepStrictEqual(M.cestinoValido([voce('x', 0)], { giorni: 0, ora: ORA_FISSA }), []);
});

test('una voce malformata viene scartata invece di far cadere la lettura', () => {
  const voci = [voce('buona', 1), { record: { id: 'senza-data' } }, { deletedAt: ORA_FISSA }, null];
  const validi = M.cestinoValido(voci, { giorni: 30, ora: ORA_FISSA });
  assert.deepStrictEqual(validi.map(v => v.record.id), ['buona']);
});

console.log(`\n${passati} test superati.`);
