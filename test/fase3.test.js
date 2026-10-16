const assert = require('assert');
const M = require('../out/shared/model');

let passati = 0;
function test(nome, fn) {
  fn();
  passati++;
  console.log('  ok  ' + nome);
}

console.log('fase3.test.js — vocabolari, relazioni, anagrafica, duplicati');

const BASE = {
  attori_dinamici: { label: 'Persone / Attori', type: 'dynamic_list', authority: 'persona' },
  dataTopica: { label: 'Data Topica', type: 'text', authority: 'luogo' },
  supporto: { label: 'Supporto', type: 'text' }
};

function db(schede, extra) {
  const base = {
    schemaVersion: M.SCHEMA_VERSION,
    cartelle: [],
    tipiDocumento: [{ id: 'imbreviature', nome: 'Imbreviature', campi: ['supporto', 'attori_dinamici', 'dataTopica'] }],
    manoscritti: (schede || []).map((s, i) => Object.assign({
      id: 'r' + i, cartella: '', tipoDocumento: 'imbreviature', lastModified: 1000, modificatoDa: 'Tizio'
    }, s))
  };
  return Object.assign(base, extra || {});
}

function campiDi(d) {
  return (tipoId) => M.campiDelTipo((d.tipiDocumento || []).find(t => t.id === tipoId), BASE, d);
}

test('3.3.1: la migrazione v4 installa i vocabolari e non tocca un solo record', () => {
  const grezzo = {
    schemaVersion: 3,
    cartelle: [], tipiDocumento: [],
    manoscritti: [{ id: 'a', cartella: '', tipoDocumento: 'imbreviature', supporto: 'pergamena', lastModified: 1000 }]
  };
  const prima = JSON.stringify(grezzo.manoscritti);
  const esito = M.migraDatabase(grezzo);

  assert.strictEqual(esito.db.schemaVersion, 4);
  assert.ok(esito.db.vocabolari.supporto, 'il vocabolario "supporto" deve esistere');
  assert.ok(esito.db.vocabolari.relazione, 'la 3.5 ha bisogno del vocabolario "relazione"');
  assert.strictEqual(JSON.stringify(esito.db.manoscritti), prima);
  const dopoMigrazione = M.definizioneCampo(esito.db.tipiDocumento[0], 'supporto', BASE, esito.db);
  assert.strictEqual(dopoMigrazione.tipo, 'text');
  assert.strictEqual(dopoMigrazione.vocabolario, undefined);
});

test('3.3.2: un vocabolario già presente non viene riscritto dalla migrazione', () => {
  const d = db([], { schemaVersion: 3, vocabolari: { supporto: { id: 'supporto', nome: 'Supporto', valori: ['solo carta'] } } });
  const esito = M.migraDatabase(d);
  assert.deepStrictEqual(esito.db.vocabolari.supporto.valori, ['solo carta']);
});

test('3.3.3: i valori si risolvono in lettura, mai copiandoli nel tipo', () => {
  const d = db([], { vocabolari: { supporto: { id: 'supporto', nome: 'Supporto', valori: ['pergamena', 'carta'] } } });
  d.tipiDocumento[0].campiDef = { supporto: { id: 'supporto', tipo: 'enum', vocabolario: 'supporto' } };

  const def = M.definizioneCampo(d.tipiDocumento[0], 'supporto', BASE, d);
  assert.strictEqual(def.tipo, 'enum');
  assert.deepStrictEqual(def.opzioni, ['pergamena', 'carta']);
  M.impostaCampi(d.tipiDocumento[0], M.campiDelTipo(d.tipiDocumento[0], BASE, d));
  assert.strictEqual(d.tipiDocumento[0].campiDef.supporto.vocabolario, 'supporto');
  assert.strictEqual(d.tipiDocumento[0].campiDef.supporto.opzioni, undefined);
});

test('3.3.4: un enum legato a un vocabolario NON degrada a testo quando manca il db', () => {
  const def = M.definizioneCampo(null, { id: 'supporto', tipo: 'enum', vocabolario: 'supporto' });
  assert.strictEqual(def.tipo, 'enum');
  assert.strictEqual(M.definizioneCampo(null, { id: 'x', tipo: 'enum' }).tipo, 'text');
});

