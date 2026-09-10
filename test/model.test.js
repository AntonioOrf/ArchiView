// Fase 3.0 — Schema, versione e catena di migrazioni. Il modulo è condiviso fra main e
// renderer e non dipende né da Electron né dal DOM: si testa il build in out/ con `node`,
// che è anche la prova che la guardia CommonJS in coda al file funziona.
const assert = require('assert');
const Model = require('../out/shared/model');

// --- Test 1: la versione è dichiarata e coerente ------------------------------
{
  assert.strictEqual(typeof Model.SCHEMA_VERSION, 'number');
  assert.ok(Model.SCHEMA_VERSION >= 1);
  // Ogni migrazione porta a una versione <= a quella dichiarata, e l'ultima ci arriva:
  // una catena che si ferma prima lascerebbe database perennemente "da migrare".
  const versioni = Model.MIGRAZIONI.map(m => m.versione);
  assert.deepStrictEqual(versioni, versioni.slice().sort((a, b) => a - b), 'catena ordinata');
  assert.strictEqual(versioni[versioni.length - 1], Model.SCHEMA_VERSION, 'la catena arriva alla versione corrente');
  assert.strictEqual(new Set(versioni).size, versioni.length, 'nessuna versione ripetuta');
  assert.strictEqual(Model.versioneDi({}), 0, 'un file senza schemaVersion è alla versione 0');
  assert.strictEqual(Model.versioneDi({ schemaVersion: 3 }), 3);
  assert.strictEqual(Model.versioneDi({ schemaVersion: 'x' }), 0, 'una versione non numerica vale 0');
}

// --- Test 2: il database "lista piatta" delle primissime versioni --------------
{
  const esito = Model.migraDatabase([{ id: 'a', segnatura: 'ASP 1' }, { id: 'b' }]);
  assert.ok(Array.isArray(esito.db.manoscritti) && esito.db.manoscritti.length === 2);
  assert.deepStrictEqual(esito.db.cartelle, [], 'compare la collezione cartelle');
  assert.strictEqual(esito.db.schemaVersion, Model.SCHEMA_VERSION);
  assert.strictEqual(esito.db.manoscritti[0].cartella, '', 'i record finiscono nella radice virtuale');
  assert.strictEqual(esito.db.manoscritti[0].tipoDocumento, Model.TIPO_PREDEFINITO);
  assert.ok(esito.applicate.length >= 2, 'la conversione è dichiarata al chiamante');
  assert.strictEqual(esito.futuro, false);
}

// --- Test 3: il tipo `manoscritto`, rimosso a favore dei modelli ---------------
{
  const db = {
    cartelle: ['Fondo'],
    manoscritti: [
      { id: '1', tipoDocumento: 'manoscritto', cartella: 'Fondo' },
      { id: '2', tipoDocumento: 'atti', cartella: 'Fondo' },
      { id: '3' }
    ]
  };
  const esito = Model.migraDatabase(db);
  assert.strictEqual(esito.db.manoscritti[0].tipoDocumento, Model.TIPO_PREDEFINITO, "'manoscritto' non esiste più");
  assert.strictEqual(esito.db.manoscritti[1].tipoDocumento, 'atti', 'un tipo valido non viene toccato');
  assert.strictEqual(esito.db.manoscritti[2].cartella, '', 'la cartella mancante diventa la radice');
  assert.ok(Array.isArray(esito.db.tipiDocumento), 'la collezione dei tipi esiste sempre');
}

// --- Test 4: idempotenza ------------------------------------------------------
{
  const db = { cartelle: [], manoscritti: [{ id: '1', tipoDocumento: 'manoscritto' }] };
  const primo = Model.migraDatabase(db);
  const dopoPrimo = JSON.stringify(primo.db);
  const secondo = Model.migraDatabase(primo.db);
  assert.strictEqual(JSON.stringify(secondo.db), dopoPrimo, 'la seconda passata non cambia nulla');
  // Ed è ciò che permette a `initData` di riscrivere il file SOLO quando serve: senza,
  // ogni apertura dell'app segnerebbe il database come modificato e lo rimanderebbe al cloud.
  assert.deepStrictEqual(secondo.applicate, [], 'niente da applicare, quindi niente da scrivere');
}

