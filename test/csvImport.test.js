// Fase 2.4 — Import CSV. Il modulo è puro e condiviso (`src/shared/csvImport.ts`): si
// esercita il BUILD reale in `out/` con `node`, senza Electron e senza DOM, come per
// `model`, `dataStorica` e `fase4`.
//
// I due invarianti che contano più di ogni asserzione sulle singole celle:
//  - il **viaggio di andata e ritorno**: ciò che la 2.1 esporta deve rientrare uguale, o
//    l'export non è un formato ma un vicolo cieco (Test "andata e ritorno");
//  - **l'anteprima è l'import**: `costruisciSchede` è l'unica funzione che costruisce, e i
//    test la esercitano esattamente come fa il wizard.
const assert = require('assert');
const CSV = require('../out/shared/csvImport');
const M = require('../out/shared/model');
const { generaCsv } = require('../out/main/ipc/csvExport');

let passati = 0;
function test(nome, fn) {
  fn();
  passati++;
  console.log('  ok  ' + nome);
}

console.log('csvImport.test.js — analisi, mappatura, costruzione delle schede');

const TIPI = [
  {
    id: 'imbreviature',
    nome: 'Imbreviature Notarili',
    campi: ['Notaio', 'dataCronica', 'prezzo', 'inedito', 'supporto', 'fonte', 'attori_dinamici'],
    campiDef: {
      prezzo: { tipo: 'number' },
      inedito: { tipo: 'boolean' },
      supporto: { tipo: 'enum', opzioni: ['Pergamena', 'Carta'] },
      fonte: { tipo: 'url' },
      attori_dinamici: { tipo: 'dynamic_list' },
      Notaio: { tipo: 'text', obbligatorio: true }
    }
  },
  { id: 'atti', nome: 'Atti Giudiziari', campi: ['giudice'] }
];

function ctx(extra) {
  return Object.assign({
    tipiDocumento: TIPI,
    campiBase: {},
    tipoPredefinito: 'imbreviature',
    cartella: '',
    esistenti: []
  }, extra || {});
}

// =============================================================================
// Analisi del testo
// =============================================================================

test('virgolette, a capo dentro la cella, CRLF e virgolette raddoppiate', () => {
  const testo = 'a,b\r\n"uno\ndue","dice ""ciao"""\r\n';
  const r = CSV.analizzaCsv(testo);
  assert.deepStrictEqual(r.intestazioni, ['a', 'b']);
  assert.deepStrictEqual(r.righe, [['uno\ndue', 'dice "ciao"']]);
});

test('il preambolo `sep=` batte l\'euristica, e il BOM non entra nell\'intestazione', () => {
  // Con il punto e virgola dichiarato, la virgola dentro la cella NON deve separare nulla.
  const r = CSV.analizzaCsv('﻿sep=;\r\nSegnatura;Note\r\nASP 1;Rossi, Bianchi\r\n');
  assert.strictEqual(r.delimitatore, ';');
  assert.deepStrictEqual(r.intestazioni, ['Segnatura', 'Note']);
  assert.deepStrictEqual(r.righe, [['ASP 1', 'Rossi, Bianchi']]);
});

test('senza preambolo il delimitatore si indovina sulla prima riga, fuori dalle virgolette', () => {
  // L'esca: tre virgole, ma tutte dentro una cella. Contarle a tappeto darebbe la virgola.
  const r = CSV.analizzaCsv('Segnatura\tAttori\nASP 1\t"Rossi, Bianchi, Verdi, Neri"\n');
  assert.strictEqual(r.delimitatore, '\t');
  assert.deepStrictEqual(r.righe, [['ASP 1', 'Rossi, Bianchi, Verdi, Neri']]);
});

test('le righe vuote non diventano schede e l\'a capo finale non ne aggiunge una', () => {
  const r = CSV.analizzaCsv('a,b\n1,2\n\n,\n3,4\n');
  assert.strictEqual(r.righe.length, 2);
});

test('un\'intestazione vuota riceve comunque un nome, e resta l\'intestazione', () => {
  const r = CSV.analizzaCsv('Segnatura,,Note\nx,y,z\n');
  assert.deepStrictEqual(r.intestazioni, ['Segnatura', 'Colonna 2', 'Note']);
  // L'esca: la riga di dati ha una cella piena IN PIÙ. Con il criterio "vince chi ne ha di
  // più" il programma eleggerebbe i dati a intestazione e perderebbe la prima scheda.
  assert.strictEqual(r.rigaIntestazioni, 0);
  assert.strictEqual(r.righe.length, 1);
});

