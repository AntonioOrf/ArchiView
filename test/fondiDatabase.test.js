const assert = require('assert');

const Model = require('../out/shared/model');

console.log('Running fondiDatabase tests...');

const scheda = (id, extra = {}) => ({ id, segnatura: id, lastModified: 1, ...extra });
const ids = (lista) => lista.map(m => m.id).sort();

{
  const locale = { cartelle: ['A'], manoscritti: [scheda('r1')], deletedIds: [] };
  const esterno = { cartelle: ['B'], manoscritti: [scheda('r2')], deletedIds: [] };
  const copiaL = JSON.stringify(locale);
  const copiaE = JSON.stringify(esterno);
  Model.fondiDatabase(locale, esterno);
  assert.strictEqual(JSON.stringify(locale), copiaL);
  assert.strictEqual(JSON.stringify(esterno), copiaE);
  console.log('✅ Test 1: locale ed esterno restano intatti.');
}

{
  const esito = Model.fondiDatabase(
    { cartelle: ['A', 'B'], deletedCartelle: [] },
    { cartelle: ['B', 'C', 'D'], deletedCartelle: ['A'] });
  assert.deepStrictEqual(esito.cartelle, ['B', 'C', 'D']);
  assert.deepStrictEqual(esito.deletedCartelle, ['A']);
  console.log('✅ Test 2: cartelle fuse, eliminazioni rispettate.');
}

{
  const esito = Model.fondiDatabase(
    { tipiDocumento: [{ id: 't1', nome: 'vecchio' }, { id: 't2', nome: 'solo locale' }] },
    { tipiDocumento: [{ id: 't1', nome: 'nuovo' }] });
  assert.deepStrictEqual(esito.tipiDocumento.map(t => t.nome).sort(), ['nuovo', 'solo locale']);
  console.log('✅ Test 3: modelli fusi.');
}

{
  const base = scheda('r1', { titolo: 'T', note: 'N' });
  const esito = Model.fondiDatabase(
    { manoscritti: [{ ...base, titolo: 'T locale', lastModified: 2 }], baseObjects: { r1: base }, baseHashes: {} },
    { manoscritti: [{ ...base, note: 'N remota', lastModified: 3 }] });
  assert.strictEqual(esito.schede.length, 1);
  assert.strictEqual(esito.schede[0].titolo, 'T locale');
  assert.strictEqual(esito.schede[0].note, 'N remota');
  console.log('✅ Test 4: fusione per campo con la base.');
}

{
  const base = scheda('r1', { titolo: 'base' });
  const baseHashes = { r1: Model.improntaRecord(base) };
  let esito = Model.fondiDatabase({ manoscritti: [base], baseHashes }, { manoscritti: [{ ...base, titolo: 'remoto' }] });
  assert.strictEqual(esito.schede[0].titolo, 'remoto');
  esito = Model.fondiDatabase({ manoscritti: [{ ...base, titolo: 'locale' }], baseHashes }, { manoscritti: [base] });
  assert.strictEqual(esito.schede[0].titolo, 'locale');
  esito = Model.fondiDatabase({ manoscritti: [{ ...base, titolo: 'locale' }], baseHashes }, { manoscritti: [{ ...base, titolo: 'remoto' }] });
  assert.strictEqual(esito.schede[0].titolo, 'locale');
  console.log('✅ Test 5: tre vie sull\'impronta.');
}

{
  let esito = Model.fondiDatabase(
    { manoscritti: [scheda('r1', { titolo: 'L', lastModified: 5 })] },
    { manoscritti: [scheda('r1', { titolo: 'E', lastModified: 9 })] });
  assert.strictEqual(esito.schede[0].titolo, 'E');
  esito = Model.fondiDatabase(
    { manoscritti: [scheda('r1', { titolo: 'L', lastModified: 9 })] },
    { manoscritti: [scheda('r1', { titolo: 'E', lastModified: 9 })] });
  assert.strictEqual(esito.schede[0].titolo, 'L');
  console.log('✅ Test 6: timestamp senza base.');
}

{
  const esito = Model.fondiDatabase(
    { manoscritti: [scheda('loc-tolta-dal-remoto'), scheda('comune')], deletedIds: ['remota-tolta-in-locale'] },
    { manoscritti: [scheda('remota-tolta-in-locale'), scheda('comune')], deletedIds: ['loc-tolta-dal-remoto'] });
  assert.deepStrictEqual(ids(esito.schede), ['comune']);
  assert.deepStrictEqual(ids(esito.eliminateDalRemoto), ['loc-tolta-dal-remoto']);
  assert.deepStrictEqual(ids(esito.eliminateInLocale), ['remota-tolta-in-locale']);
  console.log('✅ Test 7: eliminazioni da confermare separate.');
}

{
  const scelta = scheda('r1', { titolo: 'scelta' });
  const esito = Model.fondiDatabase(
    { manoscritti: [scheda('r1', { titolo: 'L' })] },
    { manoscritti: [scheda('r1', { titolo: 'E' })] },
    [scelta]);
  assert.strictEqual(esito.schede[0], scelta);
  console.log('✅ Test 8: le risolte vincono.');
}

{
  const base = scheda('r1', { allegati: [{ nome: 'a.jpg', trascrizione: '<p>x</p>' }] });
  const conCartaNuova = { ...base, allegati: [...base.allegati, { nome: 'b.jpg', trascrizione: '<p>y</p>' }] };
  let esito = Model.fondiDatabase({ manoscritti: [base], baseObjects: { r1: base } }, { manoscritti: [conCartaNuova] });
  assert.strictEqual(esito.daRicomporre.length, 1);
  esito = Model.fondiDatabase({ manoscritti: [base], baseObjects: { r1: base } }, { manoscritti: [base] });
  assert.strictEqual(esito.daRicomporre.length, 0);
  console.log('✅ Test 9: ricomposizione solo quando le carte cambiano.');
}

{
  const a = { id: 'x', titolo: 'T', note: 'N', lastModified: 1, modificatoDa: 'A' };
  const b = { note: 'N', titolo: 'T', id: 'x', lastModified: 9, creatoDa: 'B' };
  assert.strictEqual(Model.improntaRecord(a), Model.improntaRecord(b));
  assert.notStrictEqual(Model.improntaRecord(a), Model.improntaRecord({ ...a, titolo: 'U' }));
  assert.strictEqual(Model.improntaRecord(null), null);
  console.log('✅ Test 10: impronta stabile.');
}

console.log('Tutti i test fondiDatabase passati con successo!');