// --- Test 5: le migrazioni non toccano paternità e data -----------------------
{
  const db = {
    cartelle: [], manoscritti: [
      { id: '1', tipoDocumento: 'manoscritto', lastModified: 111, modificatoDa: 'Rossi', creatoDa: 'Bianchi' }
    ]
  };
  const m = Model.migraDatabase(db).db.manoscritti[0];
  // Una migrazione che firmasse i record col nome di chi apre l'app riscriverebbe la
  // paternità di un archivio condiviso e lo rimanderebbe intero al cloud come "modificato".
  assert.strictEqual(m.lastModified, 111);
  assert.strictEqual(m.modificatoDa, 'Rossi');
  assert.strictEqual(m.creatoDa, 'Bianchi');
}

// --- Test 6: un file dal futuro non viene toccato -----------------------------
{
  const db = {
    schemaVersion: Model.SCHEMA_VERSION + 5,
    cartelle: [], manoscritti: [{ id: '1', tipoDocumento: 'manoscritto', campoIgnoto: 'x' }]
  };
  const esito = Model.migraDatabase(db);
  assert.strictEqual(esito.futuro, true, 'il chiamante viene avvertito');
  assert.strictEqual(esito.db.schemaVersion, Model.SCHEMA_VERSION + 5, 'nessun downgrade silenzioso');
  // Nemmeno le normalizzazioni: quel file è stato scritto da un'app che ne sa più di noi,
  // e `manoscritto` potrebbe esserci tornato a essere un tipo valido.
  assert.strictEqual(esito.db.manoscritti[0].tipoDocumento, 'manoscritto', 'i record restano intatti');
  assert.strictEqual(esito.db.manoscritti[0].campoIgnoto, 'x', 'i campi sconosciuti sopravvivono');
  assert.deepStrictEqual(esito.applicate, []);
}

// --- Test 7: lo snapshot di base viene migrato insieme ai record ---------------
{
  const db = {
    cartelle: [], manoscritti: [{ id: '1', tipoDocumento: 'manoscritto', cartella: 'F' }],
    baseObjects: { '1': { id: '1', tipoDocumento: 'manoscritto', cartella: 'F' } }
  };
  const esito = Model.migraDatabase(db);
  // Se la base restasse non migrata, il merge a tre vie confronterebbe una scheda migrata
  // con la sua base vecchia e dichiarerebbe modificato un archivio che nessuno ha toccato.
  assert.strictEqual(esito.db.baseObjects['1'].tipoDocumento, Model.TIPO_PREDEFINITO);
  assert.strictEqual(
    JSON.stringify(esito.db.manoscritti[0]),
    JSON.stringify(esito.db.baseObjects['1']),
    'record e base restano identici dopo la migrazione'
  );
}

// --- Test 8: validazione condivisa --------------------------------------------
{
  assert.strictEqual(Model.motivoNonValido({ cartelle: [], manoscritti: [] }), null);
  assert.ok(Model.motivoNonValido(null), 'null non è un database');
  assert.ok(Model.motivoNonValido([]), 'un array non è un database');
  assert.ok(Model.motivoNonValido({ cartelle: [] }), 'senza manoscritti non è valido');
  assert.ok(Model.motivoNonValido({ manoscritti: [] }), 'senza cartelle non è valido');
  assert.ok(Model.motivoNonValido({ cartelle: [], manoscritti: [], tipiDocumento: {} }), 'tipiDocumento deve essere un elenco');
  // Il motivo è una stringa leggibile, non un booleano: due chiamanti (main e renderer)
  // devono poter dire all'utente la STESSA cosa sullo stesso file.
  assert.strictEqual(typeof Model.motivoNonValido({}), 'string');
  assert.strictEqual(Model.databaseValido({ cartelle: [], manoscritti: [] }), true);
}

