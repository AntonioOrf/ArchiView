// Ricerca tra archivi (Fase 1 di PIANO-RICERCA-ARCHIVI.md): indice in memoria, worker,
// identità dell'archivio. Gira su out/ (pretest:unit compila).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testo = require('../out/main/crossArchive/testo');
const voce = require('../out/main/crossArchive/voce');
const { IndiceMemoria } = require('../out/main/crossArchive/indiceMemoria');
const { IndiceWorker } = require('../out/main/crossArchive/client');
const vaultConfig = require('../out/main/vaultConfig');

const UTILS = path.join(__dirname, '..', 'src', 'renderer', 'js', 'logic', 'utils.ts');
const WORKER = path.join(__dirname, '..', 'out', 'main', 'crossArchive', 'worker.js');

// --- Coerenza col renderer ------------------------------------------------------

function bloccoBilanciato(sorgente, inizio) {
  let i = sorgente.indexOf('{', inizio);
  let livello = 0;
  for (; i < sorgente.length; i++) {
    if (sorgente[i] === '{') livello++;
    else if (sorgente[i] === '}' && --livello === 0) break;
  }
  assert.ok(livello === 0, 'Blocco non bilanciato in utils.ts: estrazione da aggiornare');
  return sorgente.substring(inizio, i + 1);
}

function funzioniRenderer() {
  const src = fs.readFileSync(UTILS, 'utf8');
  const estrai = (nome) => {
    const marker = 'window.' + nome + ' = function';
    const i = src.indexOf(marker);
    assert.notStrictEqual(i, -1, `${nome} non trovata in utils.ts`);
    return bloccoBilanciato(src, i) + ';';
  };
  const window = {};
  new Function('window', estrai('normalizzaTesto') + estrai('testoIndicizzabile'))(window);
  const i = src.indexOf('const CONFIG_CAMPI = {');
  assert.notStrictEqual(i, -1, 'CONFIG_CAMPI non trovato in utils.ts');
  const config = new Function(bloccoBilanciato(src, i).replace('const CONFIG_CAMPI =', 'return'))();
  return { ...window, CONFIG_CAMPI: config };
}

function testCoerenzaRenderer() {
  const r = funzioniRenderer();
  const campioni = ["Luca d'Abete", 'Luca d’Àbete', 'LUCA DʼABETE', 'Perùgia', 'São Miniato', 'ſanto', '  spazi  multipli ',
    'Ἀθῆναι', 'İstanbul', 'ﬁorini', '', null, undefined, 1340];
  for (const c of campioni) {
    assert.strictEqual(testo.normalizza(c), r.normalizzaTesto(c), `normalizza diverge dal renderer su ${JSON.stringify(c)}`);
  }
  const valori = ['testo', 12, [{ k: 'Imputato', v: 'Luca' }, 'x', 3, null], null, { a: 1 }];
  for (const v of valori) {
    assert.strictEqual(testo.testoIndicizzabile(v), r.testoIndicizzabile(v), 'testoIndicizzabile diverge dal renderer');
  }
  // La copia delle authority dei campi base deve coincidere con CONFIG_CAMPI.
  const attese = {};
  for (const [id, c] of Object.entries(r.CONFIG_CAMPI)) {
    if (c.authority) attese[id] = { type: c.type, authority: c.authority };
  }
  assert.deepStrictEqual(voce.CAMPI_BASE_AUTHORITY, attese, 'CAMPI_BASE_AUTHORITY (crossArchive/voce.ts) non allineato a CONFIG_CAMPI');
}

function testPosizioneOriginale() {
  const orig = 'Imputato: Luca d’Àbete da San Miniato';
  const norm = testo.normalizza(orig);
  const pos = norm.indexOf("d'abete");
  const da = testo.posizioneOriginale(orig, pos);
  const a = testo.posizioneOriginale(orig, pos + "d'abete".length);
  assert.strictEqual(orig.slice(da, a), 'd’Àbete');
  // Caratteri che si decompongono in più code unit prima di perdere il diacritico.
  const o2 = 'ﬁorini e Àbete';
  const n2 = testo.normalizza(o2);
  const p2 = n2.indexOf('abete');
  assert.strictEqual(o2.slice(testo.posizioneOriginale(o2, p2), testo.posizioneOriginale(o2, p2 + 5)), 'Àbete');
}