test('3.3.5: aggiungere un valore al volo non duplica per maiuscole o accenti', () => {
  const d = db([], { vocabolari: { supporto: { id: 'supporto', nome: 'Supporto', valori: ['pergamena'] } } });
  assert.strictEqual(M.aggiungiValoreVocabolario(d, 'supporto', 'papiro'), true);
  assert.strictEqual(M.aggiungiValoreVocabolario(d, 'supporto', 'Pergamena'), false);
  assert.deepStrictEqual(d.vocabolari.supporto.valori, ['pergamena', 'papiro']);
});

test('3.3.6: rinominare un valore lo aggiorna in tutte le schede legate', () => {
  const d = db(
    [{ supporto: 'pergamana' }, { supporto: 'pergamana' }, { supporto: 'ESCA' }],
    { vocabolari: { supporto: { id: 'supporto', nome: 'Supporto', valori: ['pergamana', 'carta'] } } }
  );
  d.tipiDocumento[0].campiDef = { supporto: { id: 'supporto', tipo: 'enum', vocabolario: 'supporto' } };

  const esito = M.rinominaValoreVocabolario(d, 'supporto', 'pergamana', 'pergamena', { autore: 'Caio', quando: 5000 });
  assert.strictEqual(esito.schede, 2);
  assert.deepStrictEqual(d.vocabolari.supporto.valori, ['pergamena', 'carta']);
  assert.strictEqual(d.manoscritti[0].supporto, 'pergamena');
  assert.strictEqual(d.manoscritti[0].modificatoDa, 'Caio');
  assert.strictEqual(d.manoscritti[2].supporto, 'ESCA');
  assert.strictEqual(d.manoscritti[2].lastModified, 1000);
});

test('3.3.7: un campo NON legato al vocabolario non viene toccato dalla rinomina', () => {
  const d = db([{ supporto: 'pergamana' }], { vocabolari: { supporto: { id: 'supporto', nome: 'S', valori: ['pergamana'] } } });
  const esito = M.rinominaValoreVocabolario(d, 'supporto', 'pergamana', 'pergamena');
  assert.strictEqual(esito.schede, 0);
  assert.strictEqual(d.manoscritti[0].supporto, 'pergamana');
});

test('3.3.8: togliere un valore dall\'elenco non lo cancella dalle schede', () => {
  const d = db([{ supporto: 'papiro' }], { vocabolari: { supporto: { id: 'supporto', nome: 'S', valori: ['papiro', 'carta'] } } });
  d.tipiDocumento[0].campiDef = { supporto: { id: 'supporto', tipo: 'enum', vocabolario: 'supporto' } };

  assert.strictEqual(M.eliminaValoreVocabolario(d, 'supporto', 'papiro'), true);
  assert.deepStrictEqual(d.vocabolari.supporto.valori, ['carta']);
  assert.strictEqual(d.manoscritti[0].supporto, 'papiro');
});

test('3.3.9: eliminare un vocabolario libera i campi copiandogli dentro i valori', () => {
  const d = db([], { vocabolari: { supporto: { id: 'supporto', nome: 'S', valori: ['pergamena', 'carta'] } } });
  d.tipiDocumento[0].campiDef = { supporto: { id: 'supporto', tipo: 'enum', vocabolario: 'supporto' } };

  assert.strictEqual(M.eliminaVocabolario(d, 'supporto'), true);
  const def = d.tipiDocumento[0].campiDef.supporto;
  assert.strictEqual(def.vocabolario, undefined);
  assert.deepStrictEqual(def.opzioni, ['pergamena', 'carta']);
});

test('3.3.10: nel merge i valori si UNISCONO, non si sovrascrivono', () => {
  const locale = { supporto: { id: 'supporto', nome: 'Supporto', valori: ['pergamena', 'papiro'], modificato: 200 } };
  const remota = { supporto: { id: 'supporto', nome: 'Materiale', valori: ['pergamena', 'carta'], modificato: 100 } };
  const fusa = M.unisciVocabolari(locale, remota);
  assert.deepStrictEqual(fusa.supporto.valori, ['pergamena', 'papiro', 'carta']);
  assert.strictEqual(fusa.supporto.nome, 'Supporto');
  const solo = M.unisciVocabolari({}, { lingua: { id: 'lingua', nome: 'Lingua', valori: ['latino'] } });
  assert.deepStrictEqual(solo.lingua.valori, ['latino']);
});

