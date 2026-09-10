// Fase 2.2 — Stampa e PDF. Il template e' un modulo puro nel main: si testa il build in
// out/, senza Electron e senza stampante (stesso metodo di csvExport.test.js).
const assert = require('assert');
const {
  generaHtmlStampa, sanificaHtml, formattaValoreStampa, campiDaStampare, colonneTabella
} = require('../out/main/print/printTemplate');

const tipi = [
  { id: 'manoscritto', nome: 'Manoscritto', campi: ['autore', 'titolo', 'note', 'allegati'] },
  { id: 'imbreviature', nome: 'Imbreviature Notarili', campi: ['Notaio', 'dataCronica', 'oggetto', 'attori_dinamici'] }
];

function scheda(extra) {
  return Object.assign({
    id: 'x1', segnatura: 'ASP 12', tipoDocumento: 'manoscritto', cartella: 'Fondo',
    tags: 'notaio,vendita', allegati: [], trascrizione: '', lastModified: Date.UTC(2026, 5, 2)
  }, extra || {});
}

let test = 0;
function ok(cond, msg) { assert.ok(cond, msg); }

// --- Fase 3.7: campi propri della scheda ---------------------------------------
{
  test++;
  const m = scheda({
    autore: 'Anonimo',
    Filigrana: 'unicorno',
    campiPropri: [{ id: 'Filigrana', tipo: 'text', label: 'Filigrana' }]
  });
  const campi = campiDaStampare(m, tipi, false);
  ok(campi.includes('Filigrana'), 'Fase 3.7: il campo proprio si stampa');
  ok(campi.indexOf('Filigrana') > campi.indexOf('autore'), 'Fase 3.7: dopo i campi del modello');
  ok(!campi.includes('campiPropri'), 'Fase 3.7: le definizioni non sono una riga della scheda');

  const html = generaHtmlStampa([m], tipi, { layout: 'scheda', etichette: { autore: 'Autore/i' } });
  // L'etichetta viene dal campo stesso: il catalogo del renderer non conosce un campo
  // inventato su una scheda sola, e senza questa regola sulla carta comparirebbe l'id.
  ok(html.includes('Filigrana') && html.includes('unicorno'), 'Fase 3.7: etichetta e valore sulla carta');
}

// --- Fase 3.8: l'ordine dei campi della scheda ---------------------------------
{
  test++;
  const m = scheda({ autore: 'Anonimo', titolo: 'Vendita', note: 'Nota', ordineCampi: ['note', 'titolo'] });
  const campi = campiDaStampare(m, tipi, false);
  // La stampa "scheda" guarda UNA scheda per volta, quindi può seguire l'ordine scelto lì;
  // la tabella no, perché le colonne sono comuni a tutte le schede.
  ok(campi[0] === 'note' && campi[1] === 'titolo', 'Fase 3.8: ordine della scheda rispettato');
  ok(campi.includes('autore'), 'Fase 3.8: ciò che non è elencato resta, in coda');
  ok(!campi.includes('ordineCampi'), 'Fase 3.8: l elenco degli id non è una riga della scheda');
}

// --- Test 1: i tre layout producono documenti diversi e riconoscibili ----------
{
  test++;
  const records = [scheda({ autore: 'Anonimo', titolo: 'Vendita di una casa' })];
  const comuni = { etichette: { autore: 'Autore/i', titolo: 'Titolo' }, nomiTipi: { manoscritto: 'Manoscritto' } };

  const s = generaHtmlStampa(records, tipi, Object.assign({ layout: 'scheda' }, comuni));
  ok(s.includes('class="scheda"'), 'Test 1: layout scheda');
  ok(s.includes('Autore/i') && s.includes('Anonimo'), 'Test 1: campi ed etichette nella scheda');

  const r = generaHtmlStampa(records, tipi, Object.assign({ layout: 'regesto' }, comuni));
  ok(r.includes('regesto-voce') && !r.includes('class="scheda"'), 'Test 1: layout regesto');

  const t = generaHtmlStampa(records, tipi, Object.assign({ layout: 'tabella', colonne: ['autore'] }, comuni));
  ok(t.includes('<table class="tabella"') && t.includes('<th>Autore/i</th>'), 'Test 1: layout tabella');
  // Un layout ignoto non deve produrre una pagina vuota: si ricade sulla scheda.
  const f = generaHtmlStampa(records, tipi, Object.assign({ layout: 'inventato' }, comuni));
  ok(f.includes('class="scheda"'), 'Test 1: layout sconosciuto → scheda');
}