function testAnalizzaQuery() {
  assert.deepStrictEqual(testo.analizzaQuery('Luca "D’Abete  da" azzardo'), { token: ['luca', 'azzardo'], frasi: ["d'abete da"] });
  assert.deepStrictEqual(testo.analizzaQuery('   '), { token: [], frasi: [] });
}

// --- Archivi di prova -----------------------------------------------------------

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'av-cross-'));

const TIPI = [
  { id: 'giudiziario', nome: 'Giudiziario', campi: ['attori_dinamici', 'dataTopica', 'note', 'condanne'] },
  { id: 'notarile', nome: 'Notarile', campi: ['attori_dinamici', 'Notaio', 'note'],
    campiDef: { Notaio: { id: 'Notaio', tipo: 'text', authority: 'persona' } } }
];

function scriviArchivio(nome, manoscritti, extra) {
  const dir = path.join(TMP, nome);
  fs.mkdirSync(dir, { recursive: true });
  const db = { schemaVersion: 4, cartelle: [], tipiDocumento: TIPI, manoscritti, ...(extra || {}) };
  fs.writeFileSync(path.join(dir, 'database_manoscritti.json'), JSON.stringify(db));
  return dir;
}

function riscrivi(dir, muta) {
  const f = path.join(dir, 'database_manoscritti.json');
  const db = JSON.parse(fs.readFileSync(f, 'utf8'));
  muta(db);
  fs.writeFileSync(f, JSON.stringify(db));
  // mtime a grana grossa su alcuni filesystem: lo si sposta esplicitamente.
  const t = new Date(Date.now() + Math.floor(Math.random() * 100000));
  fs.utimesSync(f, t, t);
}

const dirA = scriviArchivio('Giudiziario San Miniato', [
  { id: 'a1', tipoDocumento: 'giudiziario', segnatura: 'Podestà 12, c. 3r', lastModified: 1,
    attori_dinamici: [{ k: 'Imputato', v: 'Luca d’Abete' }], dataTopica: 'San Miniato',
    note: "Accusato di gioco d'azzardo nella taverna", condanne: '<p>multa di <b>10 lire</b></p>' },
  { id: 'a2', tipoDocumento: 'giudiziario', segnatura: 'Podestà 12, c. 9v', lastModified: 1,
    note: 'Furto di galline', allegati: [{ nome: 'x.jpg', tipo: 'immagine', trascrizione: 'Item Lucas de Abete ludens ad taxillos' }] }
], { authority: { "persona:luca d'abete": { chiave: "persona:luca d'abete", nome: "Luca d'Abete", tipo: 'persona' } } });

const dirB = scriviArchivio('Notarile Bonaccorsi', [
  { id: 'b1', tipoDocumento: 'notarile', segnatura: 'Notarile 4021', lastModified: 5,
    Notaio: 'Ser Bonaccorso', note: "Testimone: Luca d'Abete, già accusato d'azzardo" }
]);

const dirFuturo = scriviArchivio('Futuro', [{ id: 'f1', tipoDocumento: 'x', segnatura: 'F1', note: 'luca' }]);
riscrivi(dirFuturo, db => { db.schemaVersion = 99; });

const dirRotto = path.join(TMP, 'Rotto');
fs.mkdirSync(dirRotto);
fs.writeFileSync(path.join(dirRotto, 'database_manoscritti.json'), '{ non json');

const dirVuoto = path.join(TMP, 'Vuoto');
fs.mkdirSync(dirVuoto);

const ARCHIVI = [
  { id: 'A', percorso: dirA }, { id: 'B', percorso: dirB }, { id: 'F', percorso: dirFuturo },
  { id: 'R', percorso: dirRotto }, { id: 'V', percorso: dirVuoto }, { id: 'X', percorso: path.join(TMP, 'Sparito') }
];

// --- Indice in memoria --------------------------------------------------------------

