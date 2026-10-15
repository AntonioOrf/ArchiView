const assert = require('assert');
const fs = require('fs');
const path = require('path');

// PIANO-REFACTOR Fase 2: il riepilogo delle modifiche in arrivo è uno solo per Drive e Hub.
// Prima erano due copie e quella dell'Hub non mostrava le eliminazioni. Si carica il file
// COMPILATO (out/, lo produce `pretest:unit`) contro un `window` finto: `t` restituisce il ripiego
// italiano, come l'app senza traduzione.
const FILE = path.join(__dirname, '..', 'out', 'renderer', 'js', 'logic', 'diffMergeLogic.js');
const window = { t: (_k, ripiego) => ripiego };
// eslint-disable-next-line no-new-func
new Function('window', fs.readFileSync(FILE, 'utf8'))(window);
const riepilogo = window.riepilogoInArrivo;
assert.strictEqual(typeof riepilogo, 'function', 'riepilogoInArrivo non caricata');

console.log('Running riepilogoInArrivo tests...');

const etichette = (voci) => voci.map(v => v.label);

// Test 1: niente di nuovo, nessuna voce.
{
  const db = { cartelle: ['A'], tipiDocumento: [{ id: 't1', nome: 'X' }], deletedCartelle: [], deletedIds: [], manoscritti: [] };
  assert.deepStrictEqual(riepilogo(db, JSON.parse(JSON.stringify(db)), 'Maria'), []);
  console.log('✅ Test 1: database uguali, nessuna voce.');
}

// Test 2: cartelle nuove (plurale) e modelli nuovi o cambiati (singolare).
{
  const locale = { cartelle: ['A'], tipiDocumento: [{ id: 't1', nome: 'X' }] };
  const remoto = { cartelle: ['A', 'B', 'C'], tipiDocumento: [{ id: 't1', nome: 'X' }, { id: 't2', nome: 'Y' }] };
  assert.deepStrictEqual(etichette(riepilogo(locale, remoto, 'Maria')), ['+ 2 cartelle', '1 modello']);
  console.log('✅ Test 2: cartelle e modelli contati.');
}

// Test 3: le eliminazioni ci sono (era il difetto dell'Hub) e portano il nome e l'autore.
{
  const locale = { manoscritti: [{ id: 'r1', segnatura: 'Busta 3', modificatoDa: 'Luca' }], deletedIds: [], deletedCartelle: [] };
  const remoto = { deletedIds: ['r1', 'r9'], deletedCartelle: ['Notarile/Imbreviature'] };
  assert.deepStrictEqual(etichette(riepilogo(locale, remoto, 'Maria')), [
    'Cartella eliminata: Imbreviature (da Maria)',
    'Eliminata: Busta 3 (da Luca)',
    'Eliminata: Scheda sconosciuta (da Maria)'
  ]);
  console.log('✅ Test 3: eliminazioni di cartelle e schede, con autore.');
}

// Test 4: oltre dieci eliminazioni, una riga di riepilogo invece di una lista infinita.
{
  const ids = Array.from({ length: 13 }, (_, i) => 'x' + i);
  const voci = riepilogo({ manoscritti: [] }, { deletedIds: ids }, 'Maria');
  assert.strictEqual(voci.length, 11);
  assert.strictEqual(voci[10].label, '… e altre 3 eliminazioni');
  console.log('✅ Test 4: elenco troncato a dieci.');
}

// Test 5: senza autore si ripiega su "Collaboratore".
{
  const voci = riepilogo({}, { deletedCartelle: ['Z'] });
  assert.strictEqual(voci[0].label, 'Cartella eliminata: Z (da Collaboratore)');
  console.log('✅ Test 5: autore assente.');
}

console.log('Tutti i test riepilogoInArrivo passati con successo!');