// --- Test 2: la trascrizione e' sanificata ------------------------------------
//
// E' contenuto NON fidato: arriva da un contenteditable e puo' arrivare dal sync, cioe'
// dalla macchina di un collega. Nel documento di stampa non deve poter eseguire nulla.
{
  test++;
  const sporco = '<p>Testo</p><script>alert(1)</script><img src=x onerror="alert(2)">'
    + '<a href="javascript:alert(3)">link</a><span class="ocr-incerto" onclick="alert(4)">dubbio</span>';
  const pulito = sanificaHtml(sporco);
  ok(!/<script/i.test(pulito), 'Test 2: script rimosso');
  ok(!/alert\(1\)/.test(pulito), 'Test 2: anche il CONTENUTO dello script sparisce');
  ok(!/<img/i.test(pulito), 'Test 2: img non e\' in whitelist');
  ok(!/onerror|onclick/i.test(pulito), 'Test 2: nessun gestore di evento sopravvive');
  ok(!/javascript:/i.test(pulito), 'Test 2: href javascript: scartato');
  ok(pulito.includes('<p>Testo</p>'), 'Test 2: il testo legittimo resta');
  // La classe dell'OCR va conservata: e' cio' che distingue una bozza da una rilettura.
  ok(pulito.includes('class="ocr-incerto"') && pulito.includes('dubbio'), 'Test 2: class ammessa');

  const doc = generaHtmlStampa([scheda({ trascrizione: sporco })], tipi,
    { layout: 'scheda', includiTrascrizione: true });
  ok(!/<script|onerror=/i.test(doc), 'Test 2: il documento completo e\' pulito');
  // Seconda barriera indipendente dalla whitelist.
  ok(doc.includes("default-src 'none'"), 'Test 2: CSP nella pagina generata');
}

// --- Test 3: i campi vuoti non si stampano, se non richiesto ------------------
{
  test++;
  const m = scheda({ autore: 'Anonimo', titolo: '', note: '   ' });
  const senza = campiDaStampare(m, tipi, false);
  assert.deepStrictEqual(senza, ['autore'], 'Test 3: solo i campi valorizzati');
  const con = campiDaStampare(m, tipi, true);
  ok(con.includes('titolo') && con.includes('note'), 'Test 3: includiVuoti li riporta');
  // `allegati` e' una chiave di servizio: non e' mai una riga "campo: valore".
  ok(!con.includes('allegati'), 'Test 3: le chiavi di servizio non sono campi');
  // Un campo valorizzato che il tipo non prevede piu' non deve sparire in silenzio.
  const orfano = campiDaStampare(scheda({ campo_orfano: 'valore' }), tipi, false);
  ok(orfano.includes('campo_orfano'), 'Test 3: campo orfano recuperato');
}

// --- Test 4: la data e' leggibile, non ISO ------------------------------------
//
// E' la differenza rispetto al CSV: un foglio di calcolo deve poter ORDINARE la data,
// un foglio di carta deve poterla LEGGERE.
{
  test++;
  const v = formattaValoreStampa('lastModified', Date.UTC(2026, 5, 2), 'it-IT');
  ok(/02\/06\/2026/.test(v), 'Test 4: data in forma leggibile, non ISO: ' + v);
  assert.strictEqual(formattaValoreStampa('lastModified', 0), '', 'Test 4: epoch 0 = nessuna data');
  assert.strictEqual(
    formattaValoreStampa('attori_dinamici', [{ k: 'Venditore', v: 'Bartolo' }, { ruolo: 'Notaio', nome: 'Pietro' }]),
    'Venditore: Bartolo · Notaio: Pietro',
    'Test 4: liste dinamiche appiattite, entrambe le forme storiche'
  );
}

// --- Test 5: escaping dei dati utente in ogni layout --------------------------
{
  test++;
  const cattivo = scheda({ segnatura: '<img src=x onerror=alert(1)>', autore: '"virgolette" & <b>' });
  for (const layout of ['scheda', 'regesto', 'tabella']) {
    const doc = generaHtmlStampa([cattivo], tipi, { layout, colonne: ['autore'] });
    ok(!doc.includes('<img src=x'), `Test 5: segnatura scappata nel layout ${layout}`);
    ok(doc.includes('&lt;img'), `Test 5: resta visibile come testo nel layout ${layout}`);
  }
}