// --- Test 9: creazione e normalizzazione della scheda -------------------------
{
  const m = Model.creaScheda({ segnatura: 'ASP 1', dataCronica: '1340', creatoDa: 'Rossi' });
  assert.ok(m.id && typeof m.id === 'string', 'id generato');
  assert.strictEqual(m.cartella, '');
  assert.strictEqual(m.tipoDocumento, Model.TIPO_PREDEFINITO);
  assert.strictEqual(m.tags, '');
  assert.deepStrictEqual(m.allegati, []);
  assert.strictEqual(m.modificatoDa, 'Rossi', "senza modificatoDa vale chi l'ha creata");
  assert.strictEqual(m.dataCronica, '1340', 'i campi del tipo restano flat sulla radice');
  assert.ok(typeof m.lastModified === 'number');
  assert.notStrictEqual(Model.nuovoId(), Model.nuovoId(), 'due id non coincidono');

  // ⚠️ La normalizzazione NON aggiunge chiavi: `getRecordHash` calcola l'impronta su tutte
  // le chiavi tranne tre, e una chiave in più farebbe apparire modificato a ogni collega un
  // record che nessuno ha toccato.
  const esistente = { id: '9', cartella: 'F', tipoDocumento: 'atti' };
  const chiaviPrima = Object.keys(esistente).sort();
  Model.normalizzaScheda(esistente);
  assert.deepStrictEqual(Object.keys(esistente).sort(), chiaviPrima, 'nessuna chiave aggiunta');
}

// --- Test 10: le chiavi di servizio sono una sola lista -----------------------
{
  for (const k of ['id', 'segnatura', 'tags', 'cartella', 'tipoDocumento', 'allegati', 'lastModified', 'trascrizione']) {
    assert.ok(Model.CHIAVI_SERVIZIO.includes(k), 'manca la chiave di servizio ' + k);
  }
  // È l'elenco che CSV (2.1) e stampa (2.2) usano per NON trattare una chiave di servizio
  // come un campo della scheda: erano tre copie, ora è questa.
  const csv = require('../out/main/ipc/csvExport');
  const colonne = csv.costruisciColonne([{ id: '1', tipoDocumento: 'x', lastModified: 1, dataCronica: '1340' }], []);
  const chiavi = colonne.map(c => c.chiave);
  assert.ok(chiavi.includes('dataCronica'), 'il campo vero diventa colonna');
  assert.strictEqual(chiavi.filter(c => c === 'lastModified').length, 1, 'la chiave di servizio resta solo fra le colonne base');
}

// ============================ Fase 3.1 — campi tipizzati ======================

// --- Test 11: la definizione di un campo, da tre fonti diverse -----------------
{
  const baseConf = { note: { type: 'textarea' }, attori_dinamici: { type: 'dynamic_list' } };
  const tipo = {
    id: 't', nome: 'T',
    campi: ['note', 'attori_dinamici', 'inventato', 'prezzo_fiorini'],
    campiDef: { prezzo_fiorini: { id: 'prezzo_fiorini', tipo: 'number', obbligatorio: true } }
  };
  const defs = Model.campiDelTipo(tipo, baseConf);
  assert.deepStrictEqual(defs.map(d => d.id), ['note', 'attori_dinamici', 'inventato', 'prezzo_fiorini'], 'ordine dichiarato');
  assert.strictEqual(defs[0].tipo, 'textarea', 'il tipo di un campo base viene dal catalogo del renderer');
  assert.strictEqual(defs[1].tipo, 'dynamic_list');
  // Il default: un campo senza definizione e senza catalogo e' testo. E' cio' che rende
  // leggibile un archivio scritto prima della 3.1.
  assert.strictEqual(defs[2].tipo, 'text', 'campo senza definizione = testo');
  assert.strictEqual(defs[3].tipo, 'number', 'campiDef vince');
  assert.strictEqual(defs[3].obbligatorio, true);
  // Senza il catalogo (il main non ce l'ha: non conosce la i18n) si resta su testo, e
  // nessuna chiamata esplode.
  assert.strictEqual(Model.campiDelTipo(tipo)[0].tipo, 'text');
}

// Un elenco a scelta senza valori sarebbe una tendina vuota: un campo non compilabile.
{
  const tipo = { campi: ['supporto'], campiDef: { supporto: { id: 'supporto', tipo: 'enum' } } };
  assert.strictEqual(Model.campiDelTipo(tipo)[0].tipo, 'text', 'enum senza opzioni ricade su testo');
  const conValori = { campi: ['supporto'], campiDef: { supporto: { id: 'supporto', tipo: 'enum', opzioni: ['carta', 'pergamena'] } } };
  assert.deepStrictEqual(Model.campiDelTipo(conValori)[0].opzioni, ['carta', 'pergamena']);
}