test('un foglio che comincia con un titolo: l\'intestazione vera viene riconosciuta', () => {
  // È il caso reale che ha rotto il primo wizard: tutte le colonne senza nome, tutte le
  // tendine su "non importare", e la riga di intestazione importata come una scheda.
  const testo = 'CATASTO DI FIESOLE,,,,\n\nSegnatura,Uso,TEMA,Contenuto,Note\nCG,abitazione,x,y,z\n';
  const r = CSV.analizzaCsv(testo);
  assert.strictEqual(r.rigaIntestazioni, 1);   // 0 è il titolo (la riga vuota è già scartata)
  assert.deepStrictEqual(r.intestazioni, ['Segnatura', 'Uso', 'TEMA', 'Contenuto', 'Note']);
  assert.deepStrictEqual(r.righe, [['CG', 'abitazione', 'x', 'y', 'z']]);
});

test('la riga di intestazione si può imporre a mano', () => {
  const testo = 'CATASTO DI FIESOLE,,\nSegnatura,Uso,Note\nCG,abitazione,z\n';
  const r = CSV.analizzaCsv(testo, { rigaIntestazioni: 0 });
  assert.deepStrictEqual(r.intestazioni, ['CATASTO DI FIESOLE', 'Colonna 2', 'Colonna 3']);
  assert.strictEqual(r.righe.length, 2);
  // `tutte` resta a disposizione del wizard per proporne un'altra senza rileggere il file.
  assert.strictEqual(r.tutte.length, 3);
});

test('le colonne sono tante quante ne ha la riga più larga', () => {
  // Una colonna in più solo su qualche riga non deve sparire in silenzio.
  const r = CSV.analizzaCsv('Segnatura,Notaio\nASP 1,Rossi,extra\n');
  assert.deepStrictEqual(r.intestazioni, ['Segnatura', 'Notaio', 'Colonna 3']);
});

// =============================================================================
// Proposta di mappatura
// =============================================================================

const COLONNE = CSV.colonneImportabili(TIPI, { segnatura: 'Segnatura', cartella: 'Archivio', tags: 'Tag' });

test('la proposta riconosce etichette, chiavi e sinonimi, e ignora ciò che non conosce', () => {
  const m = CSV.proponiMappatura(['Collocazione', 'ARCHIVIO', 'Notaio', 'Prezzo di vendita'], COLONNE);
  assert.deepStrictEqual(m, ['segnatura', 'cartella', 'Notaio', '']);
});

test('una destinazione non viene proposta due volte', () => {
  const m = CSV.proponiMappatura(['Segnatura', 'Collocazione'], COLONNE);
  assert.deepStrictEqual(m, ['segnatura', '']);
});

test('le colonne offerte sono di tutti i tipi, non solo di quello scelto', () => {
  const chiavi = COLONNE.map(c => c.chiave);
  assert.ok(chiavi.includes('giudice'), 'manca il campo di un altro tipo');
  assert.ok(chiavi.includes('trascrizione') && chiavi.includes('id'));
});

// =============================================================================
// Conversione e costruzione
// =============================================================================

test('i valori tipizzati arrivano nel tipo giusto (numero, sì/no, tendina, indirizzo)', () => {
  const r = CSV.analizzaCsv('Segnatura,Notaio,prezzo,inedito,supporto,fonte\nASP 1,Rossi,"12,50",Sì,pergamena,www.archivio.it\n');
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, COLONNE), ctx());
  const s = esito.schede[0];
  assert.strictEqual(s.prezzo, 12.5);          // virgola decimale italiana
  assert.strictEqual(s.inedito, true);         // "Sì" non è `true`/`on`: lo converte l'import
  assert.strictEqual(s.supporto, 'Pergamena'); // la tendina è insensibile alle maiuscole
  assert.strictEqual(s.fonte, 'https://www.archivio.it');
  assert.deepStrictEqual(esito.riepilogo, { nuove: 1, aggiornate: 0, scartate: 0, conAvvisi: 0 });
});