async function testIndice() {
  const contenutoA = fs.readFileSync(path.join(dirA, 'database_manoscritti.json'), 'utf8');
  const contenutoF = fs.readFileSync(path.join(dirFuturo, 'database_manoscritti.json'), 'utf8');

  const idx = new IndiceMemoria();
  const stati = await idx.sincronizza(ARCHIVI);
  const s = Object.fromEntries(stati.map(x => [x.id, x]));
  assert.deepStrictEqual([s.A.raggiungibile, s.A.schede, s.A.ricostruite], [true, 2, 2]);
  assert.strictEqual(s.F.futuro, true);
  assert.strictEqual(s.R.errore, 'formato');
  assert.deepStrictEqual([s.V.raggiungibile, s.V.schede, s.V.errore], [true, 0, undefined]);
  assert.strictEqual(s.X.errore, 'assente');
  assert.strictEqual(s.X.raggiungibile, false);

  // Sola lettura: nessun archivio viene riscritto, nemmeno quello da migrare.
  assert.strictEqual(fs.readFileSync(path.join(dirA, 'database_manoscritti.json'), 'utf8'), contenutoA);
  assert.strictEqual(fs.readFileSync(path.join(dirFuturo, 'database_manoscritti.json'), 'utf8'), contenutoF);

  // Ricerca libera: apostrofi e accenti non contano, i termini possono stare in campi diversi.
  let p = await idx.cerca({ testo: "luca D'ABETE" });
  const ids = p.risultati.map(r => r.archivioId + ':' + r.schedaId);
  assert.deepStrictEqual(ids.slice(0, 2), ['A:a1', 'B:b1'], 'la persona in anagrafica precede la menzione nelle note');
  const a1 = p.risultati[0];
  assert.strictEqual(a1.campo, 'attori_dinamici');
  assert.strictEqual(a1.tipoNome, 'Giudiziario');
  assert.strictEqual(a1.estratto.match, 'Luca');
  assert.deepStrictEqual(a1.anagrafica, [{ tipo: 'persona', nome: "Luca d'Abete" }, { tipo: 'luogo', nome: 'San Miniato' }]);

  // Trascrizione delle carte e HTML ripulito.
  p = await idx.cerca({ testo: 'taxillos' });
  assert.deepStrictEqual(p.risultati.map(r => [r.schedaId, r.campo]), [['a2', '#trascrizione']]);
  p = await idx.cerca({ testo: '10 lire' });
  assert.strictEqual(p.risultati[0].estratto.match, '10');
  assert.ok(!/[<>]/.test(JSON.stringify(p.risultati[0].estratto)), 'i tag HTML non arrivano nell\'estratto');

  // Frase fra virgolette: deve comparire intera.
  assert.strictEqual((await idx.cerca({ testo: '"azzardo nella"' })).risultati.length, 1);
  assert.strictEqual((await idx.cerca({ testo: '"nella azzardo"' })).risultati.length, 0);

  // Solo anagrafica: la menzione nelle note di B non conta, il notaio (campo dichiarato persona) sì.
  p = await idx.cerca({ testo: "luca d'abete", soloAnagrafica: true });
  assert.deepStrictEqual(p.risultati.map(r => r.schedaId), ['a1']);
  p = await idx.cerca({ testo: 'bonaccorso', soloAnagrafica: true });
  assert.deepStrictEqual(p.risultati.map(r => [r.schedaId, r.campo]), [['b1', 'Notaio']]);
  p = await idx.cerca({ testo: 'san miniato', soloAnagrafica: true });
  assert.deepStrictEqual(p.risultati.map(r => r.schedaId), ['a1']);

  // Chiave esatta d'anagrafica (suggerimento nel form): solo chi cita QUELLA persona.
  p = await idx.cerca({ chiaveAnagrafica: "persona:luca d'abete" });
  assert.deepStrictEqual(p.risultati.map(r => [r.schedaId, r.campo, r.estratto.match]), [['a1', 'attori_dinamici', 'Luca d’Abete']]);
  assert.strictEqual((await idx.cerca({ chiaveAnagrafica: 'persona:luca' })).totale, 0, 'nessuna corrispondenza parziale');
  assert.strictEqual((await idx.cerca({ chiaveAnagrafica: 'luogo:san miniato' })).risultati[0].schedaId, 'a1');

  // Filtro per archivio e query vuota.
  assert.deepStrictEqual((await idx.cerca({ testo: 'luca', archivi: ['B'] })).risultati.map(r => r.archivioId), ['B']);
  assert.strictEqual((await idx.cerca({ testo: '   ' })).risultati.length, 0);

  // Anteprima: la scheda intera e il suo tipo, riletti dal disco.
  const sch = await idx.scheda('B', 'b1');
  assert.strictEqual(sch.scheda.Notaio, 'Ser Bonaccorso');
  assert.strictEqual(sch.tipo.id, 'notarile');
  assert.strictEqual(await idx.scheda('B', 'nessuna'), null);
  assert.strictEqual(await idx.scheda('Z', 'b1'), null);

  // Incrementale: archivio invariato → nessuna voce ricalcolata.
  let st = await idx.sincronizza(ARCHIVI);
  assert.strictEqual(st.find(x => x.id === 'A').ricostruite, 0);

  // Una scheda modificata → una sola voce ricalcolata, e il nuovo testo è trovabile.
  riscrivi(dirA, db => { db.manoscritti[1].note = 'Furto di capponi'; db.manoscritti[1].lastModified = 2; });
  st = await idx.sincronizza(ARCHIVI);
  assert.strictEqual(st.find(x => x.id === 'A').ricostruite, 1);
  assert.strictEqual((await idx.cerca({ testo: 'capponi' })).risultati.length, 1);
  assert.strictEqual((await idx.cerca({ testo: 'galline' })).risultati.length, 0);

  // Cambia l'anagrafica (grafia scelta) → tutte le voci dell'archivio si ricalcolano.
  riscrivi(dirA, db => { db.authority["persona:luca d'abete"].nome = 'Luca di Abete'; });
  st = await idx.sincronizza(ARCHIVI);
  assert.strictEqual(st.find(x => x.id === 'A').ricostruite, 2);
  p = await idx.cerca({ testo: "luca d'abete", soloAnagrafica: true });
  assert.strictEqual(p.risultati[0].anagrafica[0].nome, 'Luca di Abete');

  // Un archivio sparito dopo essere stato indicizzato esce dai risultati.
  const dirTemp = scriviArchivio('Temporaneo', [{ id: 't1', segnatura: 'T', note: 'luca' }]);
  await idx.sincronizza([...ARCHIVI, { id: 'T', percorso: dirTemp }]);
  assert.ok((await idx.cerca({ testo: 'luca' })).risultati.some(r => r.archivioId === 'T'));
  fs.rmSync(dirTemp, { recursive: true, force: true });
  st = await idx.sincronizza([...ARCHIVI, { id: 'T', percorso: dirTemp }]);
  assert.strictEqual(st.find(x => x.id === 'T').errore, 'assente');
  assert.ok(!(await idx.cerca({ testo: 'luca' })).risultati.some(r => r.archivioId === 'T'));
}