test('3.6.1: i gruppi contengono solo i valori davvero ripetuti', () => {
  const d = db([
    { segnatura: 'ASP 12' }, { segnatura: 'asp  12' }, { segnatura: 'ASP 13' }, { segnatura: '' }
  ]);
  const gruppi = M.gruppiDuplicati(d.manoscritti, 'segnatura');
  assert.strictEqual(gruppi.length, 1);
  assert.deepStrictEqual(gruppi[0].ids, ['r0', 'r1']);
  assert.ok(!gruppi.some(g => g.valore === ''));
});

test('3.6.2: duplicatiCampo esclude la scheda corrente', () => {
  const d = db([{ segnatura: 'ASP 12' }, { segnatura: 'ASP 12' }]);
  assert.deepStrictEqual(M.duplicatiCampo(d.manoscritti, 'segnatura', 'ASP 12', 'r0'), ['r1']);
  assert.deepStrictEqual(M.duplicatiCampo(d.manoscritti, 'segnatura', '', 'r0'), []);
});

test('3.5.1: la chiave `relazioni` non compare quando non ce ne sono', () => {
  const m = { id: 'a' };
  assert.strictEqual(M.scriviRelazioni(m, []), false);
  assert.ok(!('relazioni' in m));

  M.scriviRelazioni(m, [{ id: 'b' }]);
  assert.deepStrictEqual(m.relazioni, [{ id: 'b' }]);
  M.scriviRelazioni(m, []);
  assert.ok(!('relazioni' in m));
});

test('3.5.2: il rimando si scrive su UNA scheda sola e il verso opposto si calcola', () => {
  const d = db([{ segnatura: 'A' }, { segnatura: 'B' }, { segnatura: 'ESCA' }]);
  assert.strictEqual(M.aggiungiRelazione(d, 'r0', 'r1', 'copia di'), true);

  assert.deepStrictEqual(M.relazioni(d.manoscritti[0]), [{ id: 'r1', tipo: 'copia di' }]);
  assert.ok(!('relazioni' in d.manoscritti[1]));
  assert.deepStrictEqual(M.relazioniEntranti(d.manoscritti, 'r1'), [{ id: 'r0', tipo: 'copia di' }]);
  assert.deepStrictEqual(M.relazioniEntranti(d.manoscritti, 'r2'), []);
});

test('3.5.3: doppioni e auto-collegamenti sono scartati', () => {
  const d = db([{ segnatura: 'A' }, { segnatura: 'B' }]);
  assert.strictEqual(M.aggiungiRelazione(d, 'r0', 'r0'), false);
  assert.strictEqual(M.aggiungiRelazione(d, 'r0', ''), false);
  assert.strictEqual(M.aggiungiRelazione(d, 'r0', 'r1'), true);
  assert.strictEqual(M.aggiungiRelazione(d, 'r0', 'r1', 'altro'), false);
  assert.strictEqual(M.relazioni(d.manoscritti[0]).length, 1);
});

test('3.5.4: un id che non esiste si conserva, non si ripulisce', () => {
  const d = db([{ segnatura: 'A', relazioni: [{ id: 'assente' }] }]);
  assert.deepStrictEqual(M.relazioni(d.manoscritti[0]), [{ id: 'assente' }]);
  assert.strictEqual(M.rimuoviRelazione(d, 'r0', 'assente'), true);
  assert.ok(!('relazioni' in d.manoscritti[0]));
});

test('3.5.5: persone e luoghi si ricavano dai campi marcati, con il conteggio', () => {
  const d = db([
    { attori_dinamici: [{ k: 'Venditore', v: 'Bartolo' }, { k: 'Teste', v: 'Pietro' }], dataTopica: 'Perugia' },
    { attori_dinamici: [{ k: 'Notaio', v: 'bartolo' }], dataTopica: 'Perùgia' },
    { supporto: 'Bartolo' }
  ]);
  const voci = M.vociAuthority(d.manoscritti, campiDi(d), d);
  const persone = voci.filter(v => v.tipo === 'persona').map(v => [v.nome, v.conteggio]);
  const luoghi = voci.filter(v => v.tipo === 'luogo').map(v => [v.nome, v.conteggio]);

  assert.deepStrictEqual(persone, [['Bartolo', 2], ['Pietro', 1]]);
  assert.deepStrictEqual(luoghi, [['Perugia', 2]]);
  assert.ok(!voci.some(v => v.nome === 'Venditore'));
});

