const assert = require('assert');
const M = require('../out/shared/model');

let passati = 0;
function test(nome, fn) {
  fn();
  passati++;
  console.log('  ok  ' + nome);
}

console.log('tags.test.js — anagrafica, rinomina, fusione, filtro esatto');

function db(schede, anagrafica) {
  return {
    schemaVersion: M.SCHEMA_VERSION,
    cartelle: [],
    tipiDocumento: [],
    manoscritti: schede.map((s, i) => Object.assign({ id: 'r' + i, cartella: '', tipoDocumento: 'imbreviature', lastModified: 1000, modificatoDa: 'Tizio' }, s)),
    tagsAnagrafica: anagrafica || undefined
  };
}

test('Test 1: la lista si ricava da CSV, da array e dal nulla', () => {
  assert.deepStrictEqual(M.listaTag('  pergamena ,, notarile ,  '), ['pergamena', 'notarile']);
  assert.deepStrictEqual(M.listaTag(['a', ' b ', '']), ['a', 'b']);
  assert.deepStrictEqual(M.listaTag(null), []);
  assert.deepStrictEqual(M.listaTag(undefined), []);
  assert.deepStrictEqual(M.tags({ tags: 'x, y' }), ['x', 'y']);
  assert.deepStrictEqual(M.tags({}), []);
});

test('Test 2: gli spazi interni si riducono a uno e i duplicati spariscono', () => {
  assert.deepStrictEqual(M.listaTag('sec.  XIV, sec. XIV'), ['sec. XIV']);
  assert.deepStrictEqual(M.listaTag('Pergamena, pergamena, PERGAMENA'), ['Pergamena']);
  assert.deepStrictEqual(M.listaTag('Perùgia, perugia'), ['Perùgia']);
});

test('Test 3: la forma su disco resta la stringa CSV', () => {
  const m = { tags: '' };
  assert.strictEqual(M.scriviTags(m, ['a', 'b']), true);
  assert.strictEqual(m.tags, 'a, b');
  assert.strictEqual(typeof m.tags, 'string');
  assert.strictEqual(M.scriviTags(m, ['a', 'b']), false);
  assert.strictEqual(M.scriviTags(m, 'a,  b'), false);
});

test('Test 4: `not` non seleziona `notaio` (corrispondenza esatta)', () => {
  const m = { tags: 'notaio, pergamena' };
  assert.strictEqual(M.haTag(m, 'not'), false);
  assert.strictEqual(M.haTag(m, 'notaio'), true);
  assert.strictEqual(M.haTag({ tags: 'sec. XIV in.' }, 'sec. XIV'), false);
  assert.strictEqual(M.haTag({ tags: 'Perùgia' }, 'perugia'), true);
  assert.strictEqual(M.haTag(m, ''), false);
});

test('Test 5: i conteggi raggruppano per chiave e mostrano la grafia canonica', () => {
  const d = db([
    { tags: 'Pergamena, notaio' },
    { tags: 'pergamena' },
    { tags: 'PERGAMENA, Notaio' }
  ]);
  const voci = M.conteggiTag(d.manoscritti, d);
  assert.deepStrictEqual(voci.map(v => [v.nome, v.conteggio]), [['notaio', 2], ['Pergamena', 3]]);

  d.tagsAnagrafica = { pergamena: { nome: 'PERGAMENA' } };
  assert.strictEqual(M.conteggiTag(d.manoscritti, d).find(v => v.chiave === 'pergamena').nome, 'PERGAMENA');
});

test('Test 6: il colore vive nell\'anagrafica e solo i colori della palette valgono', () => {
  const d = db([{ tags: 'pergamena' }]);
  assert.strictEqual(M.coloreTag(d, 'pergamena'), '');
  assert.strictEqual(M.impostaColoreTag(d, 'Pergamena', 'verde'), true);
  assert.strictEqual(M.coloreTag(d, 'pergamena'), 'verde');
  assert.strictEqual(M.impostaColoreTag(d, 'pergamena', 'fucsia'), true);
  assert.strictEqual(M.coloreTag(d, 'pergamena'), '');
  assert.strictEqual(d.manoscritti[0].lastModified, 1000);
});

test('Test 7: la rinomina propaga su tutte le schede e firma solo quelle toccate', () => {
  const d = db([{ tags: 'pergamana, notaio' }, { tags: 'pergamana' }, { tags: 'ESCA' }]);
  const esito = M.rinominaTag(d, 'pergamana', 'pergamena', { autore: 'Caio', quando: 5000 });

  assert.strictEqual(esito.schede, 2);
  assert.strictEqual(d.manoscritti[0].tags, 'pergamena, notaio');
  assert.strictEqual(d.manoscritti[1].tags, 'pergamena');
  assert.strictEqual(d.manoscritti[2].tags, 'ESCA');
  assert.strictEqual(d.manoscritti[2].lastModified, 1000);
  assert.strictEqual(d.manoscritti[2].modificatoDa, 'Tizio');
  assert.strictEqual(d.manoscritti[0].lastModified, 5000);
  assert.strictEqual(d.manoscritti[0].modificatoDa, 'Caio');
});

test('Test 8: rinominare su un tag esistente fonde invece di duplicare', () => {
  const d = db([{ tags: 'notaio, notai' }]);
  M.rinominaTag(d, 'notaio', 'notai');
  assert.strictEqual(d.manoscritti[0].tags, 'notai');
});