async function testPaginazione() {
  const molte = [];
  for (let i = 0; i < 120; i++) molte.push({ id: 'p' + i, segnatura: 'Busta ' + i, note: 'azzardo ' + i, lastModified: 1 });
  const dir = scriviArchivio('Paginato', molte);
  const idx = new IndiceMemoria();
  await idx.sincronizza([{ id: 'P', percorso: dir }]);

  const visti = new Set();
  let cursore = null;
  let pagine = 0;
  do {
    const p = await idx.cerca({ testo: 'azzardo', limite: 50, cursore });
    assert.strictEqual(p.totale, 120);
    for (const r of p.risultati) {
      assert.ok(!visti.has(r.schedaId), 'risultato ripetuto fra pagine');
      visti.add(r.schedaId);
    }
    cursore = p.cursore;
    pagine++;
  } while (cursore);
  assert.strictEqual(pagine, 3);
  assert.strictEqual(visti.size, 120);
  // Ordinamento naturale a parità di punteggio.
  assert.deepStrictEqual((await idx.cerca({ testo: 'azzardo', limite: 3 })).risultati.map(r => r.segnatura), ['Busta 0', 'Busta 1', 'Busta 2']);

  // Cursore di un indice cambiato nel frattempo → scaduto, non pagine incoerenti.
  const primo = await idx.cerca({ testo: 'azzardo', limite: 50 });
  riscrivi(dir, db => { db.manoscritti[0].note = 'altro'; db.manoscritti[0].lastModified = 9; });
  await idx.sincronizza([{ id: 'P', percorso: dir }]);
  const scaduto = await idx.cerca({ testo: 'azzardo', limite: 50, cursore: primo.cursore });
  assert.strictEqual(scaduto.cursoreScaduto, true);
  // Cursore di un'altra query o manomesso → scaduto.
  assert.strictEqual((await idx.cerca({ testo: 'busta', cursore: primo.cursore })).cursoreScaduto, true);
  assert.strictEqual((await idx.cerca({ testo: 'busta', cursore: 'spazzatura' })).cursoreScaduto, true);
}