test('un valore non convertibile è un avviso dichiarato, non un dato inventato', () => {
  const r = CSV.analizzaCsv('Segnatura,Notaio,prezzo,inedito,supporto\nASP 1,Rossi,dodici,forse,Papiro\n');
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, COLONNE), ctx());
  const codici = esito.esiti[0].problemi.map(p => p.codice).sort();
  assert.deepStrictEqual(codici, ['booleano', 'numero', 'opzione']);
  // La riga entra lo stesso: l'unico blocco è l'obbligatorio mancante (test qui sotto).
  assert.strictEqual(esito.riepilogo.nuove, 1);
  assert.strictEqual(esito.riepilogo.conAvvisi, 1);
});

test('la riga senza un campo obbligatorio viene scartata, non importata a metà', () => {
  const r = CSV.analizzaCsv('Segnatura,Notaio\nASP 1,Rossi\nASP 2,\n');
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, COLONNE), ctx());
  assert.strictEqual(esito.riepilogo.nuove, 1);
  assert.strictEqual(esito.riepilogo.scartate, 1);
  assert.strictEqual(esito.schede.length, 1, 'la scartata non deve finire fra le schede');
  assert.strictEqual(esito.esiti[1].problemi[0].codice, 'obbligatorio');
});

test('il tipo di documento si risolve per nome o per id; sconosciuto = predefinito + avviso', () => {
  const r = CSV.analizzaCsv('Segnatura,Tipo documento,Notaio,giudice\nA,Atti Giudiziari,,Tizio\nB,atti,,Caio\nC,Sconosciuto,Rossi,\n');
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, COLONNE), ctx());
  assert.strictEqual(esito.schede[0].tipoDocumento, 'atti');
  assert.strictEqual(esito.schede[1].tipoDocumento, 'atti');
  assert.strictEqual(esito.schede[2].tipoDocumento, 'imbreviature');
  assert.strictEqual(esito.esiti[2].problemi[0].codice, 'tipo_sconosciuto');
  // L'esca: le prime due righe hanno il Notaio vuoto ma NON sono scartate, perché il campo
  // obbligatorio appartiene all'altro tipo. Senza risoluzione per riga cadrebbero entrambe.
  assert.strictEqual(esito.riepilogo.scartate, 0);
});

test('gli archivi mancanti vengono elencati, con i separatori normalizzati', () => {
  const r = CSV.analizzaCsv('Segnatura,Notaio,Archivio\nA,Rossi,Notarile\\Imbreviature\nB,Rossi,Notarile/Imbreviature\n');
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, COLONNE), ctx());
  assert.deepStrictEqual(esito.cartelleNuove, ['Notarile/Imbreviature']);
});

test('i doppioni si segnalano ma non bloccano: un fondo reale ha segnature ripetute', () => {
  const esistenti = [{ id: 'x1', segnatura: 'ASP 1', cartella: '', tipoDocumento: 'imbreviature' }];
  const r = CSV.analizzaCsv('Segnatura,Notaio\nASP 1,Rossi\nASP 2,Rossi\nasp 2,Bianchi\n');
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, COLONNE), ctx({ esistenti }));
  assert.strictEqual(esito.esiti[0].problemi[0].codice, 'doppione');       // già in archivio
  assert.strictEqual(esito.esiti[2].problemi[0].codice, 'doppione_file');  // ripetuta nel file
  assert.strictEqual(esito.riepilogo.nuove, 3);
});

test('in modalità aggiornamento la riga diventa una patch, e non azzera i campi assenti', () => {
  const esistenti = [{ id: 'x1', segnatura: 'ASP 1', cartella: 'Vecchia', tipoDocumento: 'imbreviature', Notaio: 'Rossi', prezzo: 9 }];
  const r = CSV.analizzaCsv('Segnatura,Notaio\nASP 1,Bianchi\n');
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, COLONNE), ctx({ esistenti, aggiorna: true }));
  assert.strictEqual(esito.riepilogo.aggiornate, 1);
  const patch = esito.schede[0];
  assert.strictEqual(patch.id, 'x1');
  assert.strictEqual(patch.Notaio, 'Bianchi');
  // Il file non ha la colonna prezzo né l'archivio: la patch non deve toccarli.
  assert.ok(!('prezzo' in patch), 'la patch non deve contenere campi che il file non ha');
  assert.ok(!('cartella' in patch), "senza colonna archivio la scheda non deve essere spostata");
});