test('Test 9: la rinomina di sola grafia aggiorna l\'anagrafica, non l\'identità', () => {
  const d = db([{ tags: 'perugia' }], { perugia: { nome: 'perugia', colore: 'blu' } });
  M.rinominaTag(d, 'perugia', 'Perugia');
  assert.strictEqual(d.manoscritti[0].tags, 'Perugia');
  assert.strictEqual(d.tagsAnagrafica.perugia.nome, 'Perugia');
  assert.strictEqual(d.tagsAnagrafica.perugia.colore, 'blu');
});

test('Test 10: la voce d\'anagrafica segue la chiave nuova e ne eredita il colore', () => {
  const d = db([{ tags: 'a' }], { a: { nome: 'a', colore: 'rosso' } });
  M.rinominaTag(d, 'a', 'b');
  assert.strictEqual(d.tagsAnagrafica.a, undefined);
  assert.strictEqual(d.tagsAnagrafica.b.nome, 'b');
  assert.strictEqual(d.tagsAnagrafica.b.colore, 'rosso');

  const d2 = db([{ tags: 'a, b' }], { a: { nome: 'a', colore: 'rosso' }, b: { nome: 'b', colore: 'verde' } });
  M.rinominaTag(d2, 'a', 'b');
  assert.strictEqual(d2.tagsAnagrafica.b.colore, 'verde');
});

test('Test 11: un tag registrato ma non usato resta rinominabile', () => {
  const d = db([{ tags: 'altro' }], { inutilizzato: { nome: 'inutilizzato', colore: 'viola' } });
  const esito = M.rinominaTag(d, 'inutilizzato', 'usato');
  assert.strictEqual(esito.schede, 0);
  assert.strictEqual(esito.cambiato, true);
  assert.strictEqual(d.tagsAnagrafica.usato.colore, 'viola');
});

test('Test 12: la fusione conta una sola volta le schede che portavano più sorgenti', () => {
  const d = db([
    { tags: 'not., notaio' },
    { tags: 'notaio' },
    { tags: 'ESCA' }
  ]);
  const esito = M.fondiTag(d, ['not.', 'notaio'], 'notai');
  assert.strictEqual(esito.schede, 2);
  assert.strictEqual(d.manoscritti[0].tags, 'notai');
  assert.strictEqual(d.manoscritti[1].tags, 'notai');
  assert.strictEqual(d.manoscritti[2].tags, 'ESCA');
});

test('Test 13: l\'eliminazione toglie il tag dalle schede e la voce dall\'anagrafica', () => {
  const d = db([{ tags: 'vecchio, buono' }, { tags: 'ESCA' }], { vecchio: { nome: 'vecchio' } });
  const esito = M.eliminaTag(d, 'Vecchio', { autore: 'Caio', quando: 7000 });
  assert.strictEqual(esito.schede, 1);
  assert.strictEqual(d.manoscritti[0].tags, 'buono');
  assert.strictEqual(d.manoscritti[0].modificatoDa, 'Caio');
  assert.strictEqual(d.manoscritti[1].tags, 'ESCA');
  assert.strictEqual(d.manoscritti[1].lastModified, 1000);
  assert.strictEqual(d.tagsAnagrafica.vecchio, undefined);
});

test('Test 14: la v3 costruisce l\'anagrafica e NON tocca un solo record', () => {
  const grezzo = {
    schemaVersion: 2,
    cartelle: [],
    tipiDocumento: [],
    manoscritti: [{ id: 'a', cartella: '', tipoDocumento: 'imbreviature', tags: 'Pergamena,, pergamena ,  sec.  XIV', lastModified: 1000 }]
  };
  const prima = JSON.stringify(grezzo.manoscritti);
  const esito = M.migraDatabase(grezzo);

  assert.strictEqual(esito.db.schemaVersion, M.SCHEMA_VERSION);
  assert.deepStrictEqual(Object.keys(esito.db.tagsAnagrafica).sort(), ['pergamena', 'sec. xiv']);
  assert.strictEqual(esito.db.tagsAnagrafica.pergamena.nome, 'Pergamena');
  assert.strictEqual(JSON.stringify(esito.db.manoscritti), prima);
});

test('Test 15: la v3 è idempotente e non riscrive un\'anagrafica già presente', () => {
  const d = db([{ tags: 'a' }], { a: { nome: 'A', colore: 'blu' } });
  d.schemaVersion = 2;
  const esito = M.migraDatabase(d);
  assert.strictEqual(esito.db.tagsAnagrafica.a.nome, 'A');
  assert.strictEqual(esito.db.tagsAnagrafica.a.colore, 'blu');
  const seconda = M.migraDatabase(esito.db);
  assert.deepStrictEqual(seconda.applicate, []);
});

test('Test 16: nel merge vince chi ha cambiato per ultimo, e le voci si uniscono', () => {
  const locale = { a: { nome: 'a', colore: 'rosso', modificato: 100 }, solo_locale: { nome: 'solo locale' } };
  const remota = { a: { nome: 'a', colore: 'verde', modificato: 200 }, solo_remota: { nome: 'solo remota' } };
  const fusa = M.unisciAnagraficheTag(locale, remota);
  assert.strictEqual(fusa.a.colore, 'verde');
  assert.strictEqual(fusa.solo_locale.nome, 'solo locale');
  assert.strictEqual(fusa.solo_remota.nome, 'solo remota');

  const pari = M.unisciAnagraficheTag(
    { a: { nome: 'a', colore: 'rosso', modificato: 100 } },
    { a: { nome: 'a', colore: 'verde', modificato: 100 } }
  );
  assert.strictEqual(pari.a.colore, 'rosso');
  assert.deepStrictEqual(M.unisciAnagraficheTag({ x: { colore: 'blu' } }, null), {});
});

console.log(`\n${passati} test superati.`);