async function testAnnullamentoELru() {
  const idx = new IndiceMemoria({ maxArchivi: 2 });
  await idx.sincronizza(ARCHIVI.slice(0, 2));
  const c = new AbortController();
  c.abort();
  await assert.rejects(idx.cerca({ testo: 'luca' }, c.signal), e => e.name === 'AbortError');

  // LRU: con tetto 2, sincronizzare altri due archivi scarica i precedenti non richiesti.
  const altri = [{ id: 'B2', percorso: dirB }, { id: 'F2', percorso: dirFuturo }];
  await idx.sincronizza(altri);
  const p = await idx.cerca({ testo: 'luca' });
  assert.ok(p.risultati.every(r => r.archivioId === 'B2' || r.archivioId === 'F2'));
}

async function testLimiteTesto() {
  const lunga = 'parola '.repeat(5000) + 'introvabile';
  const dir = scriviArchivio('Lungo', [{ id: 'l1', segnatura: 'L', trascrizione: lunga, lastModified: 1 }]);
  const idx = new IndiceMemoria({ limiteTesto: 1000 });
  await idx.sincronizza([{ id: 'L', percorso: dir }]);
  assert.strictEqual((await idx.cerca({ testo: 'introvabile' })).risultati.length, 0, 'oltre il limite il testo non è indicizzato');
  assert.strictEqual((await idx.cerca({ testo: 'parola' })).risultati.length, 1);
}

// --- Worker -------------------------------------------------------------------------

async function testWorker() {
  assert.ok(fs.existsSync(WORKER), 'worker.js non compilato');
  const w = new IndiceWorker({ script: WORKER, inattivitaMs: 0 });
  const stati = await w.sincronizza(ARCHIVI);
  assert.strictEqual(stati.find(s => s.id === 'A').schede, 2);
  const p = await w.cerca({ testo: "luca d'abete" });
  assert.strictEqual(w.inRipiego, false, 'il worker doveva partire');
  assert.ok(p.risultati.length >= 2);
  assert.strictEqual((await w.scheda('B', 'b1')).scheda.id, 'b1');

  // Annullamento dal main: la promessa viene rifiutata subito.
  const c = new AbortController();
  const promessa = w.cerca({ testo: 'luca' }, c.signal);
  c.abort();
  await assert.rejects(promessa, e => e.name === 'AbortError');
  // Il worker resta utilizzabile.
  assert.ok((await w.cerca({ testo: 'luca' })).risultati.length > 0);

  // Il worker muore: la richiesta successiva ne avvia uno nuovo e l'indice si ricostruisce.
  await w.worker.terminate();
  await new Promise(r => setTimeout(r, 50));
  await w.sincronizza(ARCHIVI);
  assert.ok((await w.cerca({ testo: 'luca' })).risultati.length > 0);
  assert.strictEqual(w.inRipiego, false);
  await w.chiudi();

  // Worker che non parte (script assente, come un modulo non trovato nell'asar): ripiego nel
  // processo, stessi risultati, nessun errore verso il chiamante.
  const log = [];
  const r = new IndiceWorker({ script: path.join(TMP, 'non-esiste.js'), inattivitaMs: 0, log: (m) => log.push(m) });
  await r.sincronizza(ARCHIVI);
  const pr = await r.cerca({ testo: "luca d'abete" });
  assert.strictEqual(r.inRipiego, true);
  assert.deepStrictEqual(pr.risultati.map(x => x.schedaId).slice(0, 2), p.risultati.map(x => x.schedaId).slice(0, 2));
  assert.ok(log.length === 1, 'il ripiego va segnalato una volta');
  await r.chiudi();
}

// --- Identità dell'archivio ------------------------------------------------------------

function testArchivioId() {
  const dir = scriviArchivio('ConId', []);
  const id = vaultConfig.assicuraArchivioId(dir, {});
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.strictEqual(vaultConfig.assicuraArchivioId(dir, {}), id, 'l\'id deve essere stabile');
  // La rigenerazione dai file legacy (ogni salvataggio di chiavi del vault) non lo perde.
  vaultConfig.syncUnifiedFromLegacy(dir, {});
  assert.strictEqual(vaultConfig.readVaultConfig(dir, {}).archivioId, id);
  assert.strictEqual(vaultConfig.assicuraArchivioId(path.join(TMP, 'inesistente'), {}), null);
}

async function runTests() {
  console.log('Running crossArchiveIndex tests...');
  try {
    testCoerenzaRenderer();
    testPosizioneOriginale();
    testAnalizzaQuery();
    await testIndice();
    await testPaginazione();
    await testAnnullamentoELru();
    await testLimiteTesto();
    await testWorker();
    testArchivioId();
    console.log('crossArchiveIndex tests passed.');
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
}

runTests().catch(e => { console.error(e); process.exit(1); });
