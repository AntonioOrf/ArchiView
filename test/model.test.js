const assert = require('assert');
const Model = require('../out/shared/model');

{
  assert.strictEqual(typeof Model.SCHEMA_VERSION, 'number');
  assert.ok(Model.SCHEMA_VERSION >= 1);
  const versioni = Model.MIGRAZIONI.map(m => m.versione);
  assert.deepStrictEqual(versioni, versioni.slice().sort((a, b) => a - b), 'catena ordinata');
  assert.strictEqual(versioni[versioni.length - 1], Model.SCHEMA_VERSION, 'la catena arriva alla versione corrente');
  assert.strictEqual(new Set(versioni).size, versioni.length, 'nessuna versione ripetuta');
  assert.strictEqual(Model.versioneDi({}), 0, 'un file senza schemaVersion è alla versione 0');
  assert.strictEqual(Model.versioneDi({ schemaVersion: 3 }), 3);
  assert.strictEqual(Model.versioneDi({ schemaVersion: 'x' }), 0, 'una versione non numerica vale 0');
}

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

{
  const db = { cartelle: [], manoscritti: [{ id: '1', tipoDocumento: 'manoscritto' }] };
  const primo = Model.migraDatabase(db);
  const dopoPrimo = JSON.stringify(primo.db);
  const secondo = Model.migraDatabase(primo.db);
  assert.strictEqual(JSON.stringify(secondo.db), dopoPrimo, 'la seconda passata non cambia nulla');
  assert.deepStrictEqual(secondo.applicate, [], 'niente da applicare, quindi niente da scrivere');
}

{
  const db = {
    cartelle: [], manoscritti: [
      { id: '1', tipoDocumento: 'manoscritto', lastModified: 111, modificatoDa: 'Rossi', creatoDa: 'Bianchi' }
    ]
  };
  const m = Model.migraDatabase(db).db.manoscritti[0];
  assert.strictEqual(m.lastModified, 111);
  assert.strictEqual(m.modificatoDa, 'Rossi');
  assert.strictEqual(m.creatoDa, 'Bianchi');
}

{
  const db = {
    schemaVersion: Model.SCHEMA_VERSION + 5,
    cartelle: [], manoscritti: [{ id: '1', tipoDocumento: 'manoscritto', campoIgnoto: 'x' }]
  };
  const esito = Model.migraDatabase(db);
  assert.strictEqual(esito.futuro, true, 'il chiamante viene avvertito');
  assert.strictEqual(esito.db.schemaVersion, Model.SCHEMA_VERSION + 5, 'nessun downgrade silenzioso');
  assert.strictEqual(esito.db.manoscritti[0].tipoDocumento, 'manoscritto', 'i record restano intatti');
  assert.strictEqual(esito.db.manoscritti[0].campoIgnoto, 'x', 'i campi sconosciuti sopravvivono');
  assert.deepStrictEqual(esito.applicate, []);
}

{
  const db = {
    cartelle: [], manoscritti: [{ id: '1', tipoDocumento: 'manoscritto', cartella: 'F' }],
    baseObjects: { '1': { id: '1', tipoDocumento: 'manoscritto', cartella: 'F' } }
  };
  const esito = Model.migraDatabase(db);
  assert.strictEqual(esito.db.baseObjects['1'].tipoDocumento, Model.TIPO_PREDEFINITO);
  assert.strictEqual(
    JSON.stringify(esito.db.manoscritti[0]),
    JSON.stringify(esito.db.baseObjects['1']),
    'record e base restano identici dopo la migrazione'
  );
}

{
  assert.strictEqual(Model.motivoNonValido({ cartelle: [], manoscritti: [] }), null);
  assert.ok(Model.motivoNonValido(null), 'null non è un database');
  assert.ok(Model.motivoNonValido([]), 'un array non è un database');
  assert.ok(Model.motivoNonValido({ cartelle: [] }), 'senza manoscritti non è valido');
  assert.ok(Model.motivoNonValido({ manoscritti: [] }), 'senza cartelle non è valido');
  assert.ok(Model.motivoNonValido({ cartelle: [], manoscritti: [], tipiDocumento: {} }), 'tipiDocumento deve essere un elenco');
  assert.strictEqual(typeof Model.motivoNonValido({}), 'string');
  assert.strictEqual(Model.databaseValido({ cartelle: [], manoscritti: [] }), true);
}

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

  const esistente = { id: '9', cartella: 'F', tipoDocumento: 'atti' };
  const chiaviPrima = Object.keys(esistente).sort();
  Model.normalizzaScheda(esistente);
  assert.deepStrictEqual(Object.keys(esistente).sort(), chiaviPrima, 'nessuna chiave aggiunta');
}

