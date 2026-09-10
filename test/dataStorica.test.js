// Fase 3.2 — Data storica fuzzy. Modulo puro e condiviso: si testa il build in out/ con
// `node`, senza Electron e senza DOM.
const assert = require('assert');
const D = require('../out/shared/dataStorica');

/** Scorciatoia leggibile: [daAAAAMMGG, aAAAAMMGG, qualificatore]. */
function letta(testo) {
  const d = D.analizza(testo);
  return [d.da, d.a, d.qualificatore, d.riconosciuta];
}

// --- Test 1: data piena, in tutte le forme in cui si scrive --------------------
{
  for (const forma of ['12 maggio 1340', '12 magg. 1340', '12 di maggio 1340', '1340 maggio 12',
                       '12/5/1340', '12-05-1340', '1340-05-12']) {
    assert.deepStrictEqual(letta(forma), [13400512, 13400512, 'esatta', true], forma);
  }
  // Mesi latini: gli inventari e i regesti li usano ancora.
  assert.deepStrictEqual(letta('12 maii 1340'), [13400512, 13400512, 'esatta', true]);
  // Il 31 aprile non esiste: la data piena viene rifiutata e si ricade sul MESE, che è
  // l'informazione certa che resta. Ricadere sull'anno intero butterebbe via l'aprile.
  assert.deepStrictEqual(letta('31 aprile 1340'), [13400401, 13400430, 'anno', true]);
}

// --- Test 2: solo anno, mese e anno --------------------------------------------
{
  assert.deepStrictEqual(letta('1340'), [13400101, 13401231, 'anno', true]);
  assert.deepStrictEqual(letta('maggio 1340'), [13400501, 13400531, 'anno', true]);
  assert.deepStrictEqual(letta('1340 maggio'), [13400501, 13400531, 'anno', true]);
  // Febbraio bisestile: 1340 è divisibile per 4.
  assert.strictEqual(D.analizza('febbraio 1340').a, 13400229);
  assert.strictEqual(D.analizza('febbraio 1341').a, 13410228);
}

// --- Test 3: incertezza dichiarata ---------------------------------------------
{
  for (const forma of ['c. 1340', 'ca. 1340', 'circa 1340', 'verso il 1340', 'intorno al 1340']) {
    const d = D.analizza(forma);
    assert.strictEqual(d.qualificatore, 'circa', forma);
    assert.strictEqual(d.certa, false, forma);
    // L'anno NON viene allargato: "circa" è un'incertezza dichiarata, non un intervallo di
    // cinque anni che nessuno ha scritto. Allargarlo sarebbe inventare un dato.
    assert.deepStrictEqual([d.da, d.a], [13400101, 13401231], forma);
  }
  assert.strictEqual(D.analizza('12 maggio 1340').certa, true);
}

// --- Test 4: ante / post --------------------------------------------------------
{
  // ⚠️ Non basta `chiave ± 1`: il giorno prima del 1° gennaio 1350 è il 31 dicembre 1349,
  // non il "13500100" — che come chiave di ordinamento funzionerebbe comunque, ed è
  // esattamente per questo che l'errore sarebbe sopravvissuto fino alla prima volta che
  // l'intervallo viene mostrato.
  assert.deepStrictEqual(letta('ante 1350'), [null, 13491231, 'ante', true]);
  assert.deepStrictEqual(letta('prima del 1350'), [null, 13491231, 'ante', true]);
  assert.deepStrictEqual(letta('post 1340'), [13410101, null, 'post', true]);
  assert.deepStrictEqual(letta('dopo il 1340'), [13410101, null, 'post', true]);
  assert.deepStrictEqual(letta('ante 1 maggio 1340'), [null, 13400430, 'ante', true]);
  assert.deepStrictEqual(letta('post 31 dicembre 1340'), [13410101, null, 'post', true]);
}

// --- Test 5: intervalli ---------------------------------------------------------
{
  assert.deepStrictEqual(letta('1340-1345'), [13400101, 13451231, 'intervallo', true]);
  assert.deepStrictEqual(letta('1340/1345'), [13400101, 13451231, 'intervallo', true]);
  assert.deepStrictEqual(letta('tra il 1340 e il 1345'), [13400101, 13451231, 'intervallo', true]);
  // "1340-45": il secondo numero è l'abbreviazione del primo, non l'anno 45.
  assert.deepStrictEqual(letta('1340-45'), [13400101, 13451231, 'intervallo', true]);
  // Un intervallo rovesciato non è un intervallo: si ricade sul primo anno letto.
  assert.strictEqual(D.analizza('1345-1340').qualificatore, 'anno');
}