// --- Test 12: la scrittura sul tipo tiene `campi` fatto di stringhe ------------
{
  const tipo = { id: 't', nome: 'T' };
  Model.impostaCampi(tipo, [
    { id: 'titolo', tipo: 'text' },
    { id: 'carte', tipo: 'number' },
    { id: 'titolo', tipo: 'textarea' }        // duplicato: la seconda dichiarazione cade
  ]);
  // ⚠️ Un oggetto dentro `campi` manderebbe in errore ogni versione precedente alla 3.1,
  // che fa `campoId.replace(...)`: su un archivio condiviso, il form di un collega rotto.
  assert.deepStrictEqual(tipo.campi, ['titolo', 'carte'], 'solo stringhe, senza duplicati');
  assert.deepStrictEqual(Object.keys(tipo.campiDef), ['carte'], 'in campiDef solo cio che non e testo semplice');
  // Un tipo di soli campi testuali non porta affatto la mappa: ripetere `{tipo:'text'}` per
  // ogni campo sarebbe rumore in ogni diff e in ogni sincronizzazione.
  const soloTesto = { id: 'x', nome: 'X', campiDef: { vecchio: {} } };
  Model.impostaCampi(soloTesto, [{ id: 'a', tipo: 'text' }]);
  assert.strictEqual(soloTesto.campiDef, undefined, 'mappa vuota = mappa assente');
}

// --- Test 13: normalizzazione dei valori --------------------------------------
{
  const num = { id: 'n', tipo: 'number' };
  assert.strictEqual(Model.normalizzaValore(num, '12'), 12);
  assert.strictEqual(Model.normalizzaValore(num, '1,5'), 1.5, 'la virgola decimale e quella che si batte');
  // ⚠️ Vuoto NON diventa 0: zero e un dato, "non compilato" no, e un archivio in cui ogni
  // campo mai riempito vale zero mente sui totali.
  assert.strictEqual(Model.normalizzaValore(num, ''), '');
  assert.strictEqual(Model.normalizzaValore(num, 'dodici'), 'dodici', 'cio che non e un numero resta come battuto');

  const bool = { id: 'b', tipo: 'boolean' };
  assert.strictEqual(Model.normalizzaValore(bool, true), true);
  assert.strictEqual(Model.normalizzaValore(bool, 'on'), true, 'il valore di una checkbox HTML');
  assert.strictEqual(Model.normalizzaValore(bool, ''), false);

  assert.strictEqual(Model.normalizzaValore({ tipo: 'text' }, 12), '12');
  assert.strictEqual(Model.normalizzaValore({ tipo: 'text' }, null), '');
  const lista = [{ k: 'a', v: 'b' }];
  assert.strictEqual(Model.normalizzaValore({ tipo: 'dynamic_list' }, lista), lista, 'le liste passano intatte');
}

// --- Test 14: validazione, e cosa NON blocca ----------------------------------
{
  assert.strictEqual(Model.validaValore({ tipo: 'text' }, ''), null, 'un campo facoltativo vuoto va bene');
  assert.strictEqual(Model.validaValore({ tipo: 'text', obbligatorio: true }, ''), 'obbligatorio');
  assert.strictEqual(Model.validaValore({ tipo: 'number' }, 'dodici'), 'numero');
  assert.strictEqual(Model.validaValore({ tipo: 'number' }, 0), null, 'zero e un valore, non un vuoto');
  assert.strictEqual(Model.validaValore({ tipo: 'url' }, 'archivio.it'), 'url');
  assert.strictEqual(Model.validaValore({ tipo: 'url' }, 'https://archivio.it'), null);
  // `javascript:` in un campo compilato da un collega e arrivato via sync sarebbe
  // esecuzione, non un collegamento.
  assert.strictEqual(Model.validaValore({ tipo: 'url' }, 'javascript:alert(1)'), 'url');
  assert.strictEqual(Model.validaValore({ tipo: 'enum', opzioni: ['a'] }, 'b'), 'opzione');
  // Un sì/no obbligatorio non puo essere "vuoto": `false` e una risposta.
  assert.strictEqual(Model.validaValore({ tipo: 'boolean', obbligatorio: true }, false), null);
  // ⚠️ `unico` non e mai un errore di validazione: un fondo reale contiene segnature
  // ripetute, e rifiutarle costringerebbe a falsificare il dato per poter salvare.
  assert.strictEqual(Model.validaValore({ tipo: 'text', unico: true }, 'ASP 1'), null);
}