test('gli id in ingresso non diventano mai l\'id di una scheda nuova', () => {
  const r = CSV.analizzaCsv('ID,Segnatura,Notaio\nfinto-123,ASP 9,Rossi\n');
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, COLONNE), ctx());
  assert.notStrictEqual(esito.schede[0].id, 'finto-123');
});

test('una colonna non mappata non entra nella scheda', () => {
  const r = CSV.analizzaCsv('Segnatura,Notaio,Colonna di servizio\nASP 1,Rossi,scarto\n');
  const mappatura = CSV.proponiMappatura(r.intestazioni, COLONNE);
  assert.strictEqual(mappatura[2], '');
  const s = CSV.costruisciSchede(r.righe, mappatura, ctx()).schede[0];
  assert.ok(!('Colonna di servizio' in s));
  assert.strictEqual(Object.values(s).indexOf('scarto'), -1, 'il valore scartato non deve comparire da nessuna parte');
});

// =============================================================================
// Campi inventati nel wizard
// =============================================================================

test('un campo nuovo si può mappare e converte già col tipo dichiarato', () => {
  const extra = [{ id: 'Numero di carta', tipo: 'number' }];
  const colonne = CSV.colonneImportabili(TIPI, {}, extra);
  assert.ok(colonne.some(c => c.chiave === 'Numero di carta' && c.nuovo), 'il campo nuovo va marcato');

  const r = CSV.analizzaCsv('Segnatura,Notaio,Numero di carta\nASP 1,Rossi,"12"\n');
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, colonne), ctx({ campiExtra: extra }));
  // Numero e non stringa: l'anteprima deve mostrare ciò che entrerà davvero, o mostrerebbe
  // come testo un valore che poi diventa numero.
  assert.strictEqual(esito.schede[0]['Numero di carta'], 12);
});

test('il nome di un campo nuovo resta leggibile ma non può calpestare ciò che esiste', () => {
  assert.strictEqual(CSV.idCampoNuovo('  Numero  di carta '), 'Numero di carta');
  // Chiavi di servizio e colonne di base: un campo che si chiamasse così sovrascriverebbe
  // un pezzo della scheda invece di aggiungersi.
  assert.strictEqual(CSV.idCampoNuovo('tags'), '');
  assert.strictEqual(CSV.idCampoNuovo('segnatura'), '');
  assert.strictEqual(CSV.idCampoNuovo('lastModified'), '');
  assert.strictEqual(CSV.idCampoNuovo(''), '');
  // …e nemmeno un campo che esiste già, anche scritto con altre maiuscole.
  assert.strictEqual(CSV.idCampoNuovo('notaio', COLONNE), '');
});

// =============================================================================
// Andata e ritorno con l'export della 2.1
// =============================================================================

test('andata e ritorno: ciò che la 2.1 esporta rientra uguale', () => {
  const originali = [
    {
      id: 'r1', cartella: 'Notarile', tipoDocumento: 'imbreviature', segnatura: 'ASP 1',
      tags: 'pergamena, notarile', Notaio: 'Rossi', prezzo: 12.5, inedito: true,
      supporto: 'Pergamena', fonte: 'https://archivio.it/1',
      attori_dinamici: [{ k: 'Notaio', v: 'Rossi' }, { k: 'Teste', v: 'Bianchi' }],
      lastModified: 1000, creatoDa: 'Tizio', modificatoDa: 'Tizio', allegati: []
    }
  ];
  const csv = generaCsv(originali, TIPI, { formato: 'csv' });

  const r = CSV.analizzaCsv(csv);
  const mappatura = CSV.proponiMappatura(r.intestazioni, COLONNE);
  const esito = CSV.costruisciSchede(r.righe, mappatura, ctx());
  const s = esito.schede[0];

  assert.strictEqual(s.segnatura, 'ASP 1');
  assert.strictEqual(s.cartella, 'Notarile');
  assert.strictEqual(s.tipoDocumento, 'imbreviature');
  assert.deepStrictEqual(M.tags(s), ['pergamena', 'notarile']);
  assert.strictEqual(s.Notaio, 'Rossi');
  assert.strictEqual(s.prezzo, 12.5);
  assert.strictEqual(s.inedito, true);
  assert.strictEqual(s.supporto, 'Pergamena');
  assert.strictEqual(s.fonte, 'https://archivio.it/1');
  assert.deepStrictEqual(s.attori_dinamici, [{ k: 'Notaio', v: 'Rossi' }, { k: 'Teste', v: 'Bianchi' }]);
  // L'export scrive il tipo col NOME leggibile solo se `nomiTipi` lo mappa; qui no, quindi
  // esce l'id — ed entrambe le forme devono rientrare (vedi il test sui tipi).
  assert.strictEqual(esito.riepilogo.scartate, 0);
});