// --- Test 6: secoli e loro partizioni -------------------------------------------
{
  // Il XIV secolo è 1301-1400: è la convenzione italiana, quella che un archivista legge.
  assert.deepStrictEqual(letta('sec. XIV'), [13010101, 14001231, 'secolo', true]);
  assert.deepStrictEqual(letta('XIV secolo'), [13010101, 14001231, 'secolo', true]);
  assert.deepStrictEqual(letta('sec. XIV in.'), [13010101, 13251231, 'secolo', true]);
  assert.deepStrictEqual(letta('sec. XIV ex.'), [13760101, 14001231, 'secolo', true]);
  assert.deepStrictEqual(letta('prima meta del sec. XIV'), [13010101, 13501231, 'secolo', true]);
  assert.deepStrictEqual(letta('seconda metà del sec. XIV'), [13510101, 14001231, 'secolo', true]);
  // Gli accenti non contano: "metà" e "meta" sono la stessa parola per il parser.
  assert.deepStrictEqual(letta('metà sec. XIV'), [13380101, 13631231, 'secolo', true]);
  assert.strictEqual(D.analizza('sec. XIV').certa, false, 'un secolo non è mai una data certa');
}

// --- Test 7: ciò che NON si deve indovinare -------------------------------------
{
  // ⚠️ Il punto più importante del modulo. Un intervallo inventato su una datazione che
  // l'app non ha capito entrerebbe negli ordinamenti come se fosse un dato.
  for (const testo of ['pergamena', 'reg. 4520', 'n. 12', '', '   ', 'ASP 1']) {
    assert.strictEqual(D.analizza(testo).riconosciuta, false, JSON.stringify(testo));
    assert.strictEqual(D.chiaveOrdinamento(testo), null, JSON.stringify(testo));
  }
  // Un numero fuori dall'intervallo plausibile è una segnatura, non un anno.
  assert.strictEqual(D.analizza('4520').riconosciuta, false);
  // "s.d." invece è riconosciuto: dichiarare che la data non c'è è un'informazione.
  const sd = D.analizza('s.d.');
  assert.strictEqual(sd.riconosciuta, true);
  assert.deepStrictEqual([sd.da, sd.a], [null, null]);
  assert.strictEqual(D.chiaveOrdinamento('s.d.'), null, 'senza data resta in coda');
}

// --- Test 8: chiave di ordinamento ----------------------------------------------
{
  const date = ['12 maggio 1340', '3 aprile 1290', 'sec. XIV', 'c. 1400', 'pergamena', 'ante 1200'];
  const ordinate = date.slice().sort((a, b) => {
    const ka = D.chiaveOrdinamento(a), kb = D.chiaveOrdinamento(b);
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;
    if (kb === null) return -1;
    return ka - kb;
  });
  // Il difetto che la fase esiste per risolvere: in ordine alfabetico "12 maggio 1340"
  // precede "3 aprile 1290", perché 1 viene prima di 3.
  assert.deepStrictEqual(ordinate, ['ante 1200', '3 aprile 1290', 'sec. XIV', '12 maggio 1340', 'c. 1400', 'pergamena']);
  // `ante` non ha un inizio: si ordina sulla sua fine, o finirebbe in testa all'archivio.
  assert.strictEqual(D.chiaveOrdinamento('ante 1200'), 11991231);
}

// --- Test 9: appartenenza a un periodo -------------------------------------------
{
  assert.strictEqual(D.nelPeriodo('12 maggio 1340', 1300, 1400), true);
  assert.strictEqual(D.nelPeriodo('12 maggio 1340', 1400, 1500), false);
  // ⚠️ Basta la SOVRAPPOSIZIONE, non il contenimento: cercando il Trecento, una scheda
  // datata "1290-1310" va mostrata. Escluderla nasconderebbe proprio i documenti a cavallo.
  assert.strictEqual(D.nelPeriodo('1290-1310', 1301, 1400), true);
  assert.strictEqual(D.nelPeriodo('sec. XIV', 1301, 1400), true);
  assert.strictEqual(D.nelPeriodo('sec. XV', 1301, 1400), false);
  // Estremi aperti: solo "da" o solo "a".
  assert.strictEqual(D.nelPeriodo('1340', 1350, ''), false);
  assert.strictEqual(D.nelPeriodo('1340', '', 1350), true);
  assert.strictEqual(D.nelPeriodo('post 1340', '', 1300), false, 'dopo il 1340 non è prima del 1300');
  assert.strictEqual(D.nelPeriodo('post 1340', 1500, ''), true, 'dopo il 1340 può essere nel 1500');
  // Ciò che non è una data non appartiene a nessun periodo: mostrarla direbbe che è del
  // Trecento senza saperlo.
  assert.strictEqual(D.nelPeriodo('pergamena', 1301, 1400), false);
  assert.strictEqual(D.nelPeriodo('s.d.', 1301, 1400), false);
}

// --- Test 10: memoria e purezza ---------------------------------------------------
{
  // Il risultato non dipende da quante volte lo si chiede (la cache non deve mutare nulla).
  const a = D.analizza('c. 1340');
  const b = D.analizza('c. 1340');
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a, D.analizzaSenzaCache('c. 1340'));
  // `raw` è sempre il testo originale, accenti e maiuscole comprese: è ciò che si mostra.
  assert.strictEqual(D.analizza('Sec. XIV In.').raw, 'Sec. XIV In.');
  assert.strictEqual(D.annoDi(13400512), 1340);
  assert.strictEqual(D.annoDi(null), null);
}

console.log('dataStorica: 10 gruppi di test OK');