test('3.5.6: una scheda che cita due volte la stessa persona conta una volta', () => {
  const d = db([{ attori_dinamici: [{ k: 'Venditore', v: 'Bartolo' }, { k: 'Teste', v: 'Bartolo' }] }]);
  const voce = M.vociAuthority(d.manoscritti, campiDi(d), d)[0];
  assert.strictEqual(voce.conteggio, 1);
  assert.deepStrictEqual(voce.ids, ['r0']);
});

test('3.5.7: rinominare in anagrafica riscrive il nome in tutte le schede', () => {
  const d = db([
    { attori_dinamici: [{ k: 'Venditore', v: 'Bartolus de Saxoferrato' }] },
    { attori_dinamici: [{ k: 'Teste', v: 'bartolus de saxoferrato' }] },
    { attori_dinamici: [{ k: 'Teste', v: 'ESCA' }] }
  ]);
  const esito = M.rinominaAuthority(d, 'persona', 'Bartolus de Saxoferrato', 'Bartolo da Sassoferrato', campiDi(d), { autore: 'Caio', quando: 5000 });

  assert.strictEqual(esito.schede, 2);
  assert.strictEqual(d.manoscritti[0].attori_dinamici[0].v, 'Bartolo da Sassoferrato');
  assert.strictEqual(d.manoscritti[1].attori_dinamici[0].v, 'Bartolo da Sassoferrato');
  assert.strictEqual(d.manoscritti[1].modificatoDa, 'Caio');
  assert.strictEqual(d.manoscritti[2].attori_dinamici[0].v, 'ESCA');
  assert.strictEqual(d.manoscritti[2].lastModified, 1000);
  assert.ok(d.authority[M.chiaveAuthority('persona', 'Bartolo da Sassoferrato')]);
});

test('3.5.8: la rinomina di un luogo tocca i campi di testo, non le liste', () => {
  const d = db([{ dataTopica: 'Perugia', attori_dinamici: [{ k: 'Teste', v: 'Perugia' }] }]);
  M.rinominaAuthority(d, 'luogo', 'Perugia', 'Perusia', campiDi(d));
  assert.strictEqual(d.manoscritti[0].dataTopica, 'Perusia');
  assert.strictEqual(d.manoscritti[0].attori_dinamici[0].v, 'Perugia');
});

test('3.5.9: l\'anagrafica registra la grafia scelta e le note, e le fonde nel sync', () => {
  const d = db([]);
  assert.strictEqual(M.salvaVoceAuthority(d, 'persona', 'Bartolo', { note: 'giurista' }), true);
  assert.strictEqual(M.voceAuthority(d, 'persona', 'bartolo').note, 'giurista');
  assert.strictEqual(M.salvaVoceAuthority(d, 'persona', 'Bartolo', { note: 'giurista' }), false);
  assert.strictEqual(M.salvaVoceAuthority(d, 'sconosciuto', 'x'), false);

  const fusa = M.unisciAuthority(
    { 'persona:a': { chiave: 'persona:a', nome: 'A locale', tipo: 'persona', modificato: 100 } },
    { 'persona:a': { chiave: 'persona:a', nome: 'A remota', tipo: 'persona', modificato: 200 },
      'luogo:b': { chiave: 'luogo:b', nome: 'B', tipo: 'luogo' } }
  );
  assert.strictEqual(fusa['persona:a'].nome, 'A remota');
  assert.strictEqual(fusa['luogo:b'].nome, 'B');
});