// --- Test 15: duplicati di un campo unico -------------------------------------
{
  const records = [
    { id: '1', inv: 'ASP 1' }, { id: '2', inv: 'asp 1  ' }, { id: '3', inv: 'ASP 2' }, { id: '4' }
  ];
  // Confronto senza maiuscole e senza spazi ai bordi: "ASP 1" e "asp 1 " sono lo stesso
  // numero di inventario battuto due volte, ed e proprio quello che si vuole scoprire.
  assert.deepStrictEqual(Model.duplicatiCampo(records, 'inv', 'ASP 1', '1'), ['2']);
  assert.deepStrictEqual(Model.duplicatiCampo(records, 'inv', 'ASP 3', null), []);
  assert.deepStrictEqual(Model.duplicatiCampo(records, 'inv', '', null), [], 'il vuoto non e mai duplicato');
}

// --- Test 16: migrazione v2 ----------------------------------------------------
{
  // La forma dell'unione prevista dalla roadmap (`campi: (string|oggetto)[]`) viene
  // accettata in lettura e riportata nella forma su disco.
  const db = {
    schemaVersion: 1, cartelle: [], manoscritti: [],
    tipiDocumento: [
      { id: 'a', nome: 'A', campi: ['titolo', { id: 'carte', tipo: 'number' }] },
      { id: 'b', nome: 'B', campi: ['note'], campiDef: { sparito: { id: 'sparito', tipo: 'enum', opzioni: ['x'] } } }
    ]
  };
  const esito = Model.migraDatabase(db);
  const a = esito.db.tipiDocumento[0];
  assert.deepStrictEqual(a.campi, ['titolo', 'carte'], 'gli oggetti escono da campi');
  assert.strictEqual(a.campiDef.carte.tipo, 'number', 'e finiscono in campiDef');
  // Una definizione orfana tornerebbe in vita — con i vincoli di allora — se qualcuno
  // rimettesse un campo con lo stesso nome.
  assert.strictEqual(esito.db.tipiDocumento[1].campiDef, undefined, 'definizione orfana rimossa');
  assert.strictEqual(esito.db.schemaVersion, Model.SCHEMA_VERSION);
  // Idempotente come tutte le altre.
  const dopo = JSON.stringify(esito.db);
  assert.strictEqual(JSON.stringify(Model.migraDatabase(esito.db).db), dopo);
}

// --- Test 17: i modelli predefiniti, fonte unica ------------------------------
{
  const ids = Model.MODELLI_PREDEFINITI.map(m => m.id);
  assert.deepStrictEqual(ids, ['imbreviature', 'atti', 'fiscali'], 'i tre modelli, in ordine');
  assert.ok(Model.MODELLI_PREDEFINITI.every(m => m.nome && Array.isArray(m.campi) && m.campi.length));
  assert.strictEqual(Model.modelloPredefinito('atti').campi[0], 'dataCronica');
  assert.strictEqual(Model.modelloPredefinito('inesistente'), null);
  // Il tipo di ripiego delle schede senza tipo deve essere uno dei tre, o ogni scheda
  // migrata punterebbe a un modello che non esiste.
  assert.ok(ids.includes(Model.TIPO_PREDEFINITO), 'il tipo di ripiego e uno dei predefiniti');
}