{
  for (const k of ['id', 'segnatura', 'tags', 'cartella', 'tipoDocumento', 'allegati', 'lastModified', 'trascrizione']) {
    assert.ok(Model.CHIAVI_SERVIZIO.includes(k), 'manca la chiave di servizio ' + k);
  }
  const csv = require('../out/main/ipc/csvExport');
  const colonne = csv.costruisciColonne([{ id: '1', tipoDocumento: 'x', lastModified: 1, dataCronica: '1340' }], []);
  const chiavi = colonne.map(c => c.chiave);
  assert.ok(chiavi.includes('dataCronica'), 'il campo vero diventa colonna');
  assert.strictEqual(chiavi.filter(c => c === 'lastModified').length, 1, 'la chiave di servizio resta solo fra le colonne base');
}

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
  assert.strictEqual(defs[2].tipo, 'text', 'campo senza definizione = testo');
  assert.strictEqual(defs[3].tipo, 'number', 'campiDef vince');
  assert.strictEqual(defs[3].obbligatorio, true);
  assert.strictEqual(Model.campiDelTipo(tipo)[0].tipo, 'text');
}

{
  const tipo = { campi: ['supporto'], campiDef: { supporto: { id: 'supporto', tipo: 'enum' } } };
  assert.strictEqual(Model.campiDelTipo(tipo)[0].tipo, 'text', 'enum senza opzioni ricade su testo');
  const conValori = { campi: ['supporto'], campiDef: { supporto: { id: 'supporto', tipo: 'enum', opzioni: ['carta', 'pergamena'] } } };
  assert.deepStrictEqual(Model.campiDelTipo(conValori)[0].opzioni, ['carta', 'pergamena']);
}

{
  const tipo = { id: 't', nome: 'T' };
  Model.impostaCampi(tipo, [
    { id: 'titolo', tipo: 'text' },
    { id: 'carte', tipo: 'number' },
    { id: 'titolo', tipo: 'textarea' }
  ]);
  assert.deepStrictEqual(tipo.campi, ['titolo', 'carte'], 'solo stringhe, senza duplicati');
  assert.deepStrictEqual(Object.keys(tipo.campiDef), ['carte'], 'in campiDef solo cio che non e testo semplice');
  const soloTesto = { id: 'x', nome: 'X', campiDef: { vecchio: {} } };
  Model.impostaCampi(soloTesto, [{ id: 'a', tipo: 'text' }]);
  assert.strictEqual(soloTesto.campiDef, undefined, 'mappa vuota = mappa assente');
}