test('l\'apostrofo anti-formula dell\'export non finisce dentro il dato', () => {
  // `neutralizzaFormula` antepone `'` alle celle che Excel eseguirebbe: quel carattere
  // appartiene al file, non al dato. Senza `ripulisciCella` un archivio esportato e
  // reimportato guadagnerebbe un apostrofo a ogni giro.
  const csv = generaCsv([{ id: 'r1', cartella: '', tipoDocumento: 'imbreviature', segnatura: '=SOMMA(A1)', Notaio: 'Rossi', allegati: [] }], TIPI, {});
  const r = CSV.analizzaCsv(csv);
  const esito = CSV.costruisciSchede(r.righe, CSV.proponiMappatura(r.intestazioni, COLONNE), ctx());
  assert.strictEqual(esito.riepilogo.nuove, 1);
  assert.strictEqual(esito.schede[0].segnatura, '=SOMMA(A1)');
  // L'esca: un apostrofo che NON precede un carattere pericoloso è dato dell'utente e resta.
  assert.strictEqual(CSV.ripulisciCella("'Ndrangheta"), "'Ndrangheta");
  // …e un numero negativo non è mai stato escapato, quindi non va sfrondato.
  assert.strictEqual(CSV.ripulisciCella("-12"), '-12');
});

// --- Campi propri della scheda (Fase 3.7) -------------------------------------

test('3.7: una colonna che il modello non prevede diventa un campo PROPRIO della scheda', () => {
  // Senza questa regola il valore entrerebbe nel record come chiave orfana: nel file, ma
  // invisibile in ogni schermata dell'app.
  const righe = [['ASP 9', 'Rossi', 'unicorno']];
  const esito = CSV.costruisciSchede(righe, ['segnatura', 'Notaio', 'Filigrana'], ctx());
  const s = esito.schede[0];
  assert.strictEqual(s.Filigrana, 'unicorno');
  assert.deepStrictEqual(M.campiPropri(s).map(d => d.id), ['Filigrana']);
  // I campi del MODELLO non ci finiscono dentro: appartengono al tipo, non alla scheda.
  assert.ok(!M.campiPropri(s).some(d => d.id === 'Notaio'));
});

test('3.7: le colonne dei campi propri già in archivio sono offerte come destinazione', () => {
  const propri = [{ id: 'Filigrana', tipo: 'text', label: 'Filigrana' }];
  const colonne = CSV.colonneImportabili(TIPI, {}, [], propri);
  const voce = colonne.find(c => c.chiave === 'Filigrana');
  assert.ok(voce, 'senza, un CSV appena esportato non sarebbe reimportabile');
  // Non è "nuovo": esiste già in archivio, anche se non appartiene a nessun modello.
  assert.ok(!voce.nuovo);
});

test('3.7: aggiornando una scheda i campi propri si UNISCONO, non si sostituiscono', () => {
  const gemella = {
    id: 'r1', segnatura: 'ASP 9', tipoDocumento: 'imbreviature', Notaio: 'Rossi',
    Filigrana: 'unicorno', campiPropri: [{ id: 'Filigrana', tipo: 'text', label: 'Filigrana' }]
  };
  const esito = CSV.costruisciSchede(
    [['ASP 9', 'Rossi', '12']],
    ['segnatura', 'Notaio', 'Numero di carte'],
    ctx({ esistenti: [gemella], aggiorna: true })
  );
  const patch = esito.schede[0];
  assert.strictEqual(esito.riepilogo.aggiornate, 1);
  // Un file con una colonna in più non deve cancellare i campi che la scheda già portava.
  assert.deepStrictEqual(patch.campiPropri.map(d => d.id), ['Filigrana', 'Numero di carte']);
});

console.log(`\n${passati} test superati.`);