test('P10: Wikidata e VIAF sull\'anagrafica, validati, conservati e trasferiti dalla rinomina', () => {
  const d = db([{ attori_dinamici: [{ k: 'Teste', v: 'Bartolo' }] }]);
  assert.strictEqual(M.salvaVoceAuthority(d, 'persona', 'Bartolo', { wikidata: 'Q312599', viaf: '100185495', varianti: ['Bartolus', 'bartolus', ' ', 'Bartolo da Sassoferrato'] }), true);
  let v = M.voceAuthority(d, 'persona', 'Bartolo');
  assert.deepStrictEqual([v.wikidata, v.viaf, v.varianti], ['Q312599', '100185495', ['Bartolus', 'Bartolo da Sassoferrato']]);
  assert.strictEqual(M.salvaVoceAuthority(d, 'persona', 'Bartolo', { note: 'giurista' }), true);
  assert.strictEqual(M.voceAuthority(d, 'persona', 'Bartolo').wikidata, 'Q312599');
  assert.strictEqual(M.salvaVoceAuthority(d, 'persona', 'Bartolo', { wikidata: 'Q312599' }), false);
  M.salvaVoceAuthority(d, 'persona', 'Bartolo', { wikidata: 'javascript:alert(1)', viaf: '', varianti: [] });
  v = M.voceAuthority(d, 'persona', 'Bartolo');
  assert.ok(!('wikidata' in v) && !('viaf' in v) && !('varianti' in v));
  assert.strictEqual(v.note, 'giurista');

  M.salvaVoceAuthority(d, 'persona', 'Bartolo', { wikidata: 'Q312599' });
  M.rinominaAuthority(d, 'persona', 'Bartolo', 'Bartolus de Saxoferrato', campiDi(d));
  assert.strictEqual(M.voceAuthority(d, 'persona', 'Bartolus de Saxoferrato').wikidata, 'Q312599');
});

test('3.5.10: `relazioni` è una chiave di servizio, non una colonna dell\'export', () => {
  assert.ok(M.CHIAVI_SERVIZIO.indexOf('relazioni') !== -1);
});


test('3.5.11: il grafo esclude le schede isolate, salvo richiesta esplicita', () => {
  const d = db([{ segnatura: 'A' }, { segnatura: 'B' }, { segnatura: 'ESCA' }]);
  M.aggiungiRelazione(d, 'r0', 'r1', 'copia di');

  const g = M.grafoRelazioni(d.manoscritti);
  assert.deepStrictEqual(g.nodi.map(n => n.etichetta).sort(), ['A', 'B']);
  assert.deepStrictEqual(g.archi, [{ da: 'r0', a: 'r1', tipo: 'copia di' }]);

  const tutte = M.grafoRelazioni(d.manoscritti, { isolate: true });
  assert.strictEqual(tutte.nodi.length, 3);
  assert.strictEqual(tutte.archi.length, 1);
});

test('3.5.12: il grado conta i due versi e l\'ordine è stabile', () => {
  const d = db([{ segnatura: 'PERNO' }, { segnatura: 'A' }, { segnatura: 'B' }]);
  M.aggiungiRelazione(d, 'r1', 'r0');
  M.aggiungiRelazione(d, 'r0', 'r2');

  const g = M.grafoRelazioni(d.manoscritti);
  assert.strictEqual(g.nodi[0].etichetta, 'PERNO');
  assert.strictEqual(g.nodi[0].grado, 2);
  assert.deepStrictEqual(M.grafoRelazioni(d.manoscritti).nodi.map(n => n.id), g.nodi.map(n => n.id));
});

test('3.5.13: un arco verso una scheda inesistente non entra nel grafo', () => {
  const d = db([{ segnatura: 'A', relazioni: [{ id: 'fantasma' }] }]);
  const g = M.grafoRelazioni(d.manoscritti);
  assert.deepStrictEqual(g.archi, []);
  assert.deepStrictEqual(g.nodi, []);
  assert.strictEqual(M.relazioni(d.manoscritti[0]).length, 1);
});

test('3.5.14: due schede che si rimandano a vicenda danno DUE archi', () => {
  const d = db([{ segnatura: 'A' }, { segnatura: 'B' }]);
  M.aggiungiRelazione(d, 'r0', 'r1', 'copia di');
  M.aggiungiRelazione(d, 'r1', 'r0', 'originale di');
  assert.strictEqual(M.grafoRelazioni(d.manoscritti).archi.length, 2);
});

test('3.5.15: le componenti sono i grappoli, dal più grande al più piccolo', () => {
  const d = db([{ segnatura: 'A' }, { segnatura: 'B' }, { segnatura: 'C' }, { segnatura: 'X' }, { segnatura: 'Y' }]);
  M.aggiungiRelazione(d, 'r0', 'r1');
  M.aggiungiRelazione(d, 'r1', 'r2');
  M.aggiungiRelazione(d, 'r3', 'r4');

  const comp = M.componentiGrafo(M.grafoRelazioni(d.manoscritti));
  assert.deepStrictEqual(comp.map(c => c.length), [3, 2]);
  assert.deepStrictEqual(comp[0].sort(), ['r0', 'r1', 'r2']);
});

console.log(`\n${passati} test superati.`);