{
  const num = { id: 'n', tipo: 'number' };
  assert.strictEqual(Model.normalizzaValore(num, '12'), 12);
  assert.strictEqual(Model.normalizzaValore(num, '1,5'), 1.5, 'la virgola decimale e quella che si batte');
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

{
  assert.strictEqual(Model.validaValore({ tipo: 'text' }, ''), null, 'un campo facoltativo vuoto va bene');
  assert.strictEqual(Model.validaValore({ tipo: 'text', obbligatorio: true }, ''), 'obbligatorio');
  assert.strictEqual(Model.validaValore({ tipo: 'number' }, 'dodici'), 'numero');
  assert.strictEqual(Model.validaValore({ tipo: 'number' }, 0), null, 'zero e un valore, non un vuoto');
  assert.strictEqual(Model.validaValore({ tipo: 'url' }, 'archivio.it'), 'url');
  assert.strictEqual(Model.validaValore({ tipo: 'url' }, 'https://archivio.it'), null);
  assert.strictEqual(Model.validaValore({ tipo: 'url' }, 'javascript:alert(1)'), 'url');
  assert.strictEqual(Model.validaValore({ tipo: 'enum', opzioni: ['a'] }, 'b'), 'opzione');
  assert.strictEqual(Model.validaValore({ tipo: 'boolean', obbligatorio: true }, false), null);
  assert.strictEqual(Model.validaValore({ tipo: 'text', unico: true }, 'ASP 1'), null);
}

{
  const records = [
    { id: '1', inv: 'ASP 1' }, { id: '2', inv: 'asp 1  ' }, { id: '3', inv: 'ASP 2' }, { id: '4' }
  ];
  assert.deepStrictEqual(Model.duplicatiCampo(records, 'inv', 'ASP 1', '1'), ['2']);
  assert.deepStrictEqual(Model.duplicatiCampo(records, 'inv', 'ASP 3', null), []);
  assert.deepStrictEqual(Model.duplicatiCampo(records, 'inv', '', null), [], 'il vuoto non e mai duplicato');
}

{
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
  assert.strictEqual(esito.db.tipiDocumento[1].campiDef, undefined, 'definizione orfana rimossa');
  assert.strictEqual(esito.db.schemaVersion, Model.SCHEMA_VERSION);
  const dopo = JSON.stringify(esito.db);
  assert.strictEqual(JSON.stringify(Model.migraDatabase(esito.db).db), dopo);
}

{
  const ids = Model.MODELLI_PREDEFINITI.map(m => m.id);
  assert.deepStrictEqual(ids, ['imbreviature', 'atti', 'fiscali'], 'i tre modelli, in ordine');
  assert.ok(Model.MODELLI_PREDEFINITI.every(m => m.nome && Array.isArray(m.campi) && m.campi.length));
  assert.strictEqual(Model.modelloPredefinito('atti').campi[0], 'dataCronica');
  assert.strictEqual(Model.modelloPredefinito('inesistente'), null);
  assert.ok(ids.includes(Model.TIPO_PREDEFINITO), 'il tipo di ripiego e uno dei predefiniti');
}

{
  const vuoto = { cartelle: [], manoscritti: [], tipiDocumento: [] };
  assert.strictEqual(Model.applicaModelliPredefiniti(vuoto), true);
  assert.deepStrictEqual(vuoto.tipiDocumento.map(t => t.id), ['imbreviature', 'atti', 'fiscali']);
  assert.strictEqual(Model.applicaModelliPredefiniti(vuoto), false);

  const conVecchio = { tipiDocumento: [{ id: 'manoscritto', nome: 'Manoscritto', campi: [] }] };
  Model.applicaModelliPredefiniti(conVecchio);
  assert.ok(!conVecchio.tipiDocumento.some(t => t.id === 'manoscritto'), "'manoscritto' rimosso");

  const disallineato = { tipiDocumento: [{ id: 'atti', nome: 'Atti Giudiziari', campi: ['solo_uno'] }] };
  Model.applicaModelliPredefiniti(disallineato);
  const atti = disallineato.tipiDocumento.find(t => t.id === 'atti');
  const attiPref = Model.modelloPredefinito('atti').campi;
  assert.deepStrictEqual(atti.campi, attiPref.concat(['solo_uno']), 'campi del modello + quello aggiunto');

  const conAggiunta = {
    tipiDocumento: [{
      id: 'imbreviature', nome: 'Imbreviature Notarili',
      campi: Model.modelloPredefinito('imbreviature').campi.concat(['Carta']),
      campiDef: { Carta: { id: 'Carta', tipo: 'number' } }
    }]
  };
  Model.applicaModelliPredefiniti(conAggiunta);
  assert.strictEqual(Model.applicaModelliPredefiniti(conAggiunta), false, 'idempotente');
  const imbr = conAggiunta.tipiDocumento.find(t => t.id === 'imbreviature');
  assert.ok(imbr.campi.includes('Carta'), "il campo aggiunto dall utente sopravvive");
  assert.strictEqual(imbr.campiDef.Carta.tipo, 'number', 'e con la sua definizione');
  assert.deepStrictEqual(imbr.campi.slice(0, -1), Model.modelloPredefinito('imbreviature').campi,
    'i campi del modello restano in testa e nel loro ordine');

  const tradotto = { tipiDocumento: [{ id: 'fiscali', nome: 'Tax records', campi: [] }] };
  Model.applicaModelliPredefiniti(tradotto);
  assert.strictEqual(tradotto.tipiDocumento.find(t => t.id === 'fiscali').nome, 'Tax records');

  const conCustom = { tipiDocumento: [{ id: 'custom_1', nome: 'Mio', campi: ['x'], campiDef: { x: { id: 'x', tipo: 'number' } } }] };
  Model.applicaModelliPredefiniti(conCustom);
  const mio = conCustom.tipiDocumento.find(t => t.id === 'custom_1');
  assert.deepStrictEqual(mio.campi, ['x']);
  assert.strictEqual(mio.campiDef.x.tipo, 'number', 'le definizioni dei tipi custom sopravvivono');
  assert.strictEqual(conCustom.tipiDocumento.length, 4, 'i predefiniti si aggiungono, non sostituiscono');
}

console.log('model: 18 gruppi di test OK');
