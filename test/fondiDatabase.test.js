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
    { tipiDocumento: [{ id: 't1', nome: 'vecchio', campi: ['a', 'notaio'] }, { id: 't2', nome: 'solo locale', campi: [] }] },
    { tipiDocumento: [{ id: 't1', nome: 'nuovo', campi: ['a', 'b'] }] });
  assert.deepStrictEqual(esito.tipiDocumento.map(t => t.nome).sort(), ['nuovo', 'solo locale']);
  assert.deepStrictEqual(esito.tipiDocumento.find(t => t.id === 't1').campi, ['a', 'notaio', 'b']);
  console.log('✅ Test 3: modelli senza base fusi senza perdere campi.');
}

{
  const tipo = (campi, extra = {}) => ({ id: 't1', nome: 'Atto', campi, ...extra });
  const fondi = (b, l, e, extraL = {}, extraE = {}) => Model.fondiDatabase(
    { tipiDocumento: l, baseStruttura: { tipiDocumento: b }, ...extraL }, { tipiDocumento: e, ...extraE });

  let esito = fondi([tipo(['a', 'b'])], [tipo(['a', 'b', 'notaio'])], [tipo(['a', 'b'])]);
  assert.deepStrictEqual(esito.tipiDocumento[0].campi, ['a', 'b', 'notaio']);
  esito = fondi([tipo(['a', 'b', 'c'])], [tipo(['a', 'b', 'c', 'd'])], [tipo(['a', 'c'])]);
  assert.deepStrictEqual(esito.tipiDocumento[0].campi, ['a', 'c', 'd']);
  esito = fondi([tipo(['a', 'b'])], [tipo(['a'])], [tipo(['a', 'b', 'x'])]);
  assert.deepStrictEqual(esito.tipiDocumento[0].campi, ['a', 'x']);
  esito = fondi([tipo(['a', 'b'])], [tipo(['a', 'b'], { campiDef: { a: { tipo: 'date' } } })],
    [tipo(['a', 'b'], { campiDef: { b: { tipo: 'number' } } })]);
  assert.deepStrictEqual(esito.tipiDocumento[0].campiDef, { a: { tipo: 'date' }, b: { tipo: 'number' } });
  esito = fondi([tipo(['a'])], [tipo(['a'])], [tipo(['a'], { nome: 'Atto notarile' })]);
  assert.strictEqual(esito.tipiDocumento[0].nome, 'Atto notarile');
  assert.deepStrictEqual(esito.tipiInConflitto, []);
  esito = fondi([tipo(['a'])], [tipo(['a'], { nome: 'L' })], [tipo(['a'], { nome: 'E' })]);
  assert.strictEqual(esito.tipiDocumento[0].nome, 'L');
  assert.deepStrictEqual(esito.tipiInConflitto, ['L']);
  console.log('✅ Test 3b: modelli a tre vie, campi aggiunti e tolti dai due lati.');
}

{
  const t2 = { id: 't2', nome: 'Lettera', campi: ['a'] };
  let esito = Model.fondiDatabase({ tipiDocumento: [], deletedTipi: ['t2'] }, { tipiDocumento: [t2] });
  assert.deepStrictEqual(esito.tipiDocumento, []);
  assert.deepStrictEqual(esito.deletedTipi, ['t2']);
  esito = Model.fondiDatabase({ tipiDocumento: [t2] }, { tipiDocumento: [], deletedTipi: ['t2'] });
  assert.deepStrictEqual(esito.tipiDocumento, []);
  esito = Model.fondiDatabase({ tipiDocumento: [t2], baseStruttura: { tipiDocumento: [t2] } }, { tipiDocumento: [] });
  assert.deepStrictEqual(esito.tipiDocumento, []);
  esito = Model.fondiDatabase({ tipiDocumento: [t2], baseStruttura: { tipiDocumento: [] } }, { tipiDocumento: [] });
  assert.deepStrictEqual(esito.tipiDocumento.map(t => t.id), ['t2']);
  console.log('✅ Test 3c: modelli eliminati, con e senza tombstone.');
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
  const voc = (valori, extra = {}) => ({ materia: { id: 'materia', nome: 'Materia', valori, modificato: 1, ...extra } });
  const fondi = (bS, l, e) => Model.fondiDatabase({ ...l, baseStruttura: bS }, e);

  let esito = fondi({ vocabolari: voc(['a', 'b']) }, { vocabolari: voc(['a']) }, { vocabolari: voc(['a', 'b', 'c']) });
  assert.deepStrictEqual(esito.vocabolari.materia.valori, ['a', 'c']);
  esito = Model.fondiDatabase({ vocabolari: voc(['a']) }, { vocabolari: voc(['a', 'b']) });
  assert.deepStrictEqual(esito.vocabolari.materia.valori, ['a', 'b']);
  esito = fondi({ vocabolari: voc(['a']) }, { vocabolari: {} }, { vocabolari: voc(['a']) });
  assert.deepStrictEqual(esito.vocabolari, {});
  esito = fondi({ vocabolari: voc(['a']) }, { vocabolari: {} }, { vocabolari: voc(['a', 'z'], { modificato: 2 }) });
  assert.deepStrictEqual(esito.vocabolari.materia.valori, ['a', 'z']);

  const tag = { notarile: { nome: 'notarile', modificato: 1 } };
  esito = fondi({ tagsAnagrafica: tag }, { tagsAnagrafica: {} }, { tagsAnagrafica: tag });
  assert.deepStrictEqual(esito.tagsAnagrafica, {});
  const aut = { 'persona:bartolo': { nome: 'Bartolo', modificato: 1 } };
  esito = fondi({ authority: aut }, { authority: aut }, { authority: {} });
  assert.deepStrictEqual(esito.authority, {});
  esito = fondi({ tagsAnagrafica: {} }, { tagsAnagrafica: {} }, { tagsAnagrafica: tag });
  assert.deepStrictEqual(Object.keys(esito.tagsAnagrafica), ['notarile']);
  console.log('✅ Test 3d: vocabolari, tag e authority a tre vie.');
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
