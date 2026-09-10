// Fase 2.1 — Export CSV/TSV. Il modulo e' puro e vive nel main: si testa direttamente il
// build in out/, senza Electron (stesso metodo di zipStreaming.test.js).
const assert = require('assert');
const { generaCsv, costruisciColonne, neutralizzaFormula } = require('../out/main/ipc/csvExport');

const tipi = [
  { id: 'manoscritto', nome: 'Manoscritto', campi: ['autore', 'titolo', 'note'] },
  { id: 'imbreviature', nome: 'Imbreviature Notarili', campi: ['Notaio', 'dataCronica', 'attori_dinamici', 'note'] },
  { id: 'fiscali', nome: 'Documenti Fiscali', campi: ['dichiarante', 'beni_dinamici'] }
];

function righe(testo) {
  // BOM e preambolo `sep=` non fanno parte dei dati: vanno tolti prima di confrontare.
  return testo.replace(/^﻿/, '').replace(/^sep=./, '').replace(/^\r\n/, '').replace(/\r\n$/, '').split('\r\n');
}

// --- Campi propri della scheda (Fase 3.7) -------------------------------------
{
  const records = [
    { id: '1', tipoDocumento: 'manoscritto', autore: 'Anonimo', Filigrana: 'unicorno',
      campiPropri: [{ id: 'Filigrana', tipo: 'text', label: 'Filigrana' }] },
    { id: '2', tipoDocumento: 'manoscritto', autore: 'Ignoto' }
  ];
  const colonne = costruisciColonne(records, tipi);
  const chiavi = colonne.map(c => c.chiave);
  assert.ok(chiavi.includes('Filigrana'), '3.7: il campo proprio diventa una colonna');
  const col = colonne.find(c => c.chiave === 'Filigrana');
  // L'intestazione e' l'ETICHETTA del campo: un id di database in cima a una colonna
  // costringe chi apre il file in Excel a indovinare cosa contiene.
  assert.strictEqual(col.etichetta, 'Filigrana', "3.7: intestazione dall'etichetta del campo");
  // `campiPropri` porta le DEFINIZIONI: e' una chiave di servizio, non un dato da esportare.
  assert.ok(!chiavi.includes('campiPropri'), '3.7: le definizioni non diventano una colonna');

  const csv = generaCsv(records, tipi, { estensione: 'csv' });
  assert.ok(csv.includes('unicorno'), '3.7: il valore del campo proprio finisce nel file');
}

// --- Colonne -----------------------------------------------------------------
{
  const records = [
    { id: '1', tipoDocumento: 'manoscritto', autore: 'Anonimo' },
    { id: '2', tipoDocumento: 'imbreviature', Notaio: 'Pietro' }
  ];
  const chiavi = costruisciColonne(records, tipi).map(c => c.chiave);
  assert.deepStrictEqual(chiavi.slice(0, 8), ['segnatura', 'tipoDocumento', 'cartella', 'tags', 'allegati', 'lastModified', 'modificatoDa', 'creatoDa'], 'colonne base attese in testa');
  // L'ID chiude la riga: e' tecnico, la segnatura e' cio' che l'utente legge per primo.
  assert.strictEqual(chiavi[chiavi.length - 1], 'id', 'ID in ultima colonna');
  assert.ok(chiavi.includes('autore') && chiavi.includes('Notaio'), 'unione dei campi dei tipi presenti');
  assert.ok(!chiavi.includes('dichiarante'), 'i tipi assenti dalla selezione non portano colonne');
  // `note` appartiene a due tipi: una sola colonna.
  assert.strictEqual(chiavi.filter(c => c === 'note').length, 1, 'campo condiviso deduplicato');
}

// Campo valorizzato il cui tipo non esiste piu': non deve sparire.
{
  const records = [{ id: '1', tipoDocumento: 'sparito', campo_orfano: 'valore' }];
  const chiavi = costruisciColonne(records, tipi).map(c => c.chiave);
  assert.ok(chiavi.includes('campo_orfano'), 'campo orfano recuperato dalle chiavi del record');
}

// Etichette dal renderer, fallback all'id del campo.
{
  const records = [{ id: '1', tipoDocumento: 'manoscritto', autore: 'x' }];
  const col = costruisciColonne(records, tipi, { autore: 'Autore/i', segnatura: 'Shelfmark' });
  assert.strictEqual(col.find(c => c.chiave === 'autore').etichetta, 'Autore/i');
  assert.strictEqual(col.find(c => c.chiave === 'segnatura').etichetta, 'Shelfmark');
  assert.strictEqual(col.find(c => c.chiave === 'titolo').etichetta, 'titolo', 'senza etichetta si usa l\'id');
}