// --- Test 6: miniature — un allegato senza immagine resta ELENCATO -------------
//
// Una scheda che dichiara tre carte e ne mostra due mentirebbe sul proprio contenuto.
{
  test++;
  const m = scheda({ allegati: [
    { nome: 'a1.png', originalName: 'Carta 1r' },
    { nome: 'a2.pdf', originalName: 'Carta 2v' }
  ] });
  const doc = generaHtmlStampa([m], tipi, {
    layout: 'scheda',
    miniature: { 'a1.png': 'print-host://app/allegato/a1.png' }
  });
  ok(doc.includes('print-host://app/allegato/a1.png'), 'Test 6: miniatura presente');
  ok(doc.includes('Carta 1r') && doc.includes('Carta 2v'), 'Test 6: entrambe le carte elencate');
  ok(doc.includes('mini-assente'), 'Test 6: segnaposto per la carta senza miniatura');
}

// --- Test 7: frontespizio ------------------------------------------------------
{
  test++;
  const opz = { layout: 'regesto', intestazione: { fondo: 'ASP Notarile', autore: 'M. Rossi', data: 'giugno 2026' } };
  const con = generaHtmlStampa([scheda({})], tipi, Object.assign({ frontespizio: true }, opz));
  ok(con.includes('class="cover"') && con.includes('ASP Notarile') && con.includes('M. Rossi'),
    'Test 7: frontespizio con fondo e autore');
  const senza = generaHtmlStampa([scheda({})], tipi, opz);
  ok(!senza.includes('class="cover"'), 'Test 7: senza frontespizio non c\'e\' copertina');
  // Ma il nome del fondo apre comunque l'elenco: un inventario anonimo non e' citabile.
  ok(senza.includes('titolo-elenco') && senza.includes('ASP Notarile'), 'Test 7: titolo in testa all\'elenco');
}

// --- Test 8: colonne della tabella --------------------------------------------
{
  test++;
  const records = [scheda({ autore: 'A', titolo: 'T', note: 'N' })];
  assert.deepStrictEqual(colonneTabella(records, tipi, { colonne: ['titolo'] }), ['titolo'],
    'Test 8: vincono le colonne passate dal renderer (vista tabella della 1.1)');
  // Senza colonne il documento non deve ridursi alla sola segnatura.
  const derivate = colonneTabella(records, tipi, {});
  ok(derivate.length >= 2 && derivate.includes('autore'), 'Test 8: fallback sui campi valorizzati');
  // Le chiavi di servizio non diventano mai colonne, nemmeno se richieste.
  assert.deepStrictEqual(colonneTabella(records, tipi, { colonne: ['id', 'trascrizione'] }).length, 3,
    'Test 8: colonne di servizio scartate → si ricade sul calcolo automatico');
}

// --- Test 9: elenco vuoto -----------------------------------------------------
{
  test++;
  const doc = generaHtmlStampa([], tipi, { layout: 'scheda', testi: { print_no_records: 'Vuoto.' } });
  ok(doc.includes('Vuoto.'), 'Test 9: messaggio invece di una pagina bianca');
  ok(!doc.includes('class="cover"'), 'Test 9: nessun frontespizio per zero schede');
}

// --- Test 10: la i18n arriva dal renderer -------------------------------------
//
// Il main non conosce la i18n (lezione della 2.1): se `testi` non passasse, il documento
// uscirebbe in italiano dentro un'applicazione in inglese.
{
  test++;
  const doc = generaHtmlStampa([scheda({
    allegati: [{ nome: 'a1.png', originalName: 'Sheet 1r' }],
    trascrizione: '<p>text</p>'
  })], tipi, {
    layout: 'scheda',
    includiTrascrizione: true,
    testi: { print_section_attachments: 'Attachments', print_section_transcription: 'Transcription' }
  });
  ok(doc.includes('Attachments') && doc.includes('Transcription'), 'Test 10: titoli di sezione dal renderer');
  ok(!doc.includes('Allegati') && !doc.includes('Trascrizione'), 'Test 10: nessuna stringa italiana residua');
  const anonimo = generaHtmlStampa([scheda({ segnatura: '' })], tipi,
    { layout: 'scheda', testi: { print_untitled: 'No shelfmark' } });
  ok(anonimo.includes('No shelfmark'), 'Test 10: segnatura mancante tradotta');
}

console.log(`printTemplate: ${test} test superati.`);