// --- Test 18: applicazione dei modelli a un archivio --------------------------
{
  // Archivio vuoto: i tre modelli compaiono, in testa e nell'ordine dichiarato.
  const vuoto = { cartelle: [], manoscritti: [], tipiDocumento: [] };
  assert.strictEqual(Model.applicaModelliPredefiniti(vuoto), true);
  assert.deepStrictEqual(vuoto.tipiDocumento.map(t => t.id), ['imbreviature', 'atti', 'fiscali']);
  // Idempotente: alla seconda passata non c'e nulla da cambiare, quindi niente da salvare.
  assert.strictEqual(Model.applicaModelliPredefiniti(vuoto), false);

  // `manoscritto` non e un tipo: era il valore di ripiego prima dei modelli.
  const conVecchio = { tipiDocumento: [{ id: 'manoscritto', nome: 'Manoscritto', campi: [] }] };
  Model.applicaModelliPredefiniti(conVecchio);
  assert.ok(!conVecchio.tipiDocumento.some(t => t.id === 'manoscritto'), "'manoscritto' rimosso");

  // I campi d'origine di un predefinito ci sono SEMPRE: uno tolto per errore, o non ancora
  // installato perche l'archivio viene da una versione precedente, torna al suo posto.
  const disallineato = { tipiDocumento: [{ id: 'atti', nome: 'Atti Giudiziari', campi: ['solo_uno'] }] };
  Model.applicaModelliPredefiniti(disallineato);
  const atti = disallineato.tipiDocumento.find(t => t.id === 'atti');
  const attiPref = Model.modelloPredefinito('atti').campi;
  assert.deepStrictEqual(atti.campi, attiPref.concat(['solo_uno']), 'campi del modello + quello aggiunto');

  // ⚠️ …ma i campi AGGIUNTI dall'utente sopravvivono, in coda e con la loro definizione.
  // Qui c'era `esistente.campi = pref.campi.slice()`, che li cancellava al primo avvio: il
  // campo spariva, i valori restavano nei record come chiavi orfane invisibili, e nulla lo
  // segnalava. Il wizard di import (2.4) permette di aggiungerne, quindi la premessa su cui
  // reggeva quella riga — "l'utente non puo modificarli" — non e piu vera.
  const conAggiunta = {
    tipiDocumento: [{
      id: 'imbreviature', nome: 'Imbreviature Notarili',
      campi: Model.modelloPredefinito('imbreviature').campi.concat(['Carta']),
      campiDef: { Carta: { id: 'Carta', tipo: 'number' } }
    }]
  };
  // Due passate: la regola dev'essere idempotente, o l'archivio risulterebbe da salvare a ogni avvio.
  Model.applicaModelliPredefiniti(conAggiunta);
  assert.strictEqual(Model.applicaModelliPredefiniti(conAggiunta), false, 'idempotente');
  const imbr = conAggiunta.tipiDocumento.find(t => t.id === 'imbreviature');
  assert.ok(imbr.campi.includes('Carta'), "il campo aggiunto dall utente sopravvive");
  assert.strictEqual(imbr.campiDef.Carta.tipo, 'number', 'e con la sua definizione');
  assert.deepStrictEqual(imbr.campi.slice(0, -1), Model.modelloPredefinito('imbreviature').campi,
    'i campi del modello restano in testa e nel loro ordine');

  // ⚠️ Il NOME no: e l'unica cosa di quei tipi che si vede tradotta, e riscriverlo in
  // italiano dentro un'app in inglese sarebbe una regressione visibile a ogni avvio.
  const tradotto = { tipiDocumento: [{ id: 'fiscali', nome: 'Tax records', campi: [] }] };
  Model.applicaModelliPredefiniti(tradotto);
  assert.strictEqual(tradotto.tipiDocumento.find(t => t.id === 'fiscali').nome, 'Tax records');

  // I tipi inventati dall'utente non vengono toccati ne riordinati via.
  const conCustom = { tipiDocumento: [{ id: 'custom_1', nome: 'Mio', campi: ['x'], campiDef: { x: { id: 'x', tipo: 'number' } } }] };
  Model.applicaModelliPredefiniti(conCustom);
  const mio = conCustom.tipiDocumento.find(t => t.id === 'custom_1');
  assert.deepStrictEqual(mio.campi, ['x']);
  assert.strictEqual(mio.campiDef.x.tipo, 'number', 'le definizioni dei tipi custom sopravvivono');
  assert.strictEqual(conCustom.tipiDocumento.length, 4, 'i predefiniti si aggiungono, non sostituiscono');
}

console.log('model: 18 gruppi di test OK');