// --- Serializzazione ---------------------------------------------------------
{
  const records = [{
    id: '1', segnatura: 'ASP, 12', tipoDocumento: 'imbreviature', cartella: 'Fondo A/1340',
    tags: 'notaio,vendita', Notaio: 'Pietro di "Giovanni"', dataCronica: '1340',
    attori_dinamici: [{ k: 'Venditore', v: 'Bartolo' }, { ruolo: 'Compratore', nome: 'Cecco' }],
    allegati: [{ nome: 'a1.jpg', originalName: 'c12r.jpg' }, 'sciolto.png'],
    lastModified: Date.UTC(2026, 8, 7, 10, 30), modificatoDa: 'antonio'
  }];
  const out = righe(generaCsv(records, tipi, { nomiTipi: { imbreviature: 'Imbreviature Notarili' } }));
  assert.strictEqual(out.length, 2);
  const r = out[1];
  assert.ok(r.includes('"ASP, 12"'), 'la virgola forza il quoting');
  assert.ok(r.includes('"Pietro di ""Giovanni"""'), 'le virgolette si raddoppiano');
  assert.ok(r.includes('Venditore: Bartolo; Compratore: Cecco'), 'lista dinamica appiattita (k/v e ruolo/nome)');
  assert.ok(r.includes('c12r.jpg; sciolto.png'), 'allegati per nome originale');
  assert.ok(r.includes('2026-09-07T10:30:00.000Z'), 'data in ISO, ordinabile');
  assert.ok(r.includes('Imbreviature Notarili'), 'tipo tradotto in nome leggibile');
}

// BOM presente di default (senza, Excel su Windows sbaglia le diacritiche).
assert.ok(generaCsv([{ id: '1' }], tipi).startsWith('﻿'));
assert.ok(!generaCsv([{ id: '1' }], tipi, { bom: false }).startsWith('﻿'));

// Preambolo `sep=,`: senza, Excel con separatore di lista italiano (`;`) non spezza le
// colonne e riversa l'intera riga nella prima cella. Nel TSV non serve: il tab non e' ambiguo.
{
  const rec = [{ id: '1', tipoDocumento: 'manoscritto' }];
  assert.ok(generaCsv(rec, tipi, { bom: false }).startsWith('sep=,\r\n'), 'il CSV dichiara il separatore');
  assert.ok(generaCsv(rec, tipi).startsWith('﻿sep=,'), 'il preambolo sta DOPO il BOM');
  assert.ok(!generaCsv(rec, tipi, { formato: 'tsv', bom: false }).startsWith('sep='), 'il TSV non ha preambolo');
  assert.ok(generaCsv(rec, tipi, { bom: false, preambolo: false }).startsWith('Segnatura,'), 'preambolo disattivabile');
}

// TSV: delimitatore tab e tab interni neutralizzati (i parser TSV ignorano il quoting).
{
  const out = righe(generaCsv([{ id: '1', tipoDocumento: 'manoscritto', note: 'a\tb' }], tipi, { formato: 'tsv' }));
  assert.ok(out[0].includes('\t'), 'intestazione separata da tab');
  assert.ok(out[1].includes('a b'), 'tab interno sostituito da spazio');
  assert.ok(!out[1].includes('a\tb'));
}

// Newline dentro una cella: preservato, ma dentro le virgolette (una riga logica sola).
{
  const testo = generaCsv([{ id: '1', tipoDocumento: 'manoscritto', note: 'riga1\nriga2' }], tipi);
  assert.ok(testo.includes('"riga1\nriga2"'));
}

// --- Formula injection -------------------------------------------------------
assert.strictEqual(neutralizzaFormula('=SOMMA(A1)'), "'=SOMMA(A1)");
assert.strictEqual(neutralizzaFormula('+1+1'), "'+1+1");
assert.strictEqual(neutralizzaFormula('@import'), "'@import");
assert.strictEqual(neutralizzaFormula('-cmd'), "'-cmd");
assert.strictEqual(neutralizzaFormula('-12 fiorini'), '-12 fiorini', 'un importo negativo resta un numero');
assert.strictEqual(neutralizzaFormula('Perugia'), 'Perugia');
{
  const out = righe(generaCsv([{ id: '1', tipoDocumento: 'manoscritto', note: '=HYPERLINK("http://x")' }], tipi));
  assert.ok(out[1].includes("'=HYPERLINK"), 'la neutralizzazione passa dalla serializzazione');
}

// Ordine dei record = ordine ricevuto (il main non riordina).
{
  const recs = [{ id: 'b', tipoDocumento: 'manoscritto' }, { id: 'a', tipoDocumento: 'manoscritto' }];
  const out = righe(generaCsv(recs, tipi));
  assert.ok(out[1].endsWith('b') && out[2].endsWith('a'), 'ordine dei record preservato (ID in coda)');
}

// Valori assenti: celle vuote, mai "undefined".
{
  const out = righe(generaCsv([{ id: '1', tipoDocumento: 'manoscritto' }], tipi));
  assert.ok(!out[1].includes('undefined') && !out[1].includes('null'));
}

console.log('csvExport.test.js OK');
